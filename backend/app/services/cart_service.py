from typing import Dict, List, Optional, Set, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.product import Product
from app.schemas.cart import CartItemSchema, CartSummarySchema
from app.services.product_service import ProductService


class TemporalFrameSmoother:
    """Temporal frame smoothing engine implementing N-frame addition and M-frame removal hysteresis.
    - An item quantity is confirmed only after appearing in N consecutive frames.
    - An item quantity is decreased only after absent for M consecutive frames.
    """

    def __init__(self, n_frames: Optional[int] = None, m_frames: Optional[int] = None):
        self.n_frames = n_frames or settings.SMOOTHING_N_FRAMES
        self.m_frames = m_frames or settings.SMOOTHING_M_FRAMES
        self.confirmed_counts: Dict[str, int] = {}
        self.candidate_streaks: Dict[Tuple[str, int], int] = {}
        self.absence_streaks: Dict[Tuple[str, int], int] = {}

    def update(self, detected_classes: List[str]) -> Dict[str, int]:
        """Process incoming raw detected classes from one video frame."""
        current_counts: Dict[str, int] = {}
        for c in detected_classes:
            cls_name = c.lower().strip()
            current_counts[cls_name] = current_counts.get(cls_name, 0) + 1

        all_classes: Set[str] = set(self.confirmed_counts.keys()).union(current_counts.keys())

        for cls in all_classes:
            observed = current_counts.get(cls, 0)
            confirmed = self.confirmed_counts.get(cls, 0)
            max_level = max(observed, confirmed)

            for level in range(1, max_level + 1):
                key = (cls, level)
                if level <= observed:
                    # Quantity level is present in current frame
                    self.candidate_streaks[key] = self.candidate_streaks.get(key, 0) + 1
                    self.absence_streaks[key] = 0
                    if self.candidate_streaks[key] >= self.n_frames:
                        if level > self.confirmed_counts.get(cls, 0):
                            self.confirmed_counts[cls] = level
                else:
                    # Quantity level is absent in current frame
                    self.candidate_streaks[key] = 0
                    self.absence_streaks[key] = self.absence_streaks.get(key, 0) + 1
                    if self.absence_streaks[key] >= self.m_frames:
                        if level <= self.confirmed_counts.get(cls, 0):
                            self.confirmed_counts[cls] = level - 1

            if self.confirmed_counts.get(cls, 0) <= 0:
                self.confirmed_counts.pop(cls, None)

        return dict(self.confirmed_counts)

    def reset(self):
        """Reset all internal streaks and confirmed counts."""
        self.confirmed_counts.clear()
        self.candidate_streaks.clear()
        self.absence_streaks.clear()


def calculate_line_item(product: Product, quantity: int, is_manual: bool = False) -> CartItemSchema:
    """Compute line-level GST split and total for a product."""
    taxable_value = product.price_paise * quantity
    half_rate = product.gst_rate / 2.0
    cgst = round(taxable_value * (half_rate / 100.0))
    sgst = round(taxable_value * (half_rate / 100.0))
    line_total = taxable_value + cgst + sgst

    return CartItemSchema(
        product_id=product.id,
        product_name=product.name,
        sku=product.sku,
        unit_price_paise=product.price_paise,
        gst_rate=product.gst_rate,
        quantity=quantity,
        taxable_value_paise=taxable_value,
        cgst_paise=cgst,
        sgst_paise=sgst,
        line_total_paise=line_total,
        is_manual=is_manual,
    )


class CartManager:
    """Manages active cashier carts, frame smoothing per session, and manual cashier overrides."""

    def __init__(self):
        self.smoothers: Dict[str, TemporalFrameSmoother] = {}
        # session_id -> {product_id: (quantity, is_manual)}
        self.manual_overrides: Dict[str, Dict[int, Tuple[int, bool]]] = {}

    def get_smoother(self, session_id: str) -> TemporalFrameSmoother:
        if session_id not in self.smoothers:
            self.smoothers[session_id] = TemporalFrameSmoother()
        return self.smoothers[session_id]

    async def sync_frame_detections(
        self, db: AsyncSession, session_id: str, detected_classes: List[str]
    ) -> CartSummarySchema:
        """Feed raw frame detections into the smoother, update the active cart, and return the aggregated cart."""
        smoother = self.get_smoother(session_id)
        stabilized_counts = smoother.update(detected_classes)

        # Map stabilized classes to catalog products
        items_dict: Dict[int, CartItemSchema] = {}

        for cls_name, qty in stabilized_counts.items():
            if qty <= 0:
                continue
            product = await ProductService.get_product_by_detector_class(db, cls_name)
            if not product:
                # Unmapped class (e.g. person, chair) is safely ignored
                continue

            # Check if there is a manual override for this product
            overrides = self.manual_overrides.get(session_id, {})
            if product.id in overrides:
                override_qty, is_manual = overrides[product.id]
                if override_qty > 0:
                    items_dict[product.id] = calculate_line_item(product, override_qty, is_manual=True)
            else:
                items_dict[product.id] = calculate_line_item(product, qty, is_manual=False)

        # Include purely manual products not detected by CV
        overrides = self.manual_overrides.get(session_id, {})
        for prod_id, (override_qty, is_manual) in overrides.items():
            if prod_id not in items_dict and override_qty > 0:
                product = await ProductService.get_product_by_id(db, prod_id)
                if product:
                    items_dict[prod_id] = calculate_line_item(product, override_qty, is_manual=True)

        return self._build_summary(list(items_dict.values()))

    async def get_cart(self, db: AsyncSession, session_id: str) -> CartSummarySchema:
        smoother = self.get_smoother(session_id)
        return await self.sync_frame_detections(db, session_id, list(smoother.confirmed_counts.keys()))

    async def update_item_quantity(
        self, db: AsyncSession, session_id: str, product_id: int, quantity: int
    ) -> CartSummarySchema:
        """Cashier manually updates an item's quantity or removes it (quantity=0)."""
        product = await ProductService.get_product_by_id(db, product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product ID {product_id} not found.",
            )

        if session_id not in self.manual_overrides:
            self.manual_overrides[session_id] = {}

        if quantity <= 0:
            self.manual_overrides[session_id][product_id] = (0, True)
        else:
            self.manual_overrides[session_id][product_id] = (quantity, True)

        return await self.get_cart(db, session_id)

    def clear_cart(self, session_id: str):
        """Clear all stabilized detections and manual overrides for a session."""
        if session_id in self.smoothers:
            self.smoothers[session_id].reset()
        if session_id in self.manual_overrides:
            self.manual_overrides[session_id].clear()

    @staticmethod
    def _build_summary(items: List[CartItemSchema]) -> CartSummarySchema:
        # Sort items by product name
        items.sort(key=lambda x: x.product_name)
        total_items = sum(i.quantity for i in items)
        subtotal = sum(i.taxable_value_paise for i in items)
        cgst = sum(i.cgst_paise for i in items)
        sgst = sum(i.sgst_paise for i in items)
        total = subtotal + cgst + sgst

        return CartSummarySchema(
            items=items,
            total_items=total_items,
            subtotal_paise=subtotal,
            cgst_paise=cgst,
            sgst_paise=sgst,
            total_paise=total,
        )


cart_manager = CartManager()


from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.product import Product
from app.schemas.cart import CartItemSchema, CartSummarySchema, NormalizedBox, ReviewCandidate
from app.services.product_service import ProductService


class TemporalFrameSmoother:
    """Temporal frame smoothing engine implementing N-frame monotonic addition hysteresis.

    Rules:
    1. Addition hysteresis: An item level is confirmed only after appearing simultaneously
       in N consecutive video frames (N is configurable via SMOOTHING_N_FRAMES).
    2. Monotonic auto quantity: For each product, auto quantity equals the maximum count
       of that product seen simultaneously in a single frame (after N consecutive frames).
       It never decreases due to absence or occlusion, and is never summed across separate
       appearances.
    3. No removal on absence: Items NEVER leave the cart automatically when absent from view.
       Camera absence (even 100+ frames) does not decrement or remove confirmed items.
    4. Reset on new sale / clear cart: All confirmed counts and streaks are reset when a sale
       is completed (checkout) or the cart is cleared.
    5. Manual edit interaction:
       - When a cashier manually updates quantity (+/-), manual edits always win against downward
         detections: detections cannot overwrite manual edits downward.
       - Detections may only raise quantity if the detected simultaneous count exceeds the current
         quantity for N consecutive frames.
    """

    def __init__(self, n_frames: Optional[int] = None, m_frames: Optional[int] = None):
        # m_frames is accepted for backward-compatibility but ignored since removal-on-absence is deleted
        self.n_frames = n_frames or settings.SMOOTHING_N_FRAMES
        self.confirmed_counts: Dict[str, int] = {}
        # (class_name, level) -> consecutive frame counter
        self.candidate_streaks: Dict[Tuple[str, int], int] = {}

    def update(self, detected_classes: List[str]) -> Dict[str, int]:
        """Process incoming raw detected classes from one video frame."""
        current_counts: Dict[str, int] = {}
        for c in detected_classes:
            cls_name = c.lower().strip()
            current_counts[cls_name] = current_counts.get(cls_name, 0) + 1

        for cls, observed in current_counts.items():
            for level in range(1, observed + 1):
                key = (cls, level)
                self.candidate_streaks[key] = self.candidate_streaks.get(key, 0) + 1
                if self.candidate_streaks[key] >= self.n_frames:
                    if level > self.confirmed_counts.get(cls, 0):
                        self.confirmed_counts[cls] = level

        # Reset candidate streaks for levels not observed in this frame so N frames must be strictly consecutive
        active_keys = set()
        for cls, observed in current_counts.items():
            for level in range(1, observed + 1):
                active_keys.add((cls, level))

        for key in list(self.candidate_streaks.keys()):
            if key not in active_keys:
                self.candidate_streaks[key] = 0

        return dict(self.confirmed_counts)

    def set_confirmed_level(self, cls: str, level: int):
        """Synchronize confirmed level when cashier manually edits an item quantity."""
        cls_name = cls.lower().strip()
        if level <= 0:
            self.reset_class(cls_name)
        else:
            self.confirmed_counts[cls_name] = level
            for (c, l) in list(self.candidate_streaks.keys()):
                if c == cls_name and l > level:
                    self.candidate_streaks[(c, l)] = 0

    def reset_class(self, cls: str):
        """Remove a specific class from confirmed detections and clear its candidate streaks."""
        cls_name = cls.lower().strip()
        self.confirmed_counts.pop(cls_name, None)
        for (c, l) in list(self.candidate_streaks.keys()):
            if c == cls_name:
                self.candidate_streaks.pop((c, l), None)

    def reset(self):
        """Reset all internal streaks and confirmed counts (called on new sale / clear cart)."""
        self.confirmed_counts.clear()
        self.candidate_streaks.clear()


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
        product_sku=product.sku,
        unit_price_paise=product.price_paise,
        gst_rate=product.gst_rate,
        quantity=quantity,
        taxable_value_paise=taxable_value,
        cgst_paise=cgst,
        sgst_paise=sgst,
        line_total_paise=line_total,
        is_manual=is_manual,
        available_stock=product.stock,
    )


class CartManager:
    """Manages active cashier carts, monotonic frame smoothing, review candidates, and manual overrides."""

    def __init__(self):
        self.smoothers: Dict[str, TemporalFrameSmoother] = {}
        # session_id -> {product_id: (quantity, is_manual)}
        self.manual_overrides: Dict[str, Dict[int, Tuple[int, bool]]] = {}
        # session_id -> set of dismissed or resolved predicted_class names
        self.suppressed_candidates: Dict[str, Set[str]] = {}
        # session_id -> {predicted_class: consecutive_frames_streak}
        self.candidate_streaks: Dict[str, Dict[str, int]] = {}
        # session_id -> cached review candidates
        self.current_review_candidates: Dict[str, List[ReviewCandidate]] = {}

    def get_smoother(self, session_id: str) -> TemporalFrameSmoother:
        if session_id not in self.smoothers:
            self.smoothers[session_id] = TemporalFrameSmoother()
        return self.smoothers[session_id]

    async def process_incoming_detections(
        self,
        db: AsyncSession,
        session_id: str,
        detected_classes: Optional[List[str]] = None,
        detections: Optional[List[Any]] = None,
        frame_width: int = 640,
        frame_height: int = 480,
    ) -> Tuple[List[str], List[ReviewCandidate]]:
        """Classify incoming detections into cart-eligible classes and review candidates.

        Classification Rules:
        - confidence >= ACCEPT_CONF (default 0.50) with mapped product -> cart
        - REVIEW_CONF (default 0.25) <= confidence < ACCEPT_CONF, OR unmapped product with confidence >= REVIEW_CONF -> review candidate
        - confidence < REVIEW_CONF -> ignored
        - Candidates are stable for >= 2 consecutive frames before being offered.
        - Suppressed classes (resolved or dismissed in current sale) are never re-offered.
        """
        cart_classes: List[str] = []
        raw_items = []

        if detections:
            for d in detections:
                if isinstance(d, dict):
                    cls_name = d.get("class_name") or d.get("name") or ""
                    conf = float(d.get("confidence", 1.0))
                    box = d.get("box", {})
                elif hasattr(d, "class_name"):
                    cls_name = getattr(d, "class_name", "")
                    conf = float(getattr(d, "confidence", 1.0))
                    box = getattr(d, "box", {})
                else:
                    continue
                raw_items.append((str(cls_name).lower().strip(), conf, box))
        elif detected_classes:
            for c in detected_classes:
                raw_items.append((c.lower().strip(), 1.0, {"x1": 0, "y1": 0, "x2": frame_width, "y2": frame_height}))

        suppressed = self.suppressed_candidates.get(session_id, set())
        candidate_streaks = self.candidate_streaks.setdefault(session_id, {})
        current_frame_candidates: Dict[str, Tuple[float, Any, Optional[Product]]] = {}

        for cls_name, conf, box in raw_items:
            if not cls_name or conf < settings.REVIEW_CONF:
                continue

            product = await ProductService.get_product_by_detector_class(db, cls_name)

            if conf >= settings.ACCEPT_CONF and product is not None:
                cart_classes.append(cls_name)
            else:
                # Review candidate (either low confidence with mapped product, or unmapped product with conf >= REVIEW_CONF)
                if cls_name in suppressed:
                    continue
                # Pick highest-confidence box for this class in this frame
                if cls_name not in current_frame_candidates or conf > current_frame_candidates[cls_name][0]:
                    current_frame_candidates[cls_name] = (conf, box, product)

        # Update candidate streaks for stability
        for cls_name in current_frame_candidates:
            candidate_streaks[cls_name] = candidate_streaks.get(cls_name, 0) + 1

        for cls_name in list(candidate_streaks.keys()):
            if cls_name not in current_frame_candidates:
                candidate_streaks[cls_name] = 0

        # Build qualifying ReviewCandidates (streak >= 2 consecutive frames)
        review_candidates: List[ReviewCandidate] = []
        fw = frame_width or 640
        fh = frame_height or 480

        for cls_name, (conf, box, product) in current_frame_candidates.items():
            if candidate_streaks.get(cls_name, 0) >= 2:
                if isinstance(box, dict):
                    x1 = float(box.get("x1", 0.0))
                    y1 = float(box.get("y1", 0.0))
                    x2 = float(box.get("x2", float(fw)))
                    y2 = float(box.get("y2", float(fh)))
                elif hasattr(box, "x1"):
                    x1 = float(getattr(box, "x1", 0.0))
                    y1 = float(getattr(box, "y1", 0.0))
                    x2 = float(getattr(box, "x2", float(fw)))
                    y2 = float(getattr(box, "y2", float(fh)))
                else:
                    x1, y1, x2, y2 = 0.0, 0.0, float(fw), float(fh)

                norm_x = max(0.0, min(1.0, x1 / fw))
                norm_y = max(0.0, min(1.0, y1 / fh))
                norm_w = max(0.0, min(1.0, (x2 - x1) / fw))
                norm_h = max(0.0, min(1.0, (y2 - y1) / fh))

                candidate_id = f"cand_{cls_name}"
                cand = ReviewCandidate(
                    candidate_id=candidate_id,
                    predicted_class=cls_name,
                    confidence=round(conf, 4),
                    box=NormalizedBox(
                        x=round(norm_x, 4),
                        y=round(norm_y, 4),
                        w=round(norm_w, 4),
                        h=round(norm_h, 4),
                    ),
                    mapped_product_id=product.id if product else None,
                    mapped_product_name=product.name if product else None,
                    mapped_product_price_paise=product.price_paise if product else None,
                )
                review_candidates.append(cand)

        self.current_review_candidates[session_id] = review_candidates
        return cart_classes, review_candidates

    async def _build_cart_from_state(
        self,
        db: AsyncSession,
        session_id: str,
        review_candidates: Optional[List[ReviewCandidate]] = None,
    ) -> CartSummarySchema:
        """Construct the aggregated cart from current smoother state, review candidates, and manual overrides."""
        smoother = self.get_smoother(session_id)
        items_dict: Dict[int, CartItemSchema] = {}
        overrides = self.manual_overrides.get(session_id, {})

        # 1. Process stabilized vision detections
        for cls_name, qty in smoother.confirmed_counts.items():
            if qty <= 0:
                continue
            product = await ProductService.get_product_by_detector_class(db, cls_name)
            if not product:
                continue

            if product.id in overrides:
                override_qty, is_manual = overrides[product.id]
                if is_manual:
                    if qty > override_qty:
                        items_dict[product.id] = calculate_line_item(product, qty, is_manual=False)
                        overrides[product.id] = (qty, False)
                    elif override_qty > 0:
                        items_dict[product.id] = calculate_line_item(product, override_qty, is_manual=True)
                else:
                    items_dict[product.id] = calculate_line_item(product, max(qty, override_qty), is_manual=False)
            else:
                items_dict[product.id] = calculate_line_item(product, qty, is_manual=False)

        # 2. Process manual items not present in vision detections
        for prod_id, (override_qty, is_manual) in overrides.items():
            if prod_id not in items_dict and override_qty > 0:
                product = await ProductService.get_product_by_id(db, prod_id)
                if product:
                    items_dict[prod_id] = calculate_line_item(product, override_qty, is_manual=True)

        candidates = (
            review_candidates
            if review_candidates is not None
            else self.current_review_candidates.get(session_id, [])
        )
        return self._build_summary(list(items_dict.values()), review_candidates=candidates)

    async def sync_frame_detections(
        self,
        db: AsyncSession,
        session_id: str,
        detected_classes: Optional[List[str]] = None,
        detections: Optional[List[Any]] = None,
        frame_width: int = 640,
        frame_height: int = 480,
    ) -> CartSummarySchema:
        """Feed raw frame detections into classifier and smoother, update state, and return aggregated cart."""
        cart_classes, review_candidates = await self.process_incoming_detections(
            db=db,
            session_id=session_id,
            detected_classes=detected_classes,
            detections=detections,
            frame_width=frame_width,
            frame_height=frame_height,
        )
        smoother = self.get_smoother(session_id)
        smoother.update(cart_classes)
        return await self._build_cart_from_state(db, session_id, review_candidates=review_candidates)

    async def get_cart(self, db: AsyncSession, session_id: str) -> CartSummarySchema:
        """Retrieve current active cart without feeding new frames."""
        return await self._build_cart_from_state(db, session_id)

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

        smoother = self.get_smoother(session_id)
        if quantity <= 0:
            self.manual_overrides[session_id][product_id] = (0, True)
            if product.detector_class:
                smoother.reset_class(product.detector_class)
        else:
            self.manual_overrides[session_id][product_id] = (quantity, True)
            if product.detector_class:
                smoother.set_confirmed_level(product.detector_class, quantity)

        return await self.get_cart(db, session_id)

    def suppress_candidate(self, session_id: str, predicted_class: str):
        """Suppress a candidate so it is not re-offered during this sale."""
        cls_name = predicted_class.lower().strip()
        if session_id not in self.suppressed_candidates:
            self.suppressed_candidates[session_id] = set()
        self.suppressed_candidates[session_id].add(cls_name)
        if session_id in self.candidate_streaks:
            self.candidate_streaks[session_id].pop(cls_name, None)
        if session_id in self.current_review_candidates:
            self.current_review_candidates[session_id] = [
                c for c in self.current_review_candidates[session_id] if c.predicted_class != cls_name
            ]

    def clear_cart(self, session_id: str):
        """Clear all stabilized detections, manual overrides, and review candidates (new sale reset)."""
        if session_id in self.smoothers:
            self.smoothers[session_id].reset()
        if session_id in self.manual_overrides:
            self.manual_overrides[session_id].clear()
        self.suppressed_candidates.pop(session_id, None)
        self.candidate_streaks.pop(session_id, None)
        self.current_review_candidates.pop(session_id, None)

    @staticmethod
    def _build_summary(
        items: List[CartItemSchema],
        review_candidates: Optional[List[ReviewCandidate]] = None,
    ) -> CartSummarySchema:
        items.sort(key=lambda x: x.product_name)
        total_items = sum(i.quantity for i in items)
        subtotal = sum(i.taxable_value_paise for i in items)
        cgst = sum(i.cgst_paise for i in items)
        sgst = sum(i.sgst_paise for i in items)
        total = subtotal + cgst + sgst

        return CartSummarySchema(
            items=items,
            total_items=total_items,
            total_items_count=total_items,
            subtotal_paise=subtotal,
            cgst_paise=cgst,
            cgst_total_paise=cgst,
            sgst_paise=sgst,
            sgst_total_paise=sgst,
            rounding_paise=0,
            total_paise=total,
            grand_total_paise=total,
            review_candidates=review_candidates or [],
        )


cart_manager = CartManager()

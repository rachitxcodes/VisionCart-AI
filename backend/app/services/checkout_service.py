import asyncio
import datetime
from typing import Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.core.database import is_sqlite
from app.models.product import Product, StockAdjustment
from app.models.invoice import Invoice, InvoiceItem
from app.models.idempotency import IdempotencyRecord
from app.schemas.invoice import CheckoutRequest
from app.services.cart_service import cart_manager

_sqlite_lock = asyncio.Lock()


class CheckoutService:
    @staticmethod
    async def get_invoice_by_id(db: AsyncSession, invoice_id: int) -> Optional[Invoice]:
        query = (
            select(Invoice)
            .filter(Invoice.id == invoice_id)
            .options(selectinload(Invoice.items), selectinload(Invoice.cashier))
        )
        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def get_invoice_by_number(db: AsyncSession, invoice_number: str) -> Optional[Invoice]:
        query = (
            select(Invoice)
            .filter(Invoice.invoice_number == invoice_number)
            .options(selectinload(Invoice.items), selectinload(Invoice.cashier))
        )
        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def get_recent_invoices(
        db: AsyncSession, skip: int = 0, limit: int = 50
    ) -> List[Invoice]:
        query = (
            select(Invoice)
            .order_by(Invoice.created_at.desc())
            .offset(skip)
            .limit(limit)
            .options(selectinload(Invoice.items), selectinload(Invoice.cashier))
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    @classmethod
    async def process_checkout(
        cls,
        db: AsyncSession,
        checkout_req: CheckoutRequest,
        cashier_id: int,
    ) -> Invoice:
        if is_sqlite:
            async with _sqlite_lock:
                return await cls._do_process_checkout(db, checkout_req, cashier_id)
        return await cls._do_process_checkout(db, checkout_req, cashier_id)

    @classmethod
    async def _do_process_checkout(
        cls,
        db: AsyncSession,
        checkout_req: CheckoutRequest,
        cashier_id: int,
    ) -> Invoice:
        """Execute atomic checkout with row-level locking (SELECT ... FOR UPDATE) and idempotency enforcement."""
        idempotency_key = checkout_req.idempotency_key

        # 1. Idempotency Check
        if idempotency_key:
            idemp_query = select(IdempotencyRecord).filter(IdempotencyRecord.key == idempotency_key)
            idemp_result = await db.execute(idemp_query)
            existing_record = idemp_result.scalars().first()
            if existing_record:
                # Retried request with identical key returns the existing invoice without duplicate deduction
                existing_invoice = await cls.get_invoice_by_id(db, existing_record.invoice_id)
                if existing_invoice:
                    return existing_invoice

        # Aggregate requested quantities per product
        requested_qtys: Dict[int, int] = {}
        for itm in checkout_req.items:
            requested_qtys[itm.product_id] = requested_qtys.get(itm.product_id, 0) + itm.quantity

        # 2. Prevent Deadlocks: Sort product IDs strictly in ascending numerical order
        sorted_product_ids = sorted(list(requested_qtys.keys()))

        # 3. Row-Level Locking with SELECT ... FOR UPDATE
        # Query products with row lock
        lock_query = (
            select(Product)
            .filter(Product.id.in_(sorted_product_ids))
            .order_by(Product.id.asc())
            .with_for_update()
        )
        lock_result = await db.execute(lock_query)
        locked_products = {p.id: p for p in lock_result.scalars().all()}

        # Verify all products exist and are active
        for pid in sorted_product_ids:
            if pid not in locked_products:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product with ID {pid} not found in catalog.",
                )
            if not locked_products[pid].is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product '{locked_products[pid].name}' (SKU: {locked_products[pid].sku}) is inactive.",
                )

        # 4. Stock Availability Check (All-or-Nothing validation)
        for pid, req_qty in requested_qtys.items():
            prod = locked_products[pid]
            if prod.stock < req_qty:
                # Insufficient stock rolls back everything with HTTP 400
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient stock for '{prod.name}' (SKU: {prod.sku}). "
                        f"Available stock: {prod.stock}, requested quantity: {req_qty}."
                    ),
                )

        # 5. Generate Unique Invoice Number (date prefix + short uuid for uniqueness under concurrency)
        import uuid as _uuid
        now = datetime.datetime.now(datetime.timezone.utc)
        date_str = now.strftime("%Y%m%d")
        invoice_number = f"INV-{date_str}-{_uuid.uuid4().hex[:8].upper()}"

        # 6. Deduct Stock & Calculate Taxable Line Items
        subtotal_paise = 0
        cgst_total_paise = 0
        sgst_total_paise = 0
        invoice_items_to_add: List[InvoiceItem] = []

        for pid, req_qty in requested_qtys.items():
            prod = locked_products[pid]
            prev_stock = prod.stock
            prod.stock -= req_qty

            # Log stock adjustment
            adj = StockAdjustment(
                product_id=prod.id,
                user_id=cashier_id,
                previous_stock=prev_stock,
                new_stock=prod.stock,
                quantity_change=-req_qty,
                reason=f"SALE_CHECKOUT_{invoice_number}",
            )
            db.add(adj)

            # GST Calculation per Line Item
            taxable_val = prod.price_paise * req_qty
            half_gst_rate = prod.gst_rate / 2.0
            cgst = round(taxable_val * (half_gst_rate / 100.0))
            sgst = round(taxable_val * (half_gst_rate / 100.0))
            line_tot = taxable_val + cgst + sgst

            subtotal_paise += taxable_val
            cgst_total_paise += cgst
            sgst_total_paise += sgst

            inv_item = InvoiceItem(
                product_id=prod.id,
                product_name=prod.name,
                product_sku=prod.sku,
                unit_price_paise=prod.price_paise,
                quantity=req_qty,
                gst_rate=prod.gst_rate,
                taxable_value_paise=taxable_val,
                cgst_paise=cgst,
                sgst_paise=sgst,
                line_total_paise=line_tot,
            )
            invoice_items_to_add.append(inv_item)

        total_payable = subtotal_paise + cgst_total_paise + sgst_total_paise

        # 7. Create Invoice
        invoice = Invoice(
            invoice_number=invoice_number,
            cashier_id=cashier_id,
            subtotal_paise=subtotal_paise,
            cgst_paise=cgst_total_paise,
            sgst_paise=sgst_total_paise,
            total_paise=total_payable,
            rounding_paise=0,
            status="COMPLETED",
            created_at=now,
        )
        db.add(invoice)
        await db.flush()

        for itm in invoice_items_to_add:
            itm.invoice_id = invoice.id
            db.add(itm)

        # 8. Store Idempotency Key Record
        if idempotency_key:
            idemp_rec = IdempotencyRecord(
                key=idempotency_key,
                invoice_id=invoice.id,
                request_hash=None,
            )
            db.add(idemp_rec)

        # Commit entire atomic unit of work
        await db.commit()

        # Clear session cart
        session_key = f"user_{cashier_id}_{checkout_req.session_id or 'default'}"
        cart_manager.clear_cart(session_key)

        return await cls.get_invoice_by_id(db, invoice.id)


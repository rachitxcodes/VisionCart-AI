from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_cashier_or_admin
from app.models.user import User
from app.schemas.invoice import CheckoutRequest, InvoiceResponse
from app.services.checkout_service import CheckoutService
from app.services.pdf_service import generate_invoice_pdf

router = APIRouter(prefix="/api/checkout", tags=["Checkout & Invoicing"])


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def process_checkout(
    checkout_req: CheckoutRequest,
    cashier: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Execute atomic checkout: row-level locking, stock deduction, GST invoice creation, and idempotency check."""
    return await CheckoutService.process_checkout(
        db=db,
        checkout_req=checkout_req,
        cashier_id=cashier.id,
    )


@router.get("/invoices", response_model=List[InvoiceResponse])
async def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve recent invoices with line items and cashier details."""
    return await CheckoutService.get_recent_invoices(db=db, skip=skip, limit=limit)


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve specific invoice details by ID."""
    invoice = await CheckoutService.get_invoice_by_id(db=db, invoice_id=invoice_id)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with ID {invoice_id} not found.",
        )
    return invoice


@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: int,
    user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Generate and download a GST-compliant tax invoice PDF."""
    invoice = await CheckoutService.get_invoice_by_id(db=db, invoice_id=invoice_id)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with ID {invoice_id} not found.",
        )

    pdf_bytes = generate_invoice_pdf(invoice)
    filename = f"Invoice_{invoice.invoice_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


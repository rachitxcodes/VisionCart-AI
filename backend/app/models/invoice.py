from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(64), unique=True, index=True, nullable=False)
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    subtotal_paise = Column(Integer, nullable=False)  # Total taxable value before tax
    cgst_paise = Column(Integer, nullable=False)
    sgst_paise = Column(Integer, nullable=False)
    total_paise = Column(Integer, nullable=False)  # Final payable total
    rounding_paise = Column(Integer, nullable=False, default=0)
    status = Column(String(32), default="COMPLETED", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    cashier = relationship("User", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    idempotency_record = relationship("IdempotencyRecord", back_populates="invoice", uselist=False)


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    product_name = Column(String(255), nullable=False)
    product_sku = Column(String(64), nullable=False)
    unit_price_paise = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False)
    gst_rate = Column(Integer, nullable=False)
    taxable_value_paise = Column(Integer, nullable=False)
    cgst_paise = Column(Integer, nullable=False)
    sgst_paise = Column(Integer, nullable=False)
    line_total_paise = Column(Integer, nullable=False)

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product", back_populates="invoice_items")


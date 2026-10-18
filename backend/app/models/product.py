from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(255), index=True, nullable=False)
    category = Column(String(100), index=True, nullable=False, default="General")
    price_paise = Column(Integer, nullable=False)  # Money stored in integer paise
    gst_rate = Column(Integer, nullable=False, default=18)  # Percentage, e.g. 0, 5, 12, 18, 28
    stock = Column(Integer, nullable=False, default=0)
    reorder_level = Column(Integer, nullable=False, default=10)
    detector_class = Column(String(100), index=True, nullable=True)  # YOLO class label
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    stock_adjustments = relationship("StockAdjustment", back_populates="product", cascade="all, delete-orphan")
    invoice_items = relationship("InvoiceItem", back_populates="product")


class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    previous_stock = Column(Integer, nullable=False)
    new_stock = Column(Integer, nullable=False)
    quantity_change = Column(Integer, nullable=False)  # positive for addition, negative for deduction
    reason = Column(String(255), nullable=False, default="INVENTORY_ADJUSTMENT")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    product = relationship("Product", back_populates="stock_adjustments")
    user = relationship("User", back_populates="stock_adjustments")


Index("idx_product_low_stock", Product.stock, Product.reorder_level)


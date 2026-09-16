from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base

class RoleEnum(str, enum.Enum):
    admin = "admin"
    cashier = "cashier"

class PaymentMethodEnum(str, enum.Enum):
    cash = "cash"
    card = "card"
    upi = "upi"

class TransactionStatusEnum(str, enum.Enum):
    completed = "completed"
    cancelled = "cancelled"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(100), unique=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.cashier)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"))
    price = Column(Numeric(10, 2), nullable=False)
    image_url = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    category = relationship("Category")
    inventory = relationship("Inventory", back_populates="product", uselist=False)

class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    stock = Column(Integer, default=0)
    low_stock_threshold = Column(Integer, default=10)
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    product = relationship("Product", back_populates="inventory")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    cashier_id = Column(Integer, ForeignKey("users.id"))
    total = Column(Numeric(10, 2))
    tax = Column(Numeric(10, 2))
    payment_method = Column(Enum(PaymentMethodEnum))
    status = Column(Enum(TransactionStatusEnum), default=TransactionStatusEnum.completed)
    created_at = Column(DateTime, server_default=func.now())
    
    cashier = relationship("User")
    items = relationship("SalesItem", back_populates="transaction")

class SalesItem(Base):
    __tablename__ = "sales_items"
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)
    unit_price = Column(Numeric(10, 2))
    line_total = Column(Numeric(10, 2))
    
    transaction = relationship("Transaction", back_populates="items")
    product = relationship("Product")

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(255))
    details = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    
    user = relationship("User")

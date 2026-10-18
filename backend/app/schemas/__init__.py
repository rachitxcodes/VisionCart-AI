"""Schemas package."""
from app.schemas.user import UserResponse, UserLoginRequest, TokenResponse, UserCreate
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    StockAdjustmentCreate,
    StockAdjustmentResponse,
)
from app.schemas.detector import Detection, BoundingBox, DetectionResponse, Base64FrameRequest
from app.schemas.cart import (
    CartItemSchema,
    CartSummarySchema,
    ManualCartItemUpdate,
    ProcessFrameCartRequest,
)
from app.schemas.invoice import (
    CheckoutItemRequest,
    CheckoutRequest,
    InvoiceItemResponse,
    InvoiceResponse,
)

__all__ = [
    "UserResponse",
    "UserLoginRequest",
    "TokenResponse",
    "UserCreate",
    "ProductCreate",
    "ProductUpdate",
    "ProductResponse",
    "StockAdjustmentCreate",
    "StockAdjustmentResponse",
    "Detection",
    "BoundingBox",
    "DetectionResponse",
    "Base64FrameRequest",
    "CartItemSchema",
    "CartSummarySchema",
    "ManualCartItemUpdate",
    "ProcessFrameCartRequest",
    "CheckoutItemRequest",
    "CheckoutRequest",
    "InvoiceItemResponse",
    "InvoiceResponse",
]


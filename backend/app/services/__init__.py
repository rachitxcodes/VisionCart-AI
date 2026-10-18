"""Services package."""
from app.services.auth_service import AuthService
from app.services.product_service import ProductService
from app.services.detector_service import (
    get_detector,
    Detector,
    MockDetector,
    YOLODetector,
    load_image_from_bytes,
    load_image_from_base64,
)
from app.services.cart_service import (
    TemporalFrameSmoother,
    CartManager,
    cart_manager,
    calculate_line_item,
)
from app.services.pdf_service import generate_invoice_pdf, format_rupees
from app.services.checkout_service import CheckoutService

__all__ = [
    "AuthService",
    "ProductService",
    "get_detector",
    "Detector",
    "MockDetector",
    "YOLODetector",
    "load_image_from_bytes",
    "load_image_from_base64",
    "TemporalFrameSmoother",
    "CartManager",
    "cart_manager",
    "calculate_line_item",
    "generate_invoice_pdf",
    "format_rupees",
    "CheckoutService",
]


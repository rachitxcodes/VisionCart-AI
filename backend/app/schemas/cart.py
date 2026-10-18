from typing import List, Optional
from pydantic import BaseModel, Field


class CartItemSchema(BaseModel):
    product_id: int
    product_name: str
    sku: str
    unit_price_paise: int
    gst_rate: int
    quantity: int = Field(..., ge=1)
    taxable_value_paise: int
    cgst_paise: int
    sgst_paise: int
    line_total_paise: int
    is_manual: bool = False


class CartSummarySchema(BaseModel):
    items: List[CartItemSchema]
    total_items: int
    subtotal_paise: int
    cgst_paise: int
    sgst_paise: int
    total_paise: int


class ManualCartItemUpdate(BaseModel):
    product_id: int
    quantity: int = Field(..., ge=0, description="0 to remove, >0 to set quantity")


class ProcessFrameCartRequest(BaseModel):
    session_id: Optional[str] = "default"
    image_base64: Optional[str] = None


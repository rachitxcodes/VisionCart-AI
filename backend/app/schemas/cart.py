from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class CartItemSchema(BaseModel):
    product_id: int
    product_name: str
    sku: str
    product_sku: Optional[str] = None
    unit_price_paise: int
    gst_rate: int
    quantity: int = Field(..., ge=1)
    taxable_value_paise: int
    cgst_paise: int
    sgst_paise: int
    line_total_paise: int
    is_manual: bool = False
    available_stock: Optional[int] = None

    @model_validator(mode="after")
    def populate_product_sku(self):
        if not self.product_sku:
            self.product_sku = self.sku
        return self


class CartSummarySchema(BaseModel):
    items: List[CartItemSchema]
    total_items: int
    total_items_count: Optional[int] = None
    subtotal_paise: int
    cgst_paise: int
    cgst_total_paise: Optional[int] = None
    sgst_paise: int
    sgst_total_paise: Optional[int] = None
    rounding_paise: int = 0
    total_paise: int
    grand_total_paise: Optional[int] = None

    @model_validator(mode="after")
    def populate_aliases(self):
        if self.total_items_count is None:
            self.total_items_count = self.total_items
        if self.cgst_total_paise is None:
            self.cgst_total_paise = self.cgst_paise
        if self.sgst_total_paise is None:
            self.sgst_total_paise = self.sgst_paise
        if self.grand_total_paise is None:
            self.grand_total_paise = self.total_paise
        return self


class ManualCartItemUpdate(BaseModel):
    product_id: int
    quantity: int = Field(..., ge=0, description="0 to remove, >0 to set quantity")
    session_id: Optional[str] = None


class ProcessFrameCartRequest(BaseModel):
    session_id: Optional[str] = "default"
    image_base64: Optional[str] = None

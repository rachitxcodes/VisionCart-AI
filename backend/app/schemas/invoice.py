from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class CheckoutItemRequest(BaseModel):
    product_id: int
    quantity: int = Field(..., ge=1)


class CheckoutRequest(BaseModel):
    items: List[CheckoutItemRequest] = Field(..., min_length=1)
    idempotency_key: str = Field(..., min_length=8, max_length=128)
    session_id: Optional[str] = "default"


class InvoiceItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_sku: str
    unit_price_paise: int
    quantity: int
    gst_rate: int
    taxable_value_paise: int
    cgst_paise: int
    sgst_paise: int
    line_total_paise: int

    model_config = ConfigDict(from_attributes=True)


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    cashier_id: int
    subtotal_paise: int
    cgst_paise: int
    sgst_paise: int
    total_paise: int
    rounding_paise: int
    status: str
    created_at: datetime
    items: List[InvoiceItemResponse]

    model_config = ConfigDict(from_attributes=True)


from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict, computed_field


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sku: str = Field(..., min_length=1, max_length=64)
    category: str = Field(default="General", max_length=100)
    price_paise: int = Field(..., ge=0, description="Price in integer paise (1 INR = 100 paise)")
    gst_rate: int = Field(default=18, description="GST rate percentage (e.g. 0, 5, 12, 18, 28)")
    reorder_level: int = Field(default=10, ge=0)
    detector_class: Optional[str] = Field(default=None, max_length=100)
    is_active: bool = True


class ProductCreate(ProductBase):
    stock: int = Field(default=0, ge=0)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    sku: Optional[str] = Field(None, min_length=1, max_length=64)
    category: Optional[str] = Field(None, max_length=100)
    price_paise: Optional[int] = Field(None, ge=0)
    gst_rate: Optional[int] = Field(None)
    reorder_level: Optional[int] = Field(None, ge=0)
    detector_class: Optional[str] = None
    is_active: Optional[bool] = None
    stock: Optional[int] = Field(None, ge=0)


class ProductResponse(ProductBase):
    id: int
    stock: int
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def is_low_stock(self) -> bool:
        return self.stock <= self.reorder_level

    model_config = ConfigDict(from_attributes=True)


class StockAdjustmentCreate(BaseModel):
    action: Literal["ADD", "DEDUCT", "SET"]
    quantity: int = Field(..., ge=0)
    reason: str = Field(..., min_length=1, max_length=255)


class StockAdjustmentResponse(BaseModel):
    id: int
    product_id: int
    user_id: Optional[int]
    previous_stock: int
    new_stock: int
    quantity_change: int
    reason: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


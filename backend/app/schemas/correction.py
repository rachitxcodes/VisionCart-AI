import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


CorrectionType = Literal["wrong_item", "unknown_item", "false_positive"]


class CorrectionCreateMeta(BaseModel):
    session_id: Optional[str] = None
    correction_type: CorrectionType
    predicted_class: Optional[str] = None
    predicted_conf: Optional[float] = None
    box_x: Optional[float] = Field(None, ge=0.0, le=1.0)
    box_y: Optional[float] = Field(None, ge=0.0, le=1.0)
    box_w: Optional[float] = Field(None, ge=0.0, le=1.0)
    box_h: Optional[float] = Field(None, ge=0.0, le=1.0)
    corrected_product_id: Optional[int] = None
    corrected_label: Optional[str] = None
    frame_width: Optional[int] = None
    frame_height: Optional[int] = None


class CorrectionResponse(BaseModel):
    id: int
    created_at: datetime.datetime
    session_id: Optional[str] = None
    cashier_user_id: Optional[int] = None
    cashier_name: Optional[str] = None
    correction_type: str
    predicted_class: Optional[str] = None
    predicted_conf: Optional[float] = None
    box_x: Optional[float] = None
    box_y: Optional[float] = None
    box_w: Optional[float] = None
    box_h: Optional[float] = None
    corrected_product_id: Optional[int] = None
    corrected_product_name: Optional[str] = None
    corrected_label: Optional[str] = None
    image_url: str
    frame_width: Optional[int] = None
    frame_height: Optional[int] = None

    class Config:
        from_attributes = True


class CorrectionListResponse(BaseModel):
    items: List[CorrectionResponse]
    total: int
    skip: int
    limit: int


class TopConfusionItem(BaseModel):
    predicted_class: str
    corrected_label: str
    count: int


class CorrectionStatsResponse(BaseModel):
    total: int
    by_type: Dict[str, int]
    top_confusions: List[TopConfusionItem]

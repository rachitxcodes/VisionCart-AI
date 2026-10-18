from typing import List, Optional
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x1: float = Field(..., description="Top-left X coordinate")
    y1: float = Field(..., description="Top-left Y coordinate")
    x2: float = Field(..., description="Bottom-right X coordinate")
    y2: float = Field(..., description="Bottom-right Y coordinate")


class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    box: BoundingBox
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    price_paise: Optional[int] = None


class DetectionResponse(BaseModel):
    detections: List[Detection]
    frame_width: int
    frame_height: int
    inference_time_ms: float
    detector_mode: str


class Base64FrameRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded JPEG/PNG frame, with or without data:image/jpeg;base64, prefix")


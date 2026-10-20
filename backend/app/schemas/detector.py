from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


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
    count: Optional[int] = None

    @model_validator(mode="after")
    def populate_count(self):
        if self.count is None:
            self.count = len(self.detections)
        return self


class Base64FrameRequest(BaseModel):
    image: Optional[str] = Field(None, description="Base64 encoded JPEG/PNG frame, with or without data:image/jpeg;base64, prefix")
    image_base64: Optional[str] = Field(None, description="Alternative field name for image base64")

    @model_validator(mode="after")
    def validate_image_present(self):
        if not self.image and not self.image_base64:
            raise ValueError("Field 'image' or 'image_base64' is required.")
        if not self.image and self.image_base64:
            self.image = self.image_base64
        return self

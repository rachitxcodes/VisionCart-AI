from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import require_cashier_or_admin
from app.models.user import User
from app.schemas.detector import DetectionResponse, Base64FrameRequest
from app.services.detector_service import (
    get_detector,
    load_image_from_bytes,
    load_image_from_base64,
)
from app.services.product_service import ProductService

router = APIRouter(prefix="/api/detection", tags=["Computer Vision Detection"])


@router.post("/detect", response_model=DetectionResponse)
async def detect_products_from_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Detect retail products from an uploaded image file (JPEG/PNG)."""
    try:
        contents = await file.read()
        image = load_image_from_bytes(contents)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image format or corrupted file: {exc}",
        )

    h, w = image.shape[:2]
    detector = get_detector()
    detections, inference_time_ms = detector.detect(image)

    # Enrich detections with product catalog data
    for det in detections:
        product = await ProductService.get_product_by_detector_class(db, det.class_name)
        if product:
            det.product_id = product.id
            det.product_name = product.name
            det.price_paise = product.price_paise

    return DetectionResponse(
        detections=detections,
        frame_width=w,
        frame_height=h,
        inference_time_ms=round(inference_time_ms, 2),
        detector_mode=settings.DETECTOR_MODE,
    )


@router.post("/detect-base64", response_model=DetectionResponse)
async def detect_products_from_base64(
    payload: Base64FrameRequest,
    current_user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Detect retail products from a base64 encoded video frame captured from browser webcam."""
    try:
        image = load_image_from_base64(payload.image)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 image data: {exc}",
        )

    h, w = image.shape[:2]
    detector = get_detector()
    detections, inference_time_ms = detector.detect(image)

    # Enrich detections with product catalog data
    for det in detections:
        product = await ProductService.get_product_by_detector_class(db, det.class_name)
        if product:
            det.product_id = product.id
            det.product_name = product.name
            det.price_paise = product.price_paise

    return DetectionResponse(
        detections=detections,
        frame_width=w,
        frame_height=h,
        inference_time_ms=round(inference_time_ms, 2),
        detector_mode=settings.DETECTOR_MODE,
    )


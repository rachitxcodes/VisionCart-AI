import datetime
import json
import os
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin, require_cashier_or_admin
from app.models.user import User
from app.schemas.correction import CorrectionListResponse, CorrectionStatsResponse
from app.services.cart_service import cart_manager
from app.services.correction_service import CorrectionService

router = APIRouter(prefix="/api/corrections", tags=["Detection Corrections"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_detection_correction(
    frame: UploadFile = File(...),
    meta: str = Form(...),
    current_user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Log a cashier detection correction: upload JPEG frame with bounding box and corrected product metadata."""
    corr_id = await CorrectionService.create_correction(
        db=db,
        user=current_user,
        frame=frame,
        meta_json=meta,
    )

    # Suppress candidate in the cashier's active session so it is not re-offered
    try:
        meta_dict = json.loads(meta)
        session_id = meta_dict.get("session_id")
        predicted_class = meta_dict.get("predicted_class")
        if session_id and predicted_class:
            session_key = f"user_{current_user.id}_{session_id}"
            cart_manager.suppress_candidate(session_key, predicted_class)
    except Exception:
        pass

    return {
        "id": corr_id,
        "message": "Detection correction recorded successfully.",
    }


@router.get("", response_model=CorrectionListResponse)
async def list_detection_corrections(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    type: Optional[str] = Query(None, description="Filter by correction type ('wrong_item', 'unknown_item', 'false_positive')"),
    label: Optional[str] = Query(None, description="Filter by corrected or predicted label"),
    start_date: Optional[datetime.datetime] = Query(None),
    end_date: Optional[datetime.datetime] = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve paginated detection corrections for training review (Admin only)."""
    return await CorrectionService.get_corrections(
        db=db,
        skip=skip,
        limit=limit,
        correction_type=type,
        label=label,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/stats", response_model=CorrectionStatsResponse)
async def get_correction_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate statistics on recorded corrections and common classification mix-ups (Admin only)."""
    return await CorrectionService.get_stats(db=db)


@router.get("/export")
async def export_training_dataset(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Download a ZIP archive in YOLOv8 training format containing labeled images and classes.txt (Admin only)."""
    zip_buf = await CorrectionService.build_yolo_export_zip(db=db)
    filename = f"visioncart_yolo_dataset_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{correction_id}/image")
async def get_correction_image(
    correction_id: int,
    user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Stream stored correction frame JPEG via authenticated route."""
    record = await CorrectionService.get_correction_by_id(db, correction_id)
    if not record or not record.image_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Correction ID {correction_id} not found.",
        )

    if not os.path.exists(record.image_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Frame image file not found on disk.",
        )

    with open(record.image_path, "rb") as f:
        image_bytes = f.read()

    return Response(content=image_bytes, media_type="image/jpeg")


@router.delete("/{correction_id}")
async def delete_correction(
    correction_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a correction record and remove its frame image from server disk (Admin only)."""
    await CorrectionService.delete_correction(db, correction_id)
    return {"message": f"Correction ID {correction_id} deleted successfully."}

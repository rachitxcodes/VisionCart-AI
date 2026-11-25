import datetime
import io
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import uuid
import zipfile

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.logging import logger
from app.models.correction import DetectionCorrection
from app.models.product import Product
from app.models.user import User
from app.schemas.correction import (
    CorrectionCreateMeta,
    CorrectionListResponse,
    CorrectionResponse,
    CorrectionStatsResponse,
    TopConfusionItem,
)


class CorrectionService:
    @staticmethod
    def get_storage_dir() -> Path:
        target = Path(settings.CORRECTIONS_DIR)
        target.mkdir(parents=True, exist_ok=True)
        return target

    @classmethod
    async def create_correction(
        cls,
        db: AsyncSession,
        user: User,
        frame: UploadFile,
        meta_json: str,
    ) -> int:
        """Validate uploaded frame and metadata, store file on local disk, and save DB record."""
        # 1. Parse and validate metadata
        try:
            meta_dict = json.loads(meta_json)
            meta = CorrectionCreateMeta(**meta_dict)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid correction metadata JSON: {exc}",
            )

        # 2. Read and validate frame file
        contents = await frame.read()
        max_bytes = settings.CORRECTIONS_MAX_MB * 1024 * 1024
        if len(contents) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Uploaded frame size ({len(contents)} bytes) exceeds maximum limit of {settings.CORRECTIONS_MAX_MB} MB.",
            )

        # Validate magic bytes: JPEG starts with FF D8 FF
        if len(contents) < 3 or contents[:3] != b"\xff\xd8\xff":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid image format: must be a valid JPEG file with valid magic bytes.",
            )

        # 3. Save to disk with UUID filename (never user input)
        storage_dir = cls.get_storage_dir()
        file_uuid = uuid.uuid4().hex
        filename = f"{file_uuid}.jpg"
        file_path = storage_dir / filename

        with open(file_path, "wb") as f:
            f.write(contents)

        # 4. Save DB record
        record = DetectionCorrection(
            session_id=meta.session_id,
            cashier_user_id=user.id,
            correction_type=meta.correction_type,
            predicted_class=meta.predicted_class.lower().strip() if meta.predicted_class else None,
            predicted_conf=meta.predicted_conf,
            box_x=meta.box_x,
            box_y=meta.box_y,
            box_w=meta.box_w,
            box_h=meta.box_h,
            corrected_product_id=meta.corrected_product_id,
            corrected_label=meta.corrected_label.lower().strip() if meta.corrected_label else None,
            image_path=str(file_path),
            frame_width=meta.frame_width,
            frame_height=meta.frame_height,
        )

        db.add(record)
        await db.commit()
        await db.refresh(record)

        logger.info(
            f"[CorrectionService] Saved correction ID={record.id} type={record.correction_type} "
            f"predicted={record.predicted_class} corrected={record.corrected_label} file={filename}"
        )
        return record.id

    @classmethod
    async def get_corrections(
        cls,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 20,
        correction_type: Optional[str] = None,
        label: Optional[str] = None,
        start_date: Optional[datetime.datetime] = None,
        end_date: Optional[datetime.datetime] = None,
    ) -> CorrectionListResponse:
        query = select(DetectionCorrection).options(
            selectinload(DetectionCorrection.cashier),
            selectinload(DetectionCorrection.corrected_product),
        )

        count_query = select(func.count(DetectionCorrection.id))

        if correction_type:
            query = query.filter(DetectionCorrection.correction_type == correction_type)
            count_query = count_query.filter(DetectionCorrection.correction_type == correction_type)
        if label:
            term = f"%{label.lower().strip()}%"
            query = query.filter(
                (DetectionCorrection.corrected_label.ilike(term))
                | (DetectionCorrection.predicted_class.ilike(term))
            )
            count_query = count_query.filter(
                (DetectionCorrection.corrected_label.ilike(term))
                | (DetectionCorrection.predicted_class.ilike(term))
            )
        if start_date:
            query = query.filter(DetectionCorrection.created_at >= start_date)
            count_query = count_query.filter(DetectionCorrection.created_at >= start_date)
        if end_date:
            query = query.filter(DetectionCorrection.created_at <= end_date)
            count_query = count_query.filter(DetectionCorrection.created_at <= end_date)

        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        query = query.order_by(DetectionCorrection.created_at.desc()).offset(skip).limit(limit)
        res = await db.execute(query)
        records = res.scalars().all()

        items = []
        for r in records:
            items.append(
                CorrectionResponse(
                    id=r.id,
                    created_at=r.created_at,
                    session_id=r.session_id,
                    cashier_user_id=r.cashier_user_id,
                    cashier_name=r.cashier.full_name if r.cashier else None,
                    correction_type=r.correction_type,
                    predicted_class=r.predicted_class,
                    predicted_conf=r.predicted_conf,
                    box_x=r.box_x,
                    box_y=r.box_y,
                    box_w=r.box_w,
                    box_h=r.box_h,
                    corrected_product_id=r.corrected_product_id,
                    corrected_product_name=r.corrected_product.name if r.corrected_product else None,
                    corrected_label=r.corrected_label,
                    image_url=f"/api/corrections/{r.id}/image",
                    frame_width=r.frame_width,
                    frame_height=r.frame_height,
                )
            )

        return CorrectionListResponse(items=items, total=total, skip=skip, limit=limit)

    @classmethod
    async def get_correction_by_id(cls, db: AsyncSession, correction_id: int) -> Optional[DetectionCorrection]:
        query = (
            select(DetectionCorrection)
            .filter(DetectionCorrection.id == correction_id)
            .options(
                selectinload(DetectionCorrection.cashier),
                selectinload(DetectionCorrection.corrected_product),
            )
        )
        res = await db.execute(query)
        return res.scalars().first()

    @classmethod
    async def get_stats(cls, db: AsyncSession) -> CorrectionStatsResponse:
        # Total count
        total_res = await db.execute(select(func.count(DetectionCorrection.id)))
        total = total_res.scalar_one() or 0

        # By type
        type_res = await db.execute(
            select(DetectionCorrection.correction_type, func.count(DetectionCorrection.id)).group_by(
                DetectionCorrection.correction_type
            )
        )
        by_type_counts = {k: v for k, v in type_res.all()}
        by_type = {
            "wrong_item": by_type_counts.get("wrong_item", 0),
            "unknown_item": by_type_counts.get("unknown_item", 0),
            "false_positive": by_type_counts.get("false_positive", 0),
        }

        # Top confusions: predicted_class -> corrected_label
        confusion_res = await db.execute(
            select(
                DetectionCorrection.predicted_class,
                DetectionCorrection.corrected_label,
                func.count(DetectionCorrection.id).label("cnt"),
            )
            .filter(
                DetectionCorrection.predicted_class.isnot(None),
                DetectionCorrection.corrected_label.isnot(None),
            )
            .group_by(DetectionCorrection.predicted_class, DetectionCorrection.corrected_label)
            .order_by(func.count(DetectionCorrection.id).desc())
            .limit(10)
        )

        top_confusions = [
            TopConfusionItem(
                predicted_class=row[0],
                corrected_label=row[1],
                count=row[2],
            )
            for row in confusion_res.all()
        ]

        return CorrectionStatsResponse(
            total=total,
            by_type=by_type,
            top_confusions=top_confusions,
        )

    @classmethod
    async def delete_correction(cls, db: AsyncSession, correction_id: int):
        record = await cls.get_correction_by_id(db, correction_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Correction ID {correction_id} not found.",
            )

        # Delete image file from disk if present
        if record.image_path and os.path.exists(record.image_path):
            try:
                os.remove(record.image_path)
            except Exception as exc:
                logger.warning(f"Failed to delete correction image file {record.image_path}: {exc}")

        await db.delete(record)
        await db.commit()

    @classmethod
    async def build_yolo_export_zip(cls, db: AsyncSession) -> io.BytesIO:
        """Stream a ZIP in YOLO format containing wrong_item and unknown_item records with valid boxes."""
        # 1. Fetch all product detector labels for stable classes.txt
        prods_res = await db.execute(
            select(Product.detector_class)
            .filter(Product.detector_class.isnot(None), Product.is_active == True)
            .distinct()
        )
        classes_set = set(p[0].lower().strip() for p in prods_res.all() if p[0])

        # Also include any corrected_labels present in corrections
        corr_labels_res = await db.execute(
            select(DetectionCorrection.corrected_label)
            .filter(
                DetectionCorrection.corrected_label.isnot(None),
                DetectionCorrection.correction_type.in_(["wrong_item", "unknown_item"]),
            )
            .distinct()
        )
        for cl in corr_labels_res.all():
            if cl[0]:
                classes_set.add(cl[0].lower().strip())

        classes_list = sorted(list(classes_set))
        class_to_id = {cls_name: idx for idx, cls_name in enumerate(classes_list)}

        # 2. Query valid records for export (exclude false_positive)
        records_query = select(DetectionCorrection).filter(
            DetectionCorrection.correction_type.in_(["wrong_item", "unknown_item"]),
            DetectionCorrection.corrected_label.isnot(None),
            DetectionCorrection.box_x.isnot(None),
            DetectionCorrection.box_y.isnot(None),
            DetectionCorrection.box_w.isnot(None),
            DetectionCorrection.box_h.isnot(None),
        )
        records_res = await db.execute(records_query)
        records = records_res.scalars().all()

        # 3. Create in-memory zip
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            # classes.txt
            classes_content = "\n".join(classes_list) + "\n"
            zf.writestr("classes.txt", classes_content)

            # README.txt
            readme_text = (
                "VisionCart AI - Corrections Training Dataset (YOLOv8 Format)\n"
                "===========================================================\n\n"
                f"Generated on: {datetime.datetime.now(datetime.timezone.utc).isoformat()}\n"
                f"Total annotated frames: {len(records)}\n"
                f"Total classes: {len(classes_list)}\n\n"
                "Directory Structure:\n"
                "  images/       - Stored JPEG frames from shop-counter corrections\n"
                "  labels/       - YOLO normalized coordinates (class_id cx cy w h)\n"
                "  classes.txt   - Stable sorted list of detector labels\n\n"
                "How to Train with Ultralytics YOLOv8:\n"
                "  1. Define dataset.yaml pointing to this root folder.\n"
                "  2. Match classes.txt names to dataset.yaml names array.\n"
                "  3. Execute fine-tuning: yolo detect train data=dataset.yaml model=yolov8n.pt epochs=25\n\n"
                "Privacy Notice:\n"
                "All frames are stored strictly on the local retail server. Customer and cashier privacy\n"
                "is respected, and records can be deleted at any time from the Admin Corrections portal.\n"
            )
            zf.writestr("README.txt", readme_text)

            # Add images and labels
            for r in records:
                if not r.image_path or not os.path.exists(r.image_path):
                    continue

                label_name = r.corrected_label.lower().strip()
                if label_name not in class_to_id:
                    continue
                class_id = class_to_id[label_name]

                # Convert top-left (x, y, w, h) to YOLO center (cx, cy, w, h)
                cx = max(0.0, min(1.0, float(r.box_x) + float(r.box_w) / 2.0))
                cy = max(0.0, min(1.0, float(r.box_y) + float(r.box_h) / 2.0))
                w = max(0.0, min(1.0, float(r.box_w)))
                h = max(0.0, min(1.0, float(r.box_h)))

                base_name = Path(r.image_path).stem
                # Add image
                with open(r.image_path, "rb") as img_file:
                    zf.writestr(f"images/{base_name}.jpg", img_file.read())

                # Add label line
                label_line = f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n"
                zf.writestr(f"labels/{base_name}.txt", label_line)

        zip_buf.seek(0)
        return zip_buf

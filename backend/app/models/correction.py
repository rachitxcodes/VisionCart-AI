import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


class DetectionCorrection(Base):
    __tablename__ = "detection_corrections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
        index=True,
    )
    session_id = Column(String(100), nullable=True)
    cashier_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    correction_type = Column(String(50), nullable=False)  # 'wrong_item' | 'unknown_item' | 'false_positive'
    predicted_class = Column(String(100), nullable=True)
    predicted_conf = Column(Float, nullable=True)

    # Normalized bounding box coordinates [0.0 - 1.0]
    box_x = Column(Float, nullable=True)
    box_y = Column(Float, nullable=True)
    box_w = Column(Float, nullable=True)
    box_h = Column(Float, nullable=True)

    corrected_product_id = Column(
        Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    corrected_label = Column(String(100), nullable=True, index=True)
    image_path = Column(String(255), nullable=False)
    frame_width = Column(Integer, nullable=True)
    frame_height = Column(Integer, nullable=True)

    cashier = relationship("User", foreign_keys=[cashier_user_id])
    corrected_product = relationship("Product", foreign_keys=[corrected_product_id])

    __table_args__ = (
        Index("ix_detection_corrections_created_at", "created_at"),
        Index("ix_detection_corrections_corrected_label", "corrected_label"),
    )

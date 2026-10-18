"""VisionCart AI ML Module: Detector Reference Interface.

This module provides direct access to the Detector, MockDetector,
and YOLODetector implementations for standalone testing or ML pipelines.
"""

from app.services.detector_service import (
    Detector,
    MockDetector,
    YOLODetector,
    get_detector,
    load_image_from_bytes,
    load_image_from_base64,
)

__all__ = [
    "Detector",
    "MockDetector",
    "YOLODetector",
    "get_detector",
    "load_image_from_bytes",
    "load_image_from_base64",
]


import base64
import io
import time
from abc import ABC, abstractmethod
from typing import List, Optional, Tuple

import numpy as np
from PIL import Image

from app.core.config import settings
from app.core.logging import logger
from app.schemas.detector import Detection, BoundingBox


class Detector(ABC):
    """Abstract Base Class defining the service interface for all object detection backends."""

    @abstractmethod
    def detect(self, image: np.ndarray) -> Tuple[List[Detection], float]:
        """Run object detection on an RGB numpy image array.
        Returns:
            Tuple of (list of Detection objects, inference time in milliseconds)
        """
        pass


class MockDetector(Detector):
    """Deterministic Mock Detector for unit testing, CI pipelines, and environments without GPU or camera."""

    def __init__(self):
        logger.info("[MockDetector] Initialized deterministic mock detector.")

    def detect(self, image: np.ndarray) -> Tuple[List[Detection], float]:
        start = time.perf_counter()
        h, w = image.shape[:2]

        # Return realistic, deterministic bounding boxes scaled to input image resolution
        detections = [
            Detection(
                class_id=46,  # COCO banana class ID
                class_name="banana",
                confidence=0.92,
                box=BoundingBox(
                    x1=float(w * 0.15),
                    y1=float(h * 0.20),
                    x2=float(w * 0.45),
                    y2=float(h * 0.70),
                ),
            ),
            Detection(
                class_id=39,  # COCO bottle class ID
                class_name="bottle",
                confidence=0.88,
                box=BoundingBox(
                    x1=float(w * 0.55),
                    y1=float(h * 0.15),
                    x2=float(w * 0.85),
                    y2=float(h * 0.85),
                ),
            ),
        ]
        duration_ms = (time.perf_counter() - start) * 1000.0
        return detections, duration_ms


class YOLODetector(Detector):
    """YOLOv8 Object Detector with automatic CPU/GPU selection and lazy weights initialization."""

    def __init__(self, model_path: Optional[str] = None, conf_threshold: Optional[float] = None):
        self.model_path = model_path or settings.MODEL_PATH
        self.conf_threshold = conf_threshold or settings.CONFIDENCE_THRESHOLD
        self._model = None
        self._device = self._select_device()

    def _select_device(self) -> str:
        if settings.DETECTOR_DEVICE and settings.DETECTOR_DEVICE.lower() != "auto":
            return settings.DETECTOR_DEVICE.lower()
        try:
            import torch
            if torch.cuda.is_available():
                logger.info("[YOLODetector] NVIDIA CUDA GPU detected and selected for inference.")
                return "cuda"
        except Exception:
            pass
        logger.info("[YOLODetector] Running inference on CPU.")
        return "cpu"

    @property
    def model(self):
        if self._model is None:
            from ultralytics import YOLO
            logger.info(f"[YOLODetector] Loading YOLO weights from: {self.model_path}")
            try:
                self._model = YOLO(self.model_path)
            except Exception as exc:
                logger.error(f"[YOLODetector] Failed to load YOLO weights at {self.model_path}: {exc}")
                raise RuntimeError(f"Failed to load YOLO model '{self.model_path}': {exc}")
        return self._model

    def detect(self, image: np.ndarray) -> Tuple[List[Detection], float]:
        start = time.perf_counter()
        results = self.model.predict(
            source=image,
            conf=self.conf_threshold,
            device=self._device,
            verbose=False,
        )
        duration_ms = (time.perf_counter() - start) * 1000.0

        detections: List[Detection] = []
        if not results or len(results) == 0:
            return detections, duration_ms

        res = results[0]
        boxes = res.boxes
        if boxes is None or len(boxes) == 0:
            return detections, duration_ms

        names = res.names
        for box in boxes:
            cls_id = int(box.cls[0].item())
            cls_name = names.get(cls_id, f"class_{cls_id}")
            conf = float(box.conf[0].item())
            xyxy = box.xyxy[0].tolist()  # [x1, y1, x2, y2]

            detections.append(
                Detection(
                    class_id=cls_id,
                    class_name=cls_name.lower(),
                    confidence=round(conf, 4),
                    box=BoundingBox(
                        x1=round(xyxy[0], 2),
                        y1=round(xyxy[1], 2),
                        x2=round(xyxy[2], 2),
                        y2=round(xyxy[3], 2),
                    ),
                )
            )

        return detections, duration_ms


def load_image_from_bytes(data: bytes) -> np.ndarray:
    """Decode raw image bytes (JPEG, PNG, WebP) into an RGB numpy array."""
    try:
        image = Image.open(io.BytesIO(data))
        if image.mode != "RGB":
            image = image.convert("RGB")
        return np.array(image)
    except Exception as exc:
        raise ValueError(f"Failed to decode image from bytes: {exc}")


def load_image_from_base64(b64_string: str) -> np.ndarray:
    """Decode a base64 encoded image string (with or without data URI header) into an RGB numpy array."""
    try:
        if "," in b64_string:
            b64_string = b64_string.split(",", 1)[1]
        decoded = base64.b64decode(b64_string)
        return load_image_from_bytes(decoded)
    except Exception as exc:
        raise ValueError(f"Failed to decode base64 image: {exc}")


# Detector Singleton Instance
_detector_instance: Optional[Detector] = None


def get_detector() -> Detector:
    global _detector_instance
    if _detector_instance is None:
        mode = settings.DETECTOR_MODE.strip().lower()
        if mode in ("real", "yolo"):
            logger.info(f"[DetectorService] Initializing YOLODetector in real mode (mode={mode}).")
            _detector_instance = YOLODetector()
        elif mode == "mock":
            logger.info("[DetectorService] Initializing MockDetector (mock mode).")
            _detector_instance = MockDetector()
        else:
            raise RuntimeError(f"Invalid DETECTOR_MODE '{settings.DETECTOR_MODE}'. Must be 'real', 'yolo', or 'mock'.")
    return _detector_instance


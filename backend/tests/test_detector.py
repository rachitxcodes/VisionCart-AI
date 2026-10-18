import io
import base64
import numpy as np
from PIL import Image
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings
from app.services.detector_service import MockDetector, Detector


def create_test_image_bytes(width: int = 640, height: int = 480) -> bytes:
    """Generate a clean synthetic test JPEG image."""
    img_array = np.zeros((height, width, 3), dtype=np.uint8)
    # Add simple colored patches
    img_array[50:200, 50:200] = [255, 255, 0]  # Yellow patch (banana-like)
    img_array[50:350, 300:450] = [0, 100, 255]  # Blue patch (bottle-like)
    img = Image.fromarray(img_array)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
async def cashier_headers():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login",
            json={"email": settings.SEED_CASHIER_EMAIL, "password": settings.SEED_CASHIER_PASSWORD},
        )
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}


def test_mock_detector_unit():
    """Verify MockDetector service interface returns valid bounding boxes."""
    detector: Detector = MockDetector()
    synthetic_img = np.zeros((480, 640, 3), dtype=np.uint8)
    detections, inference_time = detector.detect(synthetic_img)

    assert isinstance(detections, list)
    assert len(detections) >= 2
    assert inference_time >= 0

    class_names = [d.class_name for d in detections]
    assert "banana" in class_names
    assert "bottle" in class_names

    for d in detections:
        assert d.confidence >= 0.5
        assert 0 <= d.box.x1 < d.box.x2 <= 640
        assert 0 <= d.box.y1 < d.box.y2 <= 480


@pytest.mark.asyncio
async def test_detect_endpoint_multipart_upload(cashier_headers):
    """Verify POST /api/detection/detect with file upload and catalog enrichment."""
    transport = ASGITransport(app=app)
    test_jpeg = create_test_image_bytes(640, 480)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/detection/detect",
            files={"file": ("frame.jpg", test_jpeg, "image/jpeg")},
            headers=cashier_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["frame_width"] == 640
        assert data["frame_height"] == 480
        assert "inference_time_ms" in data
        assert len(data["detections"]) >= 2

        # Verify product catalog mapping
        banana_det = next((d for d in data["detections"] if d["class_name"] == "banana"), None)
        assert banana_det is not None
        assert banana_det["product_id"] is not None
        assert banana_det["product_name"] == "Fresh Organic Banana"
        assert banana_det["price_paise"] == 6000


@pytest.mark.asyncio
async def test_detect_endpoint_base64(cashier_headers):
    """Verify POST /api/detection/detect-base64 with webcam data URI."""
    transport = ASGITransport(app=app)
    test_jpeg = create_test_image_bytes(320, 240)
    b64_str = "data:image/jpeg;base64," + base64.b64encode(test_jpeg).decode("utf-8")

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/detection/detect-base64",
            json={"image": b64_str},
            headers=cashier_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["frame_width"] == 320
        assert data["frame_height"] == 240
        assert len(data["detections"]) >= 2


@pytest.mark.asyncio
async def test_detect_corrupt_image_error(cashier_headers):
    """Verify invalid image data yields clean HTTP 400 response."""
    transport = ASGITransport(app=app)
    corrupt_bytes = b"NOT_A_VALID_JPEG_HEADER"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/detection/detect",
            files={"file": ("bad.jpg", corrupt_bytes, "image/jpeg")},
            headers=cashier_headers,
        )
        assert response.status_code == 400
        assert "Invalid image format" in response.json()["detail"]


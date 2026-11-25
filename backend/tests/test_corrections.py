import io
import json
import os
import zipfile
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings
from app.services.cart_service import cart_manager


def create_jpeg_bytes(width: int = 64, height: int = 64) -> bytes:
    """Create a minimal valid JPEG image."""
    from PIL import Image
    import numpy as np

    img = Image.fromarray(np.full((height, width, 3), 128, dtype=np.uint8))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
async def cashier_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login",
            json={"email": settings.SEED_CASHIER_EMAIL, "password": settings.SEED_CASHIER_PASSWORD},
        )
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def admin_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login",
            json={"email": settings.SEED_ADMIN_EMAIL, "password": settings.SEED_ADMIN_PASSWORD},
        )
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_review_candidate_classification_and_suppression(cashier_auth):
    """Test candidate classification: accept >= 0.50, review between 0.25-0.50, unmapped to review, suppression."""
    transport = ASGITransport(app=app)
    session_id = "test_review_flow_session"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Clear cart at start of sale
        await client.post(f"/api/cart/clear?session_id={session_id}", headers=cashier_auth)

        # Frame 1:
        # - "banana" conf=0.92 (mapped, >= 0.50 -> cart candidate)
        # - "bottle" conf=0.38 (mapped, 0.25 <= conf < 0.50 -> review candidate)
        # - "chair" conf=0.75 (unmapped product, >= 0.25 -> review candidate)
        # - "book" conf=0.15 (below 0.25 -> ignored)
        payload1 = {
            "session_id": session_id,
            "detections": [
                {"class_name": "banana", "confidence": 0.92, "box": {"x1": 10, "y1": 10, "x2": 100, "y2": 100}},
                {"class_name": "bottle", "confidence": 0.38, "box": {"x1": 120, "y1": 20, "x2": 200, "y2": 250}},
                {"class_name": "chair", "confidence": 0.75, "box": {"x1": 220, "y1": 50, "x2": 400, "y2": 350}},
                {"class_name": "book", "confidence": 0.15, "box": {"x1": 50, "y1": 50, "x2": 80, "y2": 80}},
            ],
            "frame_width": 640,
            "frame_height": 480,
        }

        # Frame 1: candidates build 1 streak; stability rule requires >= 2 frames
        res1 = await client.post("/api/cart/sync", json=payload1, headers=cashier_auth)
        assert res1.status_code == 200
        data1 = res1.json()
        assert len(data1["review_candidates"]) == 0

        # Frame 2: repeat same detections -> candidates now have streak >= 2 -> offered!
        res2 = await client.post("/api/cart/sync", json=payload1, headers=cashier_auth)
        assert res2.status_code == 200
        data2 = res2.json()

        candidates = data2["review_candidates"]
        assert len(candidates) == 2
        classes = [c["predicted_class"] for c in candidates]
        assert "bottle" in classes
        assert "chair" in classes
        assert "book" not in classes

        bottle_cand = next(c for c in candidates if c["predicted_class"] == "bottle")
        assert bottle_cand["confidence"] == 0.38
        assert bottle_cand["mapped_product_id"] is not None  # mapped to mineral water bottle
        assert bottle_cand["box"]["w"] > 0

        chair_cand = next(c for c in candidates if c["predicted_class"] == "chair")
        assert chair_cand["mapped_product_id"] is None  # unmapped product

        # Dismiss candidate "chair"
        dismiss_resp = await client.post(
            "/api/cart/review-candidate/dismiss",
            json={"session_id": session_id, "predicted_class": "chair"},
            headers=cashier_auth,
        )
        assert dismiss_resp.status_code == 200

        # Frame 3: same payload, but "chair" is now suppressed
        res3 = await client.post("/api/cart/sync", json=payload1, headers=cashier_auth)
        assert res3.status_code == 200
        data3 = res3.json()
        classes3 = [c["predicted_class"] for c in data3["review_candidates"]]
        assert "chair" not in classes3
        assert "bottle" in classes3

        # Clear cart (new sale): resets suppression
        await client.post(f"/api/cart/clear?session_id={session_id}", headers=cashier_auth)
        # Feed 2 frames with chair again: should qualify again after reset
        await client.post("/api/cart/sync", json=payload1, headers=cashier_auth)
        res_after_clear = await client.post("/api/cart/sync", json=payload1, headers=cashier_auth)
        classes_after_clear = [c["predicted_class"] for c in res_after_clear.json()["review_candidates"]]
        assert "chair" in classes_after_clear


@pytest.mark.asyncio
async def test_corrections_api_crud_and_rbac(cashier_auth, admin_auth):
    """Test full corrections API: Cashier can log; Admin can view, query stats, export, and delete."""
    transport = ASGITransport(app=app)
    jpeg_data = create_jpeg_bytes(100, 100)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Cashier logs a 'wrong_item' correction
        meta_wrong = {
            "session_id": "sess_corr_1",
            "correction_type": "wrong_item",
            "predicted_class": "bottle",
            "predicted_conf": 0.42,
            "box_x": 0.1,
            "box_y": 0.15,
            "box_w": 0.3,
            "box_h": 0.4,
            "corrected_label": "banana",
            "frame_width": 640,
            "frame_height": 480,
        }

        resp_create = await client.post(
            "/api/corrections",
            files={"frame": ("frame.jpg", jpeg_data, "image/jpeg")},
            data={"meta": json.dumps(meta_wrong)},
            headers=cashier_auth,
        )
        assert resp_create.status_code == 201
        corr_id = resp_create.json()["id"]

        # Also log an 'unknown_item' correction
        meta_unknown = {
            "session_id": "sess_corr_1",
            "correction_type": "unknown_item",
            "predicted_class": "donut",
            "predicted_conf": 0.65,
            "box_x": 0.2,
            "box_y": 0.2,
            "box_w": 0.25,
            "box_h": 0.25,
            "corrected_label": "donut",
            "frame_width": 640,
            "frame_height": 480,
        }
        resp_unknown = await client.post(
            "/api/corrections",
            files={"frame": ("frame.jpg", jpeg_data, "image/jpeg")},
            data={"meta": json.dumps(meta_unknown)},
            headers=cashier_auth,
        )
        assert resp_unknown.status_code == 201

        # Also log a 'false_positive' correction
        meta_fp = {
            "session_id": "sess_corr_1",
            "correction_type": "false_positive",
            "predicted_class": "person",
            "predicted_conf": 0.77,
        }
        resp_fp = await client.post(
            "/api/corrections",
            files={"frame": ("frame.jpg", jpeg_data, "image/jpeg")},
            data={"meta": json.dumps(meta_fp)},
            headers=cashier_auth,
        )
        assert resp_fp.status_code == 201

        # 2. RBAC: Cashier CANNOT list or delete corrections (expect 403)
        res_cashier_list = await client.get("/api/corrections", headers=cashier_auth)
        assert res_cashier_list.status_code == 403

        res_cashier_delete = await client.delete(f"/api/corrections/{corr_id}", headers=cashier_auth)
        assert res_cashier_delete.status_code == 403

        # 3. Admin lists corrections
        res_admin_list = await client.get("/api/corrections", headers=admin_auth)
        assert res_admin_list.status_code == 200
        items = res_admin_list.json()["items"]
        assert len(items) >= 3

        # 4. View image via authenticated route
        res_img = await client.get(f"/api/corrections/{corr_id}/image", headers=cashier_auth)
        assert res_img.status_code == 200
        assert res_img.headers["content-type"] == "image/jpeg"
        assert len(res_img.content) > 0

        # 5. Admin stats endpoint
        res_stats = await client.get("/api/corrections/stats", headers=admin_auth)
        assert res_stats.status_code == 200
        stats = res_stats.json()
        assert stats["total"] >= 3
        assert stats["by_type"]["wrong_item"] >= 1
        assert stats["by_type"]["unknown_item"] >= 1
        assert stats["by_type"]["false_positive"] >= 1

        # 6. Admin export ZIP (YOLO format)
        res_export = await client.get("/api/corrections/export", headers=admin_auth)
        assert res_export.status_code == 200
        assert res_export.headers["content-type"] == "application/zip"

        zip_bytes = res_export.content
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            namelist = zf.namelist()
            assert "classes.txt" in namelist
            assert "README.txt" in namelist
            classes_content = zf.read("classes.txt").decode("utf-8")
            assert "banana" in classes_content
            # At least one image and label for the exportable records
            has_images = any(n.startswith("images/") and n.endswith(".jpg") for n in namelist)
            has_labels = any(n.startswith("labels/") and n.endswith(".txt") for n in namelist)
            assert has_images
            assert has_labels

        # 7. Admin delete correction removes record and file
        res_del = await client.delete(f"/api/corrections/{corr_id}", headers=admin_auth)
        assert res_del.status_code == 200

        # Verify record no longer accessible
        res_img_deleted = await client.get(f"/api/corrections/{corr_id}/image", headers=admin_auth)
        assert res_img_deleted.status_code == 404


@pytest.mark.asyncio
async def test_corrections_validation_and_cart_safety(cashier_auth):
    """Verify validation on file size, magic bytes, invalid correction_type, and cart isolation."""
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Invalid magic bytes (PNG disguised as JPG)
        fake_bytes = b"\x89PNG\r\n\x1a\nNot a real jpeg"
        meta = {"correction_type": "wrong_item", "predicted_class": "banana"}
        res_bad_magic = await client.post(
            "/api/corrections",
            files={"frame": ("frame.jpg", fake_bytes, "image/jpeg")},
            data={"meta": json.dumps(meta)},
            headers=cashier_auth,
        )
        assert res_bad_magic.status_code == 400
        assert "valid magic bytes" in res_bad_magic.json()["detail"].lower()

        # 2. Invalid correction type
        meta_bad_type = {"correction_type": "invalid_type_name"}
        jpeg_data = create_jpeg_bytes(10, 10)
        res_bad_type = await client.post(
            "/api/corrections",
            files={"frame": ("frame.jpg", jpeg_data, "image/jpeg")},
            data={"meta": json.dumps(meta_bad_type)},
            headers=cashier_auth,
        )
        assert res_bad_type.status_code == 422

        # 3. Oversized file (> 2MB)
        huge_bytes = b"\xff\xd8\xff" + b"\x00" * (3 * 1024 * 1024)
        res_huge = await client.post(
            "/api/corrections",
            files={"frame": ("huge.jpg", huge_bytes, "image/jpeg")},
            data={"meta": json.dumps(meta)},
            headers=cashier_auth,
        )
        assert res_huge.status_code == 413

        # 4. Cart isolation: a failed correction upload NEVER changes active cart state
        session_id = "test_cart_safety_session"
        await client.post(f"/api/cart/clear?session_id={session_id}", headers=cashier_auth)
        # Add a banana
        for _ in range(3):
            await client.post(
                "/api/cart/sync",
                json={"session_id": session_id, "detected_classes": ["banana"]},
                headers=cashier_auth,
            )
        cart_before = await client.get(f"/api/cart?session_id={session_id}", headers=cashier_auth)
        assert cart_before.json()["total_items"] == 1

        # Attempt failing correction
        await client.post(
            "/api/corrections",
            files={"frame": ("bad.jpg", fake_bytes, "image/jpeg")},
            data={"meta": json.dumps(meta_bad_type)},
            headers=cashier_auth,
        )

        cart_after = await client.get(f"/api/cart?session_id={session_id}", headers=cashier_auth)
        assert cart_after.json()["total_items"] == 1
        assert cart_after.json()["items"][0]["sku"] == "PRD-BAN-001"

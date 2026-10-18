import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings
from app.services.cart_service import TemporalFrameSmoother


def test_temporal_frame_smoother_hysteresis():
    """Unit test for temporal smoothing: N consecutive frames to add, M frames absence to remove, flicker suppression."""
    smoother = TemporalFrameSmoother(n_frames=3, m_frames=5)

    # 1. Appearance for 1 frame -> Not yet confirmed
    res1 = smoother.update(["banana"])
    assert res1.get("banana", 0) == 0

    # 2. Appearance for 2nd frame -> Not yet confirmed
    res2 = smoother.update(["banana"])
    assert res2.get("banana", 0) == 0

    # 3. Appearance for 3rd frame (N=3) -> Confirmed!
    res3 = smoother.update(["banana"])
    assert res3.get("banana") == 1

    # 4. Flicker Suppression: Item absent for 1 frame (< M=5)
    res4 = smoother.update([])
    assert res4.get("banana") == 1, "Item should not flicker away after 1 missing frame!"

    # 5. Item returns on frame 5
    res5 = smoother.update(["banana"])
    assert res5.get("banana") == 1

    # 6. Absence for 5 consecutive frames (M=5) -> Item drops to 0
    for _ in range(4):
        smoother.update([])
        assert smoother.confirmed_counts.get("banana") == 1
    # 5th absent frame
    res_final = smoother.update([])
    assert res_final.get("banana", 0) == 0, "Item should be removed after M=5 absent frames!"


def test_multi_quantity_hysteresis():
    """Verify that multiple items of the same class require N frames to increment."""
    smoother = TemporalFrameSmoother(n_frames=3, m_frames=5)

    # Confirm 1st item
    for _ in range(3):
        smoother.update(["bottle"])
    assert smoother.confirmed_counts.get("bottle") == 1

    # Present 2 bottles
    smoother.update(["bottle", "bottle"])
    assert smoother.confirmed_counts.get("bottle") == 1  # 2nd bottle not yet confirmed
    smoother.update(["bottle", "bottle"])
    assert smoother.confirmed_counts.get("bottle") == 1
    res = smoother.update(["bottle", "bottle"])
    assert res.get("bottle") == 2  # 2nd bottle confirmed!


@pytest.fixture
async def cashier_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login",
            json={"email": settings.SEED_CASHIER_EMAIL, "password": settings.SEED_CASHIER_PASSWORD},
        )
        token = resp.json()["access_token"]
        client.headers.update({"Authorization": f"Bearer {token}"})
        yield client


@pytest.mark.asyncio
async def test_cart_sync_and_unmapped_classes(cashier_client):
    """Verify frame sync maps COCO classes to catalog and ignores unmapped classes."""
    client = cashier_client
    session_id = "test_sync_session"

    # Clear before test
    await client.post(f"/api/cart/clear?session_id={session_id}")

    # Feed 3 frames with "banana", "bottle", and an unmapped class "backpack"
    for _ in range(3):
        resp = await client.post(
            "/api/cart/sync-frame",
            json={
                "session_id": session_id,
                "detected_classes": ["banana", "bottle", "backpack", "person"],
            },
        )
        assert resp.status_code == 200

    data = resp.json()
    assert data["total_items"] == 2
    skus = [i["sku"] for i in data["items"]]
    assert "PRD-BAN-001" in skus
    assert "PRD-BOT-004" in skus
    # Verify unmapped classes ("backpack", "person") are NOT in cart
    names = [i["product_name"] for i in data["items"]]
    assert not any("backpack" in n.lower() or "person" in n.lower() for n in names)

    # Verify Tax and Totals
    banana_item = next(i for i in data["items"] if i["sku"] == "PRD-BAN-001")
    bottle_item = next(i for i in data["items"] if i["sku"] == "PRD-BOT-004")
    assert banana_item["taxable_value_paise"] == 6000
    assert banana_item["cgst_paise"] == 0  # 0% GST
    assert bottle_item["taxable_value_paise"] == 4000
    assert bottle_item["cgst_paise"] == 360  # 18% GST -> 9% CGST = 360 paise
    assert bottle_item["sgst_paise"] == 360  # 9% SGST = 360 paise
    assert bottle_item["line_total_paise"] == 4720

    # Total cart paise
    assert data["subtotal_paise"] == 10000
    assert data["cgst_paise"] == 360
    assert data["sgst_paise"] == 360
    assert data["total_paise"] == 10720


@pytest.mark.asyncio
async def test_cart_manual_overrides(cashier_client):
    """Verify cashier manual quantity changes and item removal."""
    client = cashier_client
    session_id = "test_manual_session"
    await client.post(f"/api/cart/clear?session_id={session_id}")

    # Feed 3 frames with banana
    for _ in range(3):
        resp = await client.post(
            "/api/cart/sync-frame",
            json={"session_id": session_id, "detected_classes": ["banana"]},
        )

    banana_item = resp.json()["items"][0]
    prod_id = banana_item["product_id"]
    assert banana_item["quantity"] == 1

    # 1. Manually increase banana to quantity 4
    resp_update = await client.post(
        f"/api/cart/item?session_id={session_id}",
        json={"product_id": prod_id, "quantity": 4},
    )
    assert resp_update.status_code == 200
    updated_items = resp_update.json()["items"]
    assert len(updated_items) == 1
    assert updated_items[0]["quantity"] == 4
    assert updated_items[0]["is_manual"] is True
    assert updated_items[0]["taxable_value_paise"] == 24000

    # 2. Manually add another product (e.g. Donut PRD-DON-007)
    prod_resp = await client.get("/api/products?search=donut")
    donut_id = prod_resp.json()[0]["id"]
    resp_donut = await client.post(
        f"/api/cart/item?session_id={session_id}",
        json={"product_id": donut_id, "quantity": 2},
    )
    assert resp_donut.status_code == 200
    cart_after_donut = resp_donut.json()
    assert cart_after_donut["total_items"] == 6

    # 3. Manually delete banana
    resp_del = await client.delete(f"/api/cart/item/{prod_id}?session_id={session_id}")
    assert resp_del.status_code == 200
    remaining_ids = [i["product_id"] for i in resp_del.json()["items"]]
    assert prod_id not in remaining_ids
    assert donut_id in remaining_ids

    # 4. Clear cart
    resp_clear = await client.post(f"/api/cart/clear?session_id={session_id}")
    assert resp_clear.status_code == 200
    resp_empty = await client.get(f"/api/cart?session_id={session_id}")
    assert resp_empty.json()["total_items"] == 0


import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings
from app.services.cart_service import TemporalFrameSmoother, cart_manager


def test_temporal_frame_smoother_no_removal_on_absence():
    """Unit test: N consecutive frames to confirm, NO removal on absence (even for 100+ frames)."""
    smoother = TemporalFrameSmoother(n_frames=3)

    # 1. Appearance for 1 frame -> Not yet confirmed
    res1 = smoother.update(["banana"])
    assert res1.get("banana", 0) == 0

    # 2. Appearance for 2nd frame -> Not yet confirmed
    res2 = smoother.update(["banana"])
    assert res2.get("banana", 0) == 0

    # 3. Appearance for 3rd frame (N=3) -> Confirmed at qty 1!
    res3 = smoother.update(["banana"])
    assert res3.get("banana") == 1

    # 4. Item leaves view for 1 frame -> stays in cart
    res4 = smoother.update([])
    assert res4.get("banana") == 1

    # 5. Item leaves view for 100+ frames -> remains in cart with qty 1 (NEVER auto-removed)
    for _ in range(105):
        res_empty = smoother.update([])
        assert res_empty.get("banana") == 1
    assert smoother.confirmed_counts.get("banana") == 1


def test_showing_one_item_repeatedly_keeps_quantity_one():
    """Verify showing 1 item repeatedly keeps quantity 1 (not summed across appearances)."""
    smoother = TemporalFrameSmoother(n_frames=3)

    # First appearance: 3 frames
    for _ in range(3):
        smoother.update(["banana"])
    assert smoother.confirmed_counts.get("banana") == 1

    # Leave view for 10 frames
    for _ in range(10):
        smoother.update([])
    assert smoother.confirmed_counts.get("banana") == 1

    # Second appearance of same 1 item for 5 frames -> stays 1, not 2
    for _ in range(5):
        res = smoother.update(["banana"])
        assert res.get("banana") == 1

    # Leave view again for 20 frames
    for _ in range(20):
        smoother.update([])
    assert smoother.confirmed_counts.get("banana") == 1

    # Third appearance for 10 frames -> still stays 1
    for _ in range(10):
        res = smoother.update(["banana"])
        assert res.get("banana") == 1


def test_two_items_together_gives_quantity_two_and_stays_when_one_leaves():
    """Verify 2 items together confirms qty 2, and stays 2 when one or both leave."""
    smoother = TemporalFrameSmoother(n_frames=3)

    # 2 bottles presented together for 3 frames
    smoother.update(["bottle", "bottle"])
    smoother.update(["bottle", "bottle"])
    res = smoother.update(["bottle", "bottle"])
    assert res.get("bottle") == 2

    # One bottle leaves view (only 1 bottle seen for 10 frames) -> stays 2!
    for _ in range(10):
        res_one = smoother.update(["bottle"])
        assert res_one.get("bottle") == 2

    # Both bottles leave view for 100+ frames -> stays 2!
    for _ in range(100):
        res_none = smoother.update([])
        assert res_none.get("bottle") == 2


def test_smoother_reset_after_clear():
    """Verify smoother reset clears all confirmed counts and streaks."""
    smoother = TemporalFrameSmoother(n_frames=3)
    for _ in range(3):
        smoother.update(["banana", "bottle"])
    assert smoother.confirmed_counts.get("banana") == 1
    assert smoother.confirmed_counts.get("bottle") == 1

    smoother.reset()
    assert len(smoother.confirmed_counts) == 0
    assert len(smoother.candidate_streaks) == 0


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
    """Verify frame sync maps COCO classes to catalog, ignores unmapped classes, and retains items on absence."""
    client = cashier_client
    session_id = "test_sync_session"

    # Clear before test
    await client.post(f"/api/cart/clear?session_id={session_id}")

    # Feed 3 frames with "banana", "bottle", and unmapped classes "backpack", "person"
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

    # Feed 10 empty frames: items MUST remain in the cart
    for _ in range(10):
        resp_empty = await client.post(
            "/api/cart/sync-frame",
            json={"session_id": session_id, "detected_classes": []},
        )
        assert resp_empty.json()["total_items"] == 2


@pytest.mark.asyncio
async def test_cart_manual_overrides(cashier_client):
    """Verify cashier manual quantity changes, downward protection, and item removal."""
    client = cashier_client
    session_id = "test_manual_session"
    await client.post(f"/api/cart/clear?session_id={session_id}")

    # Feed 3 frames with banana -> quantity 1
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

    # 2. Camera frames with 1 banana arrive: manual edit is respected, quantity stays 4
    for _ in range(5):
        resp_lower = await client.post(
            "/api/cart/sync-frame",
            json={"session_id": session_id, "detected_classes": ["banana"]},
        )
        assert resp_lower.json()["items"][0]["quantity"] == 4

    # 3. Manually add another product (e.g. Donut PRD-DON-007)
    prod_resp = await client.get("/api/products?search=donut")
    donut_id = prod_resp.json()[0]["id"]
    resp_donut = await client.post(
        f"/api/cart/item?session_id={session_id}",
        json={"product_id": donut_id, "quantity": 2},
    )
    assert resp_donut.status_code == 200
    cart_after_donut = resp_donut.json()
    assert cart_after_donut["total_items"] == 6

    # 4. Manually delete banana
    resp_del = await client.delete(f"/api/cart/item/{prod_id}?session_id={session_id}")
    assert resp_del.status_code == 200
    remaining_ids = [i["product_id"] for i in resp_del.json()["items"]]
    assert prod_id not in remaining_ids
    assert donut_id in remaining_ids

    # 5. Clear cart: resets all state
    resp_clear = await client.post(f"/api/cart/clear?session_id={session_id}")
    assert resp_clear.status_code == 200
    resp_empty = await client.get(f"/api/cart?session_id={session_id}")
    assert resp_empty.json()["total_items"] == 0

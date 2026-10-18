import asyncio
import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings


@pytest.fixture
async def admin_and_cashier_tokens():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Admin login
        adm_resp = await client.post(
            "/api/auth/login",
            json={"email": settings.SEED_ADMIN_EMAIL, "password": settings.SEED_ADMIN_PASSWORD},
        )
        adm_token = adm_resp.json()["access_token"]

        # Cashier login
        csh_resp = await client.post(
            "/api/auth/login",
            json={"email": settings.SEED_CASHIER_EMAIL, "password": settings.SEED_CASHIER_PASSWORD},
        )
        csh_token = csh_resp.json()["access_token"]

        return {
            "admin": {"Authorization": f"Bearer {adm_token}"},
            "cashier": {"Authorization": f"Bearer {csh_token}"},
        }


@pytest.mark.asyncio
async def test_idempotency_retry_returns_same_invoice(admin_and_cashier_tokens):
    """Verify that retrying a checkout with the identical idempotency key returns the same invoice without double deduction."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = admin_and_cashier_tokens["cashier"]

        # Create isolated test product with 20 stock
        adm_h = admin_and_cashier_tokens["admin"]
        prod_resp = await client.post(
            "/api/products",
            json={
                "sku": f"IDEMP-{uuid.uuid4().hex[:6]}",
                "name": "Idempotency Test Item",
                "price_paise": 1500,
                "gst_rate": 5,
                "stock": 20,
                "reorder_level": 5,
            },
            headers=adm_h,
        )
        prod = prod_resp.json()
        prod_id = prod["id"]

        idempotency_key = f"idemp_test_key_{uuid.uuid4().hex}"
        payload = {
            "idempotency_key": idempotency_key,
            "items": [{"product_id": prod_id, "quantity": 3}],
        }

        # 1. First checkout attempt
        resp1 = await client.post("/api/checkout", json=payload, headers=headers)
        assert resp1.status_code == 201
        inv1 = resp1.json()

        # Check stock decremented from 20 to 17
        stock_check1 = (await client.get(f"/api/products/{prod_id}", headers=headers)).json()
        assert stock_check1["stock"] == 17

        # 2. Immediate retry with the EXACT same idempotency key
        resp2 = await client.post("/api/checkout", json=payload, headers=headers)
        assert resp2.status_code in (200, 201)
        inv2 = resp2.json()

        # Verify same invoice returned
        assert inv1["id"] == inv2["id"]
        assert inv1["invoice_number"] == inv2["invoice_number"]
        assert inv1["total_paise"] == inv2["total_paise"]

        # Verify stock WAS NOT decremented again (still 17, not 14)
        stock_check2 = (await client.get(f"/api/products/{prod_id}", headers=headers)).json()
        assert stock_check2["stock"] == 17, "Idempotency failed: duplicate deduction occurred!"


@pytest.mark.asyncio
async def test_atomic_rollback_on_insufficient_stock(admin_and_cashier_tokens):
    """Verify that if one product has insufficient stock, the whole checkout transaction aborts with NO partial deductions."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        adm_h = admin_and_cashier_tokens["admin"]
        csh_h = admin_and_cashier_tokens["cashier"]

        # Product A: 10 in stock
        p1 = (await client.post(
            "/api/products",
            json={
                "sku": f"ROLL-A-{uuid.uuid4().hex[:6]}",
                "name": "Available Product A",
                "price_paise": 2000,
                "stock": 10,
                "reorder_level": 2,
            },
            headers=adm_h,
        )).json()

        # Product B: only 1 in stock
        p2 = (await client.post(
            "/api/products",
            json={
                "sku": f"ROLL-B-{uuid.uuid4().hex[:6]}",
                "name": "Scarce Product B",
                "price_paise": 3000,
                "stock": 1,
                "reorder_level": 1,
            },
            headers=adm_h,
        )).json()

        # Request 2 of Product A (available) and 5 of Product B (insufficient!)
        bad_payload = {
            "idempotency_key": f"rollback_key_{uuid.uuid4().hex}",
            "items": [
                {"product_id": p1["id"], "quantity": 2},
                {"product_id": p2["id"], "quantity": 5},
            ],
        }

        resp = await client.post("/api/checkout", json=bad_payload, headers=csh_h)
        assert resp.status_code == 400
        assert "Insufficient stock" in resp.json()["detail"]

        # Verify Product A stock was NOT decremented (remains 10)
        p1_after = (await client.get(f"/api/products/{p1['id']}", headers=csh_h)).json()
        assert p1_after["stock"] == 10, "Rollback failed: Product A suffered partial deduction!"

        # Verify Product B stock remains 1
        p2_after = (await client.get(f"/api/products/{p2['id']}", headers=csh_h)).json()
        assert p2_after["stock"] == 1


@pytest.mark.asyncio
async def test_concurrent_parallel_checkouts_no_oversell(admin_and_cashier_tokens):
    """Verify that multiple concurrent checkouts on a scarce item never oversell, exactly depleting to 0."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        adm_h = admin_and_cashier_tokens["admin"]
        csh_h = admin_and_cashier_tokens["cashier"]

        # Create product with exactly 5 units in stock
        scarce_prod = (await client.post(
            "/api/products",
            json={
                "sku": f"CONCUR-{uuid.uuid4().hex[:6]}",
                "name": "Limited Edition Sneaker",
                "price_paise": 50000,
                "stock": 5,
                "reorder_level": 1,
            },
            headers=adm_h,
        )).json()
        prod_id = scarce_prod["id"]

        # Concurrently launch 10 checkout tasks, each requesting 1 unit
        async def attempt_checkout():
            async with AsyncClient(transport=transport, base_url="http://test") as sub_client:
                payload = {
                    "idempotency_key": f"concur_{uuid.uuid4().hex}",
                    "items": [{"product_id": prod_id, "quantity": 1}],
                }
                return await sub_client.post("/api/checkout", json=payload, headers=csh_h)

        responses = await asyncio.gather(*(attempt_checkout() for _ in range(10)))

        success_count = sum(1 for r in responses if r.status_code == 201)
        insufficient_count = sum(1 for r in responses if r.status_code == 400)

        # Exactly 5 must succeed, and 5 must fail with HTTP 400
        assert success_count == 5, f"Expected 5 successful orders, got {success_count}"
        assert insufficient_count == 5, f"Expected 5 rejected orders, got {insufficient_count}"

        # Final stock must be exactly 0 (no overselling)
        final_prod = (await client.get(f"/api/products/{prod_id}", headers=csh_h)).json()
        assert final_prod["stock"] == 0, f"Expected 0 stock, got {final_prod['stock']}"


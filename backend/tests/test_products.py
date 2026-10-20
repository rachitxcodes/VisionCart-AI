import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings


@pytest.fixture
async def auth_headers():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Admin login
        admin_login = await client.post(
            "/api/auth/login",
            json={"email": settings.SEED_ADMIN_EMAIL, "password": settings.SEED_ADMIN_PASSWORD},
        )
        admin_token = admin_login.json()["access_token"]

        # Cashier login
        cashier_login = await client.post(
            "/api/auth/login",
            json={"email": settings.SEED_CASHIER_EMAIL, "password": settings.SEED_CASHIER_PASSWORD},
        )
        cashier_token = cashier_login.json()["access_token"]

        return {
            "admin": {"Authorization": f"Bearer {admin_token}"},
            "cashier": {"Authorization": f"Bearer {cashier_token}"},
        }


@pytest.mark.asyncio
async def test_list_and_search_products(auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = auth_headers["cashier"]

        # 1. List all products
        resp = await client.get("/api/products", headers=headers)
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) >= 10

        # 2. Filter by category
        resp_fruits = await client.get("/api/products?category=Fruits", headers=headers)
        assert resp_fruits.status_code == 200
        fruits = resp_fruits.json()
        assert all(f["category"] == "Fruits" for f in fruits)
        assert len(fruits) >= 3

        # 3. Search by name
        resp_search = await client.get("/api/products?search=banana", headers=headers)
        assert resp_search.status_code == 200
        banana = resp_search.json()
        assert len(banana) == 1
        assert "Banana" in banana[0]["name"]


@pytest.mark.asyncio
async def test_low_stock_query(auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Cashier blocked from low-stock endpoint (Admin only)
        resp_cashier = await client.get("/api/products/low-stock", headers=auth_headers["cashier"])
        assert resp_cashier.status_code == 403

        # 2. Admin successfully queries low stock items
        resp_admin = await client.get("/api/products/low-stock", headers=auth_headers["admin"])
        assert resp_admin.status_code == 200
        low_items = resp_admin.json()
        assert len(low_items) >= 2
        for item in low_items:
            assert item["stock"] <= item["reorder_level"]
            assert item["is_low_stock"] is True


@pytest.mark.asyncio
async def test_product_crud_lifecycle(auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_h = auth_headers["admin"]
        cashier_h = auth_headers["cashier"]

        unique_suffix = uuid.uuid4().hex[:8]
        new_prod = {
            "sku": f"TEST-CRU-{unique_suffix}",
            "name": "Organic Alphonso Mango",
            "category": "Fruits",
            "price_paise": 24000,
            "gst_rate": 0,
            "stock": 40,
            "reorder_level": 10,
            "detector_class": "mango",
        }

        # 1. Cashier denied creation
        resp_denied = await client.post("/api/products", json=new_prod, headers=cashier_h)
        assert resp_denied.status_code == 403

        # 2. Admin creates product
        resp_create = await client.post("/api/products", json=new_prod, headers=admin_h)
        assert resp_create.status_code == 201
        created = resp_create.json()
        prod_id = created["id"]
        assert created["sku"] == new_prod["sku"]
        assert created["stock"] == 40

        # 3. Duplicate SKU rejected
        resp_dup = await client.post("/api/products", json=new_prod, headers=admin_h)
        assert resp_dup.status_code == 400
        assert "already exists" in resp_dup.json()["detail"]

        # 4. Update product
        resp_update = await client.put(
            f"/api/products/{prod_id}",
            json={"price_paise": 22000, "name": "Premium Alphonso Mango"},
            headers=admin_h,
        )
        assert resp_update.status_code == 200
        updated = resp_update.json()
        assert updated["price_paise"] == 22000
        assert updated["name"] == "Premium Alphonso Mango"

        # 5. Stock adjustments: ADD, DEDUCT, SET
        # ADD 15
        resp_add = await client.post(
            f"/api/products/{prod_id}/adjust-stock",
            json={"action": "ADD", "quantity": 15, "reason": "RESTOCK_SHIPMENT"},
            headers=admin_h,
        )
        assert resp_add.status_code == 200
        assert resp_add.json()["stock"] == 55

        # DEDUCT 5
        resp_deduct = await client.post(
            f"/api/products/{prod_id}/adjust-stock",
            json={"action": "DEDUCT", "quantity": 5, "reason": "SPOILED_ITEMS"},
            headers=admin_h,
        )
        assert resp_deduct.status_code == 200
        assert resp_deduct.json()["stock"] == 50

        # DEDUCT exceeding available stock -> 400 Bad Request
        resp_over_deduct = await client.post(
            f"/api/products/{prod_id}/adjust-stock",
            json={"action": "DEDUCT", "quantity": 999, "reason": "ERROR_TEST"},
            headers=admin_h,
        )
        assert resp_over_deduct.status_code == 400
        assert "Cannot deduct" in resp_over_deduct.json()["detail"]

        # SET to 20
        resp_set = await client.post(
            f"/api/products/{prod_id}/adjust-stock",
            json={"action": "SET", "quantity": 20, "reason": "PHYSICAL_AUDIT_COUNT"},
            headers=admin_h,
        )
        assert resp_set.status_code == 200
        assert resp_set.json()["stock"] == 20

        # 6. Audit History
        resp_adj_history = await client.get(
            f"/api/products/{prod_id}/adjustments", headers=admin_h
        )
        assert resp_adj_history.status_code == 200
        history = resp_adj_history.json()
        assert len(history) >= 4  # Initial creation + ADD + DEDUCT + SET

        # 7. Delete (deactivate) product
        resp_del = await client.delete(f"/api/products/{prod_id}", headers=admin_h)
        assert resp_del.status_code == 200

        # Verify not in active list
        resp_active = await client.get("/api/products", headers=admin_h)
        active_ids = [p["id"] for p in resp_active.json()]
        assert prod_id not in active_ids


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
async def test_analytics_rbac_protection(auth_headers):
    """Verify that only Admin can access analytics endpoints; Cashier receives HTTP 403."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        cashier_h = auth_headers["cashier"]

        endpoints = [
            "/api/analytics/daily-revenue",
            "/api/analytics/top-products",
            "/api/analytics/kpis",
            "/api/analytics/low-stock",
        ]

        for ep in endpoints:
            resp = await client.get(ep, headers=cashier_h)
            assert resp.status_code == 403, f"Cashier should be forbidden from {ep}"


@pytest.mark.asyncio
async def test_analytics_endpoints_with_seeded_data(auth_headers):
    """Verify analytics endpoints return expected data calculated from the seeded 30-day historical invoices."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_h = auth_headers["admin"]

        # 1. Daily Revenue
        resp_rev = await client.get("/api/analytics/daily-revenue?days=30", headers=admin_h)
        assert resp_rev.status_code == 200
        daily_data = resp_rev.json()
        assert isinstance(daily_data, list)
        assert len(daily_data) > 0
        for entry in daily_data:
            assert "day" in entry
            assert "revenue_paise" in entry
            assert "invoice_count" in entry
            assert entry["revenue_paise"] >= 0
            assert entry["invoice_count"] >= 0

        # 2. Top Products
        resp_top = await client.get("/api/analytics/top-products?limit=5", headers=admin_h)
        assert resp_top.status_code == 200
        top_data = resp_top.json()
        assert isinstance(top_data, list)
        assert len(top_data) > 0
        assert len(top_data) <= 5
        for prod in top_data:
            assert "product_id" in prod
            assert "product_name" in prod
            assert "total_qty" in prod
            assert "total_revenue_paise" in prod
            assert prod["total_qty"] > 0

        # 3. Summary KPIs
        resp_kpi = await client.get("/api/analytics/kpis?days=30", headers=admin_h)
        assert resp_kpi.status_code == 200
        kpis = resp_kpi.json()
        assert "invoice_count" in kpis
        assert "total_revenue_paise" in kpis
        assert "avg_basket_value_paise" in kpis
        assert kpis["invoice_count"] >= 50
        assert kpis["total_revenue_paise"] > 0
        assert kpis["avg_basket_value_paise"] > 0

        # 4. Low-Stock Alerts
        resp_low = await client.get("/api/analytics/low-stock", headers=admin_h)
        assert resp_low.status_code == 200
        low_stock_items = resp_low.json()
        assert isinstance(low_stock_items, list)
        assert len(low_stock_items) >= 2
        for item in low_stock_items:
            assert item["stock"] <= item["reorder_level"]


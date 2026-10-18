import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings


@pytest.mark.asyncio
async def test_admin_and_cashier_login_success():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Admin Login
        admin_resp = await client.post(
            "/api/auth/login",
            json={
                "email": settings.SEED_ADMIN_EMAIL,
                "password": settings.SEED_ADMIN_PASSWORD,
            },
        )
        assert admin_resp.status_code == 200
        admin_data = admin_resp.json()
        assert "access_token" in admin_data
        assert admin_data["user"]["role"] == "ADMIN"
        assert admin_data["user"]["email"] == settings.SEED_ADMIN_EMAIL

        # 2. Cashier Login
        cashier_resp = await client.post(
            "/api/auth/login",
            json={
                "email": settings.SEED_CASHIER_EMAIL,
                "password": settings.SEED_CASHIER_PASSWORD,
            },
        )
        assert cashier_resp.status_code == 200
        cashier_data = cashier_resp.json()
        assert "access_token" in cashier_data
        assert cashier_data["user"]["role"] == "CASHIER"
        assert cashier_data["user"]["email"] == settings.SEED_CASHIER_EMAIL


@pytest.mark.asyncio
async def test_login_invalid_credentials():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login",
            json={"email": settings.SEED_ADMIN_EMAIL, "password": "WrongPassword!99"},
        )
        assert resp.status_code == 401
        assert "Invalid email or password" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_role_based_access_control():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Obtain Admin and Cashier tokens
        admin_login = await client.post(
            "/api/auth/login",
            json={"email": settings.SEED_ADMIN_EMAIL, "password": settings.SEED_ADMIN_PASSWORD},
        )
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        cashier_login = await client.post(
            "/api/auth/login",
            json={"email": settings.SEED_CASHIER_EMAIL, "password": settings.SEED_CASHIER_PASSWORD},
        )
        cashier_token = cashier_login.json()["access_token"]
        cashier_headers = {"Authorization": f"Bearer {cashier_token}"}

        # 1. Admin accessing admin-only endpoint -> 200 OK
        resp_admin = await client.get("/api/auth/admin-only", headers=admin_headers)
        assert resp_admin.status_code == 200
        assert "Access granted" in resp_admin.json()["message"]

        # 2. Cashier accessing admin-only endpoint -> 403 Forbidden
        resp_cashier_denied = await client.get("/api/auth/admin-only", headers=cashier_headers)
        assert resp_cashier_denied.status_code == 403
        assert "Administrator privileges required" in resp_cashier_denied.json()["detail"]

        # 3. Unauthenticated accessing admin-only endpoint -> 401 Unauthorized
        resp_anon = await client.get("/api/auth/admin-only")
        assert resp_anon.status_code == 401

        # 4. Both roles accessing cashier-or-admin endpoint -> 200 OK
        resp_admin_staff = await client.get("/api/auth/cashier-or-admin", headers=admin_headers)
        assert resp_admin_staff.status_code == 200

        resp_cashier_staff = await client.get("/api/auth/cashier-or-admin", headers=cashier_headers)
        assert resp_cashier_staff.status_code == 200

        # 5. Get current profile /api/auth/me
        me_resp = await client.get("/api/auth/me", headers=cashier_headers)
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == settings.SEED_CASHIER_EMAIL


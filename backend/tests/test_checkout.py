import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings


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
async def test_gst_invoice_calculation_known_inputs(cashier_client):
    """Verify GST calculations, line-level CGST/SGST splits, and invoice totals against deterministic inputs."""
    client = cashier_client

    # Fetch Banana (0% GST), Bottle (18% GST), Cup (12% GST)
    prod_resp = await client.get("/api/products")
    prods = {p["sku"]: p for p in prod_resp.json()}

    banana = prods["PRD-BAN-001"]  # 6000 paise, 0% GST
    bottle = prods["PRD-BOT-004"]  # 4000 paise, 18% GST
    cup = prods["PRD-CUP-005"]     # 25000 paise, 12% GST

    initial_banana_stock = banana["stock"]
    initial_bottle_stock = bottle["stock"]
    initial_cup_stock = cup["stock"]

    idempotency_key = f"test_gst_{uuid.uuid4()}"
    checkout_payload = {
        "idempotency_key": idempotency_key,
        "items": [
            {"product_id": banana["id"], "quantity": 2},
            {"product_id": bottle["id"], "quantity": 3},
            {"product_id": cup["id"], "quantity": 1},
        ],
    }

    resp = await client.post("/api/checkout", json=checkout_payload)
    assert resp.status_code == 201
    invoice = resp.json()

    # 1. Invoice Number format verification (INV-YYYYMMDD-XXXX)
    assert invoice["invoice_number"].startswith("INV-")
    assert len(invoice["invoice_number"].split("-")) == 3

    # 2. Line Items GST verification
    items_by_sku = {itm["product_sku"]: itm for itm in invoice["items"]}

    # Banana: 2 * 6000 = 12000 paise taxable, 0% GST
    b_item = items_by_sku["PRD-BAN-001"]
    assert b_item["quantity"] == 2
    assert b_item["taxable_value_paise"] == 12000
    assert b_item["cgst_paise"] == 0
    assert b_item["sgst_paise"] == 0
    assert b_item["line_total_paise"] == 12000

    # Bottle: 3 * 4000 = 12000 paise taxable, 18% GST (9% CGST = 1080, 9% SGST = 1080)
    bot_item = items_by_sku["PRD-BOT-004"]
    assert bot_item["quantity"] == 3
    assert bot_item["taxable_value_paise"] == 12000
    assert bot_item["cgst_paise"] == 1080
    assert bot_item["sgst_paise"] == 1080
    assert bot_item["line_total_paise"] == 14160

    # Cup: 1 * 25000 = 25000 paise taxable, 12% GST (6% CGST = 1500, 6% SGST = 1500)
    cup_item = items_by_sku["PRD-CUP-005"]
    assert cup_item["quantity"] == 1
    assert cup_item["taxable_value_paise"] == 25000
    assert cup_item["cgst_paise"] == 1500
    assert cup_item["sgst_paise"] == 1500
    assert cup_item["line_total_paise"] == 28000

    # 3. Invoice Totals verification
    # Subtotal = 12000 + 12000 + 25000 = 49000 paise
    assert invoice["subtotal_paise"] == 49000
    # CGST Total = 0 + 1080 + 1500 = 2580 paise
    assert invoice["cgst_paise"] == 2580
    # SGST Total = 0 + 1080 + 1500 = 2580 paise
    assert invoice["sgst_paise"] == 2580
    # Grand Total = 49000 + 2580 + 2580 = 54160 paise
    assert invoice["total_paise"] == 54160

    # 4. Inventory stock deduction verification
    updated_prods = {p["sku"]: p for p in (await client.get("/api/products")).json()}
    assert updated_prods["PRD-BAN-001"]["stock"] == initial_banana_stock - 2
    assert updated_prods["PRD-BOT-004"]["stock"] == initial_bottle_stock - 3
    assert updated_prods["PRD-CUP-005"]["stock"] == initial_cup_stock - 1


@pytest.mark.asyncio
async def test_pdf_invoice_download(cashier_client):
    """Verify PDF invoice generation returns valid PDF binary stream."""
    client = cashier_client

    # Get recent invoice
    invoices_resp = await client.get("/api/checkout/invoices?limit=1")
    assert invoices_resp.status_code == 200
    latest_inv = invoices_resp.json()[0]
    inv_id = latest_inv["id"]

    # Request PDF
    pdf_resp = await client.get(f"/api/checkout/invoices/{inv_id}/pdf")
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert "Content-Disposition" in pdf_resp.headers
    assert f"Invoice_{latest_inv['invoice_number']}.pdf" in pdf_resp.headers["Content-Disposition"]

    # Check PDF magic bytes (%PDF-)
    content = pdf_resp.content
    assert content.startswith(b"%PDF-")
    assert len(content) > 1000


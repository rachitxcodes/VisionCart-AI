import pytest
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.product import Product, StockAdjustment
from app.models.invoice import Invoice, InvoiceItem


@pytest.mark.asyncio
async def test_database_seed_verification():
    async with AsyncSessionLocal() as session:
        # Verify Users
        users_result = await session.execute(select(User))
        users = users_result.scalars().all()
        assert len(users) >= 2
        emails = {u.email: u.role for u in users}
        assert "admin@visioncart.local" in emails
        assert emails["admin@visioncart.local"] == UserRole.ADMIN.value
        assert "cashier@visioncart.local" in emails
        assert emails["cashier@visioncart.local"] == UserRole.CASHIER.value

        # Verify Products
        products_result = await session.execute(select(Product))
        products = products_result.scalars().all()
        assert len(products) >= 10
        classes = {p.detector_class for p in products if p.detector_class}
        assert "banana" in classes
        assert "apple" in classes
        assert "bottle" in classes

        # Check low stock products
        low_stock_products = [p for p in products if p.stock <= p.reorder_level]
        assert len(low_stock_products) >= 2  # bowl and pizza

        # Verify Historical Invoices
        invoices_result = await session.execute(select(Invoice))
        invoices = invoices_result.scalars().all()
        assert len(invoices) >= 50

        # Verify Line Items Integrity
        items_result = await session.execute(select(InvoiceItem))
        items = items_result.scalars().all()
        assert len(items) > 100
        for item in items[:10]:
            assert item.taxable_value_paise == item.unit_price_paise * item.quantity
            expected_cgst = round(item.taxable_value_paise * (item.gst_rate / 2.0) / 100.0)
            expected_sgst = round(item.taxable_value_paise * (item.gst_rate / 2.0) / 100.0)
            assert item.cgst_paise == expected_cgst
            assert item.sgst_paise == expected_sgst
            assert item.line_total_paise == item.taxable_value_paise + item.cgst_paise + item.sgst_paise


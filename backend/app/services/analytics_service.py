"""Analytics service — revenue, top products, ABV, low-stock alerts."""
import datetime
from typing import List, Dict, Any

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice, InvoiceItem
from app.models.product import Product


class AnalyticsService:
    @staticmethod
    async def daily_revenue(db: AsyncSession, days: int = 30) -> List[Dict[str, Any]]:
        """Return daily revenue (total_paise) and invoice count for the last `days` days."""
        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
        # SQLite and Postgres both support strftime / date_trunc differently;
        # use func.date() which works on both (SQLite returns ISO string, Postgres returns date)
        stmt = (
            select(
                func.date(Invoice.created_at).label("day"),
                func.sum(Invoice.total_paise).label("revenue_paise"),
                func.count(Invoice.id).label("invoice_count"),
            )
            .where(Invoice.created_at >= cutoff)
            .group_by(func.date(Invoice.created_at))
            .order_by(func.date(Invoice.created_at).asc())
        )
        result = await db.execute(stmt)
        rows = result.fetchall()
        return [
            {
                "day": str(row.day),
                "revenue_paise": row.revenue_paise or 0,
                "invoice_count": row.invoice_count or 0,
            }
            for row in rows
        ]

    @staticmethod
    async def top_products(db: AsyncSession, limit: int = 10) -> List[Dict[str, Any]]:
        """Return top products by quantity sold and revenue generated."""
        stmt = (
            select(
                InvoiceItem.product_id,
                InvoiceItem.product_name,
                InvoiceItem.product_sku,
                func.sum(InvoiceItem.quantity).label("total_qty"),
                func.sum(InvoiceItem.line_total_paise).label("total_revenue_paise"),
            )
            .group_by(
                InvoiceItem.product_id,
                InvoiceItem.product_name,
                InvoiceItem.product_sku,
            )
            .order_by(func.sum(InvoiceItem.quantity).desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        rows = result.fetchall()
        return [
            {
                "product_id": row.product_id,
                "product_name": row.product_name,
                "product_sku": row.product_sku,
                "total_qty": row.total_qty or 0,
                "total_revenue_paise": row.total_revenue_paise or 0,
            }
            for row in rows
        ]

    @staticmethod
    async def summary_kpis(db: AsyncSession, days: int = 30) -> Dict[str, Any]:
        """Return total revenue, invoice count, and average basket value for period."""
        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
        stmt = select(
            func.count(Invoice.id).label("invoice_count"),
            func.sum(Invoice.total_paise).label("total_revenue_paise"),
            func.avg(Invoice.total_paise).label("avg_basket_paise"),
        ).where(Invoice.created_at >= cutoff)
        result = await db.execute(stmt)
        row = result.fetchone()
        return {
            "period_days": days,
            "invoice_count": row.invoice_count or 0,
            "total_revenue_paise": int(row.total_revenue_paise or 0),
            "avg_basket_value_paise": int(row.avg_basket_paise or 0),
        }

    @staticmethod
    async def low_stock_alerts(db: AsyncSession) -> List[Dict[str, Any]]:
        """Return products where stock <= reorder_level."""
        stmt = (
            select(Product)
            .where(and_(Product.stock <= Product.reorder_level, Product.is_active == True))
            .order_by(Product.stock.asc())
        )
        result = await db.execute(stmt)
        products = result.scalars().all()
        return [
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "stock": p.stock,
                "reorder_level": p.reorder_level,
                "category": p.category,
            }
            for p in products
        ]


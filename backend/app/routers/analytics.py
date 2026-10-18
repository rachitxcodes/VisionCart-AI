"""Analytics router — Admin-only endpoints for revenue, top products, KPIs, low-stock."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any

from app.core.database import get_db
from app.core.dependencies import require_admin
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/daily-revenue", response_model=List[Dict[str, Any]])
async def daily_revenue(
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    """Daily revenue and invoice count for the last N days."""
    return await AnalyticsService.daily_revenue(db, days=days)


@router.get("/top-products", response_model=List[Dict[str, Any]])
async def top_products(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    """Top selling products by quantity, with total revenue."""
    return await AnalyticsService.top_products(db, limit=limit)


@router.get("/kpis", response_model=Dict[str, Any])
async def kpis(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    """Summary KPIs: total revenue, invoice count, average basket value."""
    return await AnalyticsService.summary_kpis(db, days=days)


@router.get("/low-stock", response_model=List[Dict[str, Any]])
async def low_stock(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    """Products at or below reorder level."""
    return await AnalyticsService.low_stock_alerts(db)


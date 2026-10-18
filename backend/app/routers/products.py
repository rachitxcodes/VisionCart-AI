from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin, require_cashier_or_admin
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    StockAdjustmentCreate,
    StockAdjustmentResponse,
)
from app.services.product_service import ProductService

router = APIRouter(prefix="/api/products", tags=["Products & Inventory"])


@router.get("", response_model=List[ProductResponse])
async def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = None,
    category: Optional[str] = None,
    active_only: bool = True,
    current_user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve catalog products with optional category and search filters."""
    return await ProductService.get_products(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        category=category,
        active_only=active_only,
    )


@router.get("/low-stock", response_model=List[ProductResponse])
async def list_low_stock_products(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all products currently at or below their reorder threshold."""
    return await ProductService.get_low_stock_products(db=db)


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    current_user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve detailed product record by ID."""
    product = await ProductService.get_product_by_id(db=db, product_id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )
    return product


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_in: ProductCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new catalog product (Administrator only)."""
    return await ProductService.create_product(db=db, product_in=product_in, user_id=admin.id)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_in: ProductUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update product details (Administrator only)."""
    product = await ProductService.get_product_by_id(db=db, product_id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )
    return await ProductService.update_product(
        db=db, product=product, product_in=product_in, user_id=admin.id
    )


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate product (soft delete) from catalog (Administrator only)."""
    product = await ProductService.get_product_by_id(db=db, product_id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )
    await ProductService.delete_product(db=db, product=product)
    return {"message": f"Product '{product.name}' deactivated successfully."}


@router.post("/{product_id}/adjust-stock", response_model=ProductResponse)
async def adjust_product_stock(
    product_id: int,
    adjustment_in: StockAdjustmentCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Perform stock adjustment (ADD, DEDUCT, or SET) with reason tracking (Administrator only)."""
    product = await ProductService.get_product_by_id(db=db, product_id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )
    return await ProductService.adjust_stock(
        db=db, product=product, adjustment_in=adjustment_in, user_id=admin.id
    )


@router.get("/{product_id}/adjustments", response_model=List[StockAdjustmentResponse])
async def get_product_adjustments(
    product_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve audit history of stock adjustments for a product (Administrator only)."""
    return await ProductService.get_product_adjustments(db=db, product_id=product_id)


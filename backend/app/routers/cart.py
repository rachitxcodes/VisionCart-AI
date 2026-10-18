from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_cashier_or_admin
from app.models.user import User
from app.schemas.cart import CartSummarySchema, ManualCartItemUpdate
from app.services.cart_service import cart_manager

router = APIRouter(prefix="/api/cart", tags=["Cart & Frame Smoothing"])


class SyncDetectionsRequest(BaseModel):
    detected_classes: List[str]
    session_id: Optional[str] = "default"


@router.post("/sync-frame", response_model=CartSummarySchema)
async def sync_frame_detections(
    payload: SyncDetectionsRequest,
    current_user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Feed detected classes from a camera frame into the smoother and retrieve the stabilized cart."""
    session_id = f"user_{current_user.id}_{payload.session_id}"
    return await cart_manager.sync_frame_detections(
        db=db,
        session_id=session_id,
        detected_classes=payload.detected_classes,
    )


@router.get("", response_model=CartSummarySchema)
async def get_current_cart(
    session_id: str = Query("default"),
    current_user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve current active cart state for the cashier session."""
    session_key = f"user_{current_user.id}_{session_id}"
    return await cart_manager.get_cart(db=db, session_id=session_key)


@router.post("/item", response_model=CartSummarySchema)
async def update_cart_item(
    payload: ManualCartItemUpdate,
    session_id: str = Query("default"),
    current_user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Cashier manually updates an item's quantity or adds a non-detected catalog item."""
    session_key = f"user_{current_user.id}_{session_id}"
    return await cart_manager.update_item_quantity(
        db=db,
        session_id=session_key,
        product_id=payload.product_id,
        quantity=payload.quantity,
    )


@router.delete("/item/{product_id}", response_model=CartSummarySchema)
async def remove_cart_item(
    product_id: int,
    session_id: str = Query("default"),
    current_user: User = Depends(require_cashier_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a product from the active cart."""
    session_key = f"user_{current_user.id}_{session_id}"
    return await cart_manager.update_item_quantity(
        db=db,
        session_id=session_key,
        product_id=product_id,
        quantity=0,
    )


@router.post("/clear")
async def clear_cart(
    session_id: str = Query("default"),
    current_user: User = Depends(require_cashier_or_admin),
):
    """Clear active cart and reset temporal smoother state."""
    session_key = f"user_{current_user.id}_{session_id}"
    cart_manager.clear_cart(session_id=session_key)
    return {"message": "Cart cleared successfully."}


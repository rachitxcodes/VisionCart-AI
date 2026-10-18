from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token
from app.core.dependencies import get_current_user, require_admin, require_cashier_or_admin
from app.models.user import User
from app.schemas.user import UserLoginRequest, TokenResponse, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user with email and password, returning a JWT access token."""
    user = await AuthService.authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        data={"sub": user.email, "role": user.role, "user_id": user.id}
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Retrieve profile and role of currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.get("/admin-only")
async def admin_only_check(admin: User = Depends(require_admin)):
    """Verification route restricted strictly to Administrator role."""
    return {"message": "Access granted to administrator.", "admin_id": admin.id}


@router.get("/cashier-or-admin")
async def cashier_or_admin_check(user: User = Depends(require_cashier_or_admin)):
    """Verification route accessible by both Cashiers and Admins."""
    return {"message": "Access granted to staff.", "role": user.role}


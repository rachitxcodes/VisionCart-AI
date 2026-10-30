from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="", tags=["Health"])


@router.get("/health")
async def health_check():
    """Health check endpoint to verify backend status, environment, and detector configuration."""
    return {
        "status": "healthy",
        "service": "visioncart-ai",
        "environment": settings.ENVIRONMENT,
        "detector_mode": settings.DETECTOR_MODE,
        "detector_device": settings.DETECTOR_DEVICE,
    }


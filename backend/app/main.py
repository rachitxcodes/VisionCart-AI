import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.routers import health, auth, products, detection, cart, checkout

setup_logging()

app = FastAPI(
    title="VisionCart AI API",
    description="Real-time Computer Vision Retail Checkout and Inventory Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests_middleware(request: Request, call_next):
    start_time = time.time()
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logger.info(
            f"{request.method} {request.url.path} - {response.status_code} ({process_time:.2f}ms)"
        )
        return response
    except Exception as exc:
        process_time = (time.time() - start_time) * 1000
        logger.error(
            f"{request.method} {request.url.path} - FAILED ({process_time:.2f}ms) - {exc}",
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error occurred.", "error": str(exc)},
        )


# Register Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(detection.router)
app.include_router(cart.router)
app.include_router(checkout.router)






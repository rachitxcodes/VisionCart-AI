import time
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.limiter import limiter
from app.routers import health, auth, products, detection, cart, checkout, analytics

setup_logging()

app = FastAPI(
    title="VisionCart AI API",
    description="Real-time Computer Vision Retail Checkout and Inventory Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Attach rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    start_time = time.time()
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        response.headers["X-Request-ID"] = request_id
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} - {response.status_code} ({process_time:.2f}ms)"
        )
        return response
    except Exception as exc:
        process_time = (time.time() - start_time) * 1000
        logger.error(
            f"[{request_id}] {request.method} {request.url.path} - FAILED ({process_time:.2f}ms) - {exc}",
            exc_info=True,
        )
        err_resp = JSONResponse(
            status_code=500,
            content={"detail": "Internal server error occurred.", "error": str(exc), "request_id": request_id},
        )
        err_resp.headers["X-Request-ID"] = request_id
        return err_resp


# Register Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(detection.router)
app.include_router(cart.router)
app.include_router(checkout.router)
app.include_router(checkout.invoices_router)
app.include_router(analytics.router)

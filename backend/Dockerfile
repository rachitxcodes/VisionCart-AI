FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install system dependencies for OpenCV and image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Pre-download YOLOv8n weights so startup in container doesn't block on download
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" && \
    mkdir -p /app/ml/weights && \
    cp yolov8n.pt /app/ml/weights/yolov8n.pt || true

# Copy backend code, ml directory, and alembic configs
COPY backend/ /app/
COPY ml/ /app/ml/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]


import os
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    @field_validator("DEBUG", mode="before")
    @classmethod
    def assemble_debug(cls, v):
        if isinstance(v, str):
            return v.lower() in ("true", "1", "t", "yes", "y", "debug", "dev")
        return bool(v)

    # Security & Auth
    JWT_SECRET_KEY: str = "visioncart_super_secret_jwt_key_change_in_production_99881122"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Database URLs
    DATABASE_URL: str = "sqlite+aiosqlite:///./visioncart.db"
    SYNC_DATABASE_URL: str = "sqlite:///./visioncart.db"

    # Detector Service
    DETECTOR_MODE: str = "mock"  # "mock" or "yolo"
    MODEL_PATH: str = "ml/weights/yolov8n.pt"
    CONFIDENCE_THRESHOLD: float = 0.45
    DETECTOR_DEVICE: str = "cpu"

    # Temporal Smoothing
    SMOOTHING_N_FRAMES: int = 3
    SMOOTHING_M_FRAMES: int = 5

    # Seed Admin & Cashier
    SEED_ADMIN_EMAIL: str = "admin@visioncart.local"
    SEED_ADMIN_PASSWORD: str = "Admin@1234"
    SEED_CASHIER_EMAIL: str = "cashier@visioncart.local"
    SEED_CASHIER_PASSWORD: str = "Cashier@1234"

    # CORS Settings
    CORS_ORIGINS: Union[str, List[str]] = (
        "http://localhost:5173,http://localhost:3000,http://localhost:80,http://localhost,"
        "http://127.0.0.1:5173,http://127.0.0.1:3000,http://127.0.0.1:80"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [i.strip() for i in self.CORS_ORIGINS.split(",") if i.strip()]

    # Rate Limiting
    DETECTION_RATE_LIMIT: int = 300


settings = Settings()

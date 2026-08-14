from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://ripple:ripple@localhost:5432/ripple"
    DB_AUTO_INIT_ON_STARTUP: bool = False

    # JWT
    JWT_SECRET_KEY: str = "your-secret-key-change-this"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7

    # Admin
    ADMIN_EMAIL: str = "admin@patpat.com"
    ADMIN_PASSWORD: str = "admin123456"

    # Git (legacy, being phased out)
    SKILLS_REPO_PATH: str = ""
    GIT_REMOTE_URL: str = ""

    # MinIO (S3-compatible object storage)
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "ripple"
    MINIO_SECRET_KEY: str = "ripple123456"
    MINIO_BUCKET: str = "ripple-skill-packages"
    MINIO_SECURE: bool = False

    # LLM
    LLM_PROVIDER: str = "openai"
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # CORS
    CORS_ORIGINS: str = '["http://localhost:3000"]'

    # App
    APP_NAME: str = "Ripple"
    APP_ENV: str = "development"
    APP_BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"
    CLI_VERSION: str = "0.3.0"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

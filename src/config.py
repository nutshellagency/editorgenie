"""
Configuration management for the Automated AI Video Editor.

This module handles configuration loading from environment variables,
with support for different environments (development, staging, production).
"""

import os
from typing import Optional, Dict, Any
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings
from pathlib import Path
import json


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Application settings
    app_name: str = Field(default="AI Video Editor", env="APP_NAME")
    version: str = Field(default="1.0.0", env="APP_VERSION")
    debug: bool = Field(default=False, env="DEBUG")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")

    # API settings
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    api_prefix: str = Field(default="/api/v1", env="API_PREFIX")

    # File paths
    base_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent)
    upload_dir: Path = Field(default_factory=lambda: Path("uploads"))
    temp_dir: Path = Field(default_factory=lambda: Path("temp"))
    output_dir: Path = Field(default_factory=lambda: Path("output"))

    # Video processing settings
    max_video_size_mb: int = Field(default=500, env="MAX_VIDEO_SIZE_MB")
    supported_formats: list = Field(
        default_factory=lambda: [".mp4", ".mov", ".avi", ".mkv", ".webm"]
    )
    proxy_resolution: str = Field(default="640x360", env="PROXY_RESOLUTION")

    # AI service settings
    assemblyai_api_key: Optional[str] = Field(default=None, env="ASSEMBLYAI_API_KEY")
    qwen_api_key: Optional[str] = Field(default=None, env="QWEN_API_KEY")
    gemini_api_key: Optional[str] = Field(default=None, env="GEMINI_API_KEY")

    # Database settings
    database_url: str = Field(default="sqlite:///./video_editor.db", env="DATABASE_URL")

    # Redis settings (for caching and queues)
    redis_url: str = Field(default="redis://localhost:6379", env="REDIS_URL")

    # Security settings
    secret_key: str = Field(
        default_factory=lambda: os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    )
    allowed_hosts: str = Field(default="*", env="ALLOWED_HOSTS")

    # CORS settings
    cors_origins: str = Field(default="*", env="CORS_ORIGINS")

    # Rate limiting
    rate_limit_per_minute: int = Field(default=60, env="RATE_LIMIT_PER_MINUTE")

    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        case_sensitive = False

    @field_validator('allowed_hosts', mode='after')
    @classmethod
    def parse_allowed_hosts(cls, v):
        """Parse allowed hosts from environment variable."""
        if isinstance(v, str):
            if v == "*":
                return ["*"]
            return [host.strip() for host in v.split(",") if host.strip()]
        return v

    @field_validator('cors_origins', mode='after')
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from environment variable."""
        if isinstance(v, str):
            if v == "*":
                return ["*"]
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    def __init__(self, **kwargs):
        """Initialize settings with path resolution."""
        super().__init__(**kwargs)

        # Resolve relative paths to absolute paths
        self.upload_dir = self.base_dir / self.upload_dir
        self.temp_dir = self.base_dir / self.temp_dir
        self.output_dir = self.base_dir / self.output_dir

        # Ensure directories exist
        self.upload_dir.mkdir(exist_ok=True)
        self.temp_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)


# Environment-specific settings
class DevelopmentSettings(Settings):
    """Development environment settings."""
    debug: bool = True
    log_level: str = "DEBUG"
    reload: bool = True


class StagingSettings(Settings):
    """Staging environment settings."""
    debug: bool = False
    log_level: str = "INFO"


class ProductionSettings(Settings):
    """Production environment settings."""
    debug: bool = False
    log_level: str = "WARNING"


def get_settings() -> Settings:
    """
    Get application settings based on environment.

    Returns:
        Settings instance for the current environment
    """
    env = os.getenv("ENVIRONMENT", "development").lower()

    if env == "production":
        return ProductionSettings()
    elif env == "staging":
        return StagingSettings()
    else:
        return DevelopmentSettings()


# Global settings instance
settings = get_settings()
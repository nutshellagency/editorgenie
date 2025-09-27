"""Configuration for logging and monitoring infrastructure."""

import os
from typing import Optional

from pydantic import BaseSettings


class LoggingConfig(BaseSettings):
    """Configuration for logging infrastructure."""

    # Logging settings
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    log_dir: str = os.getenv("LOG_DIR", "logs")
    enable_json_logging: bool = os.getenv("JSON_LOGGING", "true").lower() == "true"
    enable_file_logging: bool = os.getenv("FILE_LOGGING", "true").lower() == "true"

    # OpenTelemetry settings
    enable_tracing: bool = os.getenv("ENABLE_TRACING", "false").lower() == "true"
    jaeger_endpoint: Optional[str] = os.getenv("JAEGER_ENDPOINT")
    otlp_endpoint: Optional[str] = os.getenv("OTLP_ENDPOINT")
    service_name: str = os.getenv("SERVICE_NAME", "ai-video-editor")
    environment: str = os.getenv("ENVIRONMENT", "development")

    # Metrics settings
    enable_metrics: bool = os.getenv("ENABLE_METRICS", "false").lower() == "true"
    metrics_export_interval: int = int(os.getenv("METRICS_EXPORT_INTERVAL", "30"))

    class Config:
        env_prefix = "LOGGING_"
        case_sensitive = False


def get_logging_config() -> LoggingConfig:
    """Get logging configuration from environment variables."""
    return LoggingConfig()
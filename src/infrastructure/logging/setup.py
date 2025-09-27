"""Setup functions for logging and monitoring infrastructure."""

from typing import Optional

from .config import get_logging_config
from .opentelemetry import setup_metrics, setup_tracing
from .structured_logger import setup_logging


def setup_infrastructure(
    service_name: str = "ai-video-editor",
    environment: str = "development",
    log_level: str = "INFO",
    jaeger_endpoint: Optional[str] = None,
    otlp_endpoint: Optional[str] = None,
) -> None:
    """Set up complete logging and monitoring infrastructure."""
    config = get_logging_config()

    # Set up structured logging
    logger = setup_logging(
        level=config.log_level,
        log_dir=config.log_dir,
        enable_json=config.enable_json_logging,
        enable_file_logging=config.enable_file_logging,
    )

    logger.info(
        "Setting up logging and monitoring infrastructure",
        service=service_name,
        environment=environment,
        log_level=log_level,
    )

    # Set up OpenTelemetry tracing if enabled
    if config.enable_tracing:
        try:
            tracer = setup_tracing(
                service_name=service_name,
                jaeger_endpoint=jaeger_endpoint or config.jaeger_endpoint,
                otlp_endpoint=otlp_endpoint or config.otlp_endpoint,
                environment=environment,
            )
            logger.info("OpenTelemetry tracing initialized", tracer=str(tracer))
        except Exception as e:
            logger.error("Failed to initialize tracing", error=str(e))

    # Set up metrics collection if enabled
    if config.enable_metrics:
        try:
            setup_metrics(
                service_name=service_name,
                otlp_endpoint=otlp_endpoint or config.otlp_endpoint,
                export_interval=config.metrics_export_interval,
            )
            logger.info("OpenTelemetry metrics initialized")
        except Exception as e:
            logger.error("Failed to initialize metrics", error=str(e))

    logger.info("Infrastructure setup complete")


def setup_api_monitoring(app):
    """Set up monitoring middleware for API applications."""
    from .opentelemetry import OpenTelemetryMiddleware

    # Wrap the app with tracing middleware
    app.wsgi_app = OpenTelemetryMiddleware(app.wsgi_app)
    return app
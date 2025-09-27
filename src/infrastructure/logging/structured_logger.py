"""Structured logging implementation with JSON formatting and correlation IDs."""

import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

# Context variables for correlation tracking
correlation_id: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)
user_id: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
session_id: ContextVar[Optional[str]] = ContextVar("session_id", default=None)
request_id: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""

    def __init__(self, include_extra: bool = True):
        super().__init__()
        self.include_extra = include_extra

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "thread": record.thread,
            "process": record.process,
        }

        # Add correlation context if available
        if correlation_id.get():
            log_entry["correlation_id"] = correlation_id.get()
        if user_id.get():
            log_entry["user_id"] = user_id.get()
        if session_id.get():
            log_entry["session_id"] = session_id.get()
        if request_id.get():
            log_entry["request_id"] = request_id.get()

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Add extra fields if present
        if self.include_extra and hasattr(record, "__dict__"):
            for key, value in record.__dict__.items():
                if key not in {
                    "name", "msg", "args", "levelname", "levelno", "pathname",
                    "filename", "module", "exc_info", "exc_text", "stack_info",
                    "lineno", "funcName", "created", "msecs", "relativeCreated",
                    "thread", "threadName", "processName", "process", "getMessage",
                    "format", "formatMessage", "formatException"
                }:
                    log_entry[key] = value

        return json.dumps(log_entry, default=str)


class StructuredLogger:
    """Enhanced logger with structured logging capabilities."""

    def __init__(self, name: str, level: int = logging.INFO):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)

        # Remove existing handlers to avoid duplicates
        for handler in self.logger.handlers[:]:
            self.logger.removeHandler(handler)

        # Add console handler with JSON formatting
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(JSONFormatter())
        self.logger.addHandler(console_handler)

        # Add file handler for persistent logs
        log_file = Path("logs") / f"{name}.json"
        log_file.parent.mkdir(exist_ok=True)
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(JSONFormatter())
        self.logger.addHandler(file_handler)

    def _log(
        self,
        level: int,
        message: str,
        extra: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        """Internal logging method with extra context."""
        if extra:
            kwargs.update(extra)

        self.logger.log(level, message, extra=kwargs)

    def debug(self, message: str, **kwargs):
        """Log debug message."""
        self._log(logging.DEBUG, message, **kwargs)

    def info(self, message: str, **kwargs):
        """Log info message."""
        self._log(logging.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs):
        """Log warning message."""
        self._log(logging.WARNING, message, **kwargs)

    def error(self, message: str, **kwargs):
        """Log error message."""
        self._log(logging.ERROR, message, **kwargs)

    def critical(self, message: str, **kwargs):
        """Log critical message."""
        self._log(logging.CRITICAL, message, **kwargs)

    def exception(self, message: str, **kwargs):
        """Log exception with traceback."""
        kwargs["exc_info"] = True
        self._log(logging.ERROR, message, **kwargs)


def setup_context(
    correlation_id: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    request_id: Optional[str] = None,
):
    """Set up logging context variables."""
    if correlation_id:
        correlation_id.set(correlation_id)
    if user_id:
        user_id.set(user_id)
    if session_id:
        session_id.set(session_id)
    if request_id:
        request_id.set(request_id)


def generate_correlation_id() -> str:
    """Generate a new correlation ID."""
    return str(uuid.uuid4())


def setup_logging(
    level: str = "INFO",
    log_dir: str = "logs",
    enable_json: bool = True,
    enable_file_logging: bool = True,
) -> StructuredLogger:
    """Set up structured logging for the application."""
    # Create log directory
    Path(log_dir).mkdir(exist_ok=True)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))

    # Clear existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Add console handler
    console_handler = logging.StreamHandler(sys.stdout)
    if enable_json:
        console_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(console_handler)

    # Add file handler if enabled
    if enable_file_logging:
        log_file = Path(log_dir) / "application.json"
        file_handler = logging.FileHandler(log_file)
        if enable_json:
            file_handler.setFormatter(JSONFormatter())
        root_logger.addHandler(file_handler)

    return StructuredLogger("ai_video_editor")


# Convenience functions for common logging patterns
def log_video_processing_start(
    video_id: str,
    user_id: Optional[str] = None,
    **kwargs
):
    """Log the start of video processing."""
    logger = StructuredLogger("video_processing")
    logger.info(
        "Video processing started",
        video_id=video_id,
        user_id=user_id,
        processing_stage="start",
        **kwargs
    )


def log_video_processing_complete(
    video_id: str,
    duration: float,
    user_id: Optional[str] = None,
    **kwargs
):
    """Log the completion of video processing."""
    logger = StructuredLogger("video_processing")
    logger.info(
        "Video processing completed",
        video_id=video_id,
        user_id=user_id,
        processing_duration=duration,
        processing_stage="complete",
        **kwargs
    )


def log_ai_service_call(
    service_name: str,
    operation: str,
    duration: float,
    success: bool = True,
    **kwargs
):
    """Log AI service calls."""
    logger = StructuredLogger("ai_service")
    logger.info(
        f"AI service {operation}",
        service=service_name,
        operation=operation,
        duration=duration,
        success=success,
        **kwargs
    )
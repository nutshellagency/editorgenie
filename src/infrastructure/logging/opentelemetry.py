"""OpenTelemetry integration for distributed tracing and metrics."""

import logging
from contextlib import contextmanager
from typing import Any, Dict, Optional

from opentelemetry import trace
# from opentelemetry.exporter.jaeger.thrift import JaegerExporter
# from opentelemetry.exporter.otlp.http.metric import OTLPMetricExporter
# from opentelemetry.exporter.otlp.http.trace import OTLPSpanExporter
# from opentelemetry.sdk.metrics import MeterProvider
# from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
# from opentelemetry.sdk.resources import Resource
# from opentelemetry.sdk.trace import TracerProvider
# from opentelemetry.sdk.trace.export import BatchSpanProcessor
# from opentelemetry.semconv.resource import ResourceAttributes
# from opentelemetry.trace import Status, StatusCode

# Global tracer instance
_tracer = None
_meter = None


def setup_logging():
    """Set up logging integration with OpenTelemetry."""
    # TODO: Implement when OpenTelemetry dependencies are available
    pass


def setup_tracing():
    """Set up tracing integration with OpenTelemetry."""
    # TODO: Implement when OpenTelemetry dependencies are available
    pass


def setup_tracing(
    service_name: str = "ai-video-editor",
    jaeger_endpoint: Optional[str] = None,
    otlp_endpoint: Optional[str] = None,
    environment: str = "development",
) -> trace.Tracer:
    """Set up OpenTelemetry distributed tracing."""
    global _tracer

    # TODO: Re-enable when OpenTelemetry dependencies are available
    # Create resource
    # resource = Resource.create({
    #     ResourceAttributes.SERVICE_NAME: service_name,
    #     ResourceAttributes.SERVICE_VERSION: "1.0.0",
    #     "environment": environment,
    # })

    # Set up tracer provider
    # tracer_provider = TracerProvider(resource=resource)

    # Add Jaeger exporter if endpoint provided
    # if jaeger_endpoint:
    #     jaeger_exporter = JaegerExporter(
    #         agent_host_name=jaeger_endpoint.split(":")[0],
    #         agent_port=int(jaeger_endpoint.split(":")[1]),
    #     )
    #     span_processor = BatchSpanProcessor(jaeger_exporter)
    #     tracer_provider.add_span_processor(span_processor)

    # Add OTLP exporter if endpoint provided
    # if otlp_endpoint:
    #     otlp_exporter = OTLPSpanExporter(
    #         endpoint=otlp_endpoint,
    #         insecure=True,  # Set to False for production with TLS
    #     )
    #     span_processor = BatchSpanProcessor(otlp_exporter)
    #     tracer_provider.add_span_processor(span_processor)

    # Set as global tracer provider
    # trace.set_tracer_provider(tracer_provider)
    _tracer = trace.get_tracer(__name__)

    return _tracer


def setup_metrics(
    service_name: str = "ai-video-editor",
    otlp_endpoint: Optional[str] = None,
    export_interval: int = 30,
) -> None:
    """Set up OpenTelemetry metrics collection."""
    global _meter

    # TODO: Re-enable when OpenTelemetry dependencies are available
    # Create resource
    # resource = Resource.create({
    #     ResourceAttributes.SERVICE_NAME: service_name,
    #     ResourceAttributes.SERVICE_VERSION: "1.0.0",
    # })

    # Set up metric reader and exporter
    # if otlp_endpoint:
    #     metric_reader = PeriodicExportingMetricReader(
    #         exporter=OTLPMetricExporter(
    #             endpoint=otlp_endpoint,
    #             insecure=True,
    #         ),
    #         export_interval_millis=export_interval * 1000,
    #     )
    # else:
    #     # Console exporter for development
    #     from opentelemetry.sdk.metrics.export import ConsoleMetricExporter
    #     metric_reader = PeriodicExportingMetricReader(
    #         exporter=ConsoleMetricExporter(),
    #         export_interval_millis=export_interval * 1000,
    #     )

    # Set up meter provider
    # meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    _meter = None  # Temporarily disable metrics


def get_tracer() -> trace.Tracer:
    """Get the global tracer instance."""
    global _tracer
    if _tracer is None:
        _tracer = trace.get_tracer(__name__)
    return _tracer


def get_meter():
    """Get the global meter instance."""
    global _meter
    if _meter is None:
        from opentelemetry import metrics
        _meter = metrics.get_meter(__name__)
    return _meter


@contextmanager
def trace_operation(
    operation_name: str,
    attributes: Optional[Dict[str, Any]] = None
):
    """Context manager for tracing operations."""
    tracer = get_tracer()
    with tracer.start_as_current_span(
        operation_name,
        attributes=attributes or {}
    ) as span:
        try:
            yield span
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR, str(e)))
            span.record_exception(e)
            raise
        else:
            span.set_status(Status(StatusCode.OK))


@contextmanager
def trace_video_processing(
    video_id: str,
    operation: str,
    user_id: Optional[str] = None,
    **kwargs
):
    """Context manager for tracing video processing operations."""
    attributes = {
        "video.id": video_id,
        "video.operation": operation,
        **kwargs
    }
    if user_id:
        attributes["user.id"] = user_id

    with trace_operation(f"video_processing.{operation}", attributes) as span:
        yield span


@contextmanager
def trace_ai_service_call(
    service_name: str,
    operation: str,
    model: Optional[str] = None,
    **kwargs
):
    """Context manager for tracing AI service calls."""
    attributes = {
        "ai.service": service_name,
        "ai.operation": operation,
        **kwargs
    }
    if model:
        attributes["ai.model"] = model

    with trace_operation(f"ai_service.{service_name}.{operation}", attributes) as span:
        yield span


def record_video_processing_metrics(
    video_id: str,
    duration: float,
    file_size: int,
    success: bool = True,
    **kwargs
):
    """Record video processing metrics."""
    # TODO: Re-enable when OpenTelemetry dependencies are available
    # meter = get_meter()

    # Create counters and histograms
    # processing_counter = meter.create_counter(
    #     "video_processing_total",
    #     description="Total number of video processing operations"
    # )

    # processing_duration = meter.create_histogram(
    #     "video_processing_duration_seconds",
    #     description="Duration of video processing operations",
    #     unit="s"
    # )

    # processing_file_size = meter.create_histogram(
    #     "video_processing_file_size_bytes",
    #     description="Size of processed video files",
    #     unit="bytes"
    # )

    # Record metrics
    # processing_counter.add(1, {"video_id": video_id, "success": str(success)})
    # processing_duration.record(duration, {"video_id": video_id})
    # processing_file_size.record(file_size, {"video_id": video_id})

    # Add custom attributes
    # for key, value in kwargs.items():
    #     processing_counter.add(1, {key: str(value)})
    pass


def record_ai_service_metrics(
    service_name: str,
    operation: str,
    duration: float,
    tokens: Optional[int] = None,
    success: bool = True,
    **kwargs
):
    """Record AI service metrics."""
    # TODO: Re-enable when OpenTelemetry dependencies are available
    # meter = get_meter()

    # Create counters and histograms
    # ai_calls_counter = meter.create_counter(
    #     "ai_service_calls_total",
    #     description="Total number of AI service calls"
    # )

    # ai_duration_histogram = meter.create_histogram(
    #     "ai_service_duration_seconds",
    #     description="Duration of AI service calls",
    #     unit="s"
    # )

    # Record metrics
    # attributes = {
    #     "service": service_name,
    #     "operation": operation,
    #     "success": str(success)
    # }

    # ai_calls_counter.add(1, attributes)
    # ai_duration_histogram.record(duration, attributes)

    # if tokens:
    #     token_counter = meter.create_counter(
    #         "ai_service_tokens_total",
    #         description="Total tokens processed by AI services"
    #     )
    #     token_counter.add(tokens, attributes)
    pass


def record_system_metrics():
    """Record system-level metrics."""
    # TODO: Re-enable when OpenTelemetry dependencies are available
    # import psutil
    # import time

    # meter = get_meter()

    # CPU usage
    # cpu_percent_gauge = meter.create_gauge(
    #     "system_cpu_percent",
    #     description="Current CPU usage percentage",
    #     unit="%"
    # )
    # cpu_percent_gauge.set(psutil.cpu_percent())

    # Memory usage
    # memory = psutil.virtual_memory()
    # memory_percent_gauge = meter.create_gauge(
    #     "system_memory_percent",
    #     description="Current memory usage percentage",
    #     unit="%"
    # )
    # memory_percent_gauge.set(memory.percent)

    # Disk usage
    # disk = psutil.disk_usage('/')
    # disk_percent_gauge = meter.create_gauge(
    #     "system_disk_percent",
    #     description="Current disk usage percentage",
    #     unit="%"
    # )
    # disk_percent_gauge.set(disk.percent)
    pass


class OpenTelemetryMiddleware:
    """Middleware for automatic tracing of HTTP requests."""

    def __init__(self, app):
        self.app = app
        self.tracer = get_tracer()

    def __call__(self, environ, start_response):
        # Extract trace context from headers if present
        trace_header = environ.get("HTTP_TRACEPARENT", "")
        if trace_header:
            # Parse W3C trace context
            pass

        # Start new span for request
        with self.tracer.start_as_current_span(
            "http_request",
            attributes={
                "http.method": environ.get("REQUEST_METHOD"),
                "http.url": environ.get("PATH_INFO"),
                "http.user_agent": environ.get("HTTP_USER_AGENT"),
            }
        ) as span:
            def custom_start_response(status, response_headers, exc_info=None):
                # Add trace ID to response headers
                trace_id = span.get_span_context().trace_id
                response_headers.append(("X-Trace-Id", str(trace_id)))
                return start_response(status, response_headers, exc_info)

            return self.app(environ, custom_start_response)
"""
Main FastAPI application for the Automated AI Video Editor.

This module serves as the entry point for the REST API that handles
video processing requests and provides the interface for the node-based
editing system.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import logging
from typing import Dict, Any, Optional
import tempfile
import os
import time

# Set up logging and monitoring infrastructure
from src.infrastructure.logging.setup import setup_infrastructure, setup_api_monitoring
from src.infrastructure.logging.opentelemetry import (
    trace_operation,
    trace_video_processing,
    record_video_processing_metrics,
    record_ai_service_metrics
)

# Initialize logging and monitoring
setup_infrastructure(
    service_name="ai-video-editor-api",
    environment=os.getenv("ENVIRONMENT", "development"),
    log_level=os.getenv("LOG_LEVEL", "INFO"),
    jaeger_endpoint=os.getenv("JAEGER_ENDPOINT"),
    otlp_endpoint=os.getenv("OTLP_ENDPOINT"),
)

# Set up API monitoring middleware
setup_api_monitoring(app)

logger = logging.getLogger("ai_video_editor.api")

# Create FastAPI application
app = FastAPI(
    title="Automated AI Video Editor API",
    description="REST API for AI-powered video editing and processing",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root() -> Dict[str, str]:
    """Root endpoint with API information."""
    return {
        "message": "Automated AI Video Editor API",
        "version": "1.0.0",
        "status": "operational"
    }

@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint for monitoring and load balancers."""
    return {
        "status": "healthy",
        "service": "ai-video-editor",
        "version": "1.0.0"
    }

@app.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    metadata: Optional[str] = None
) -> Dict[str, Any]:
    """
    Upload a video file for processing.

    Args:
        file: Video file to upload
        metadata: Optional metadata about the video

    Returns:
        Upload confirmation with processing status
    """
    start_time = time.time()

    with trace_operation(
        "video_upload",
        {
            "http.method": "POST",
            "http.endpoint": "/upload",
            "file.name": file.filename or "unknown",
        }
    ) as span:
        try:
            # Validate file type
            allowed_extensions = {'.mp4', '.mov', '.avi', '.mkv', '.webm'}
            filename = file.filename or ''
            file_extension = os.path.splitext(filename)[1].lower()

            if file_extension not in allowed_extensions:
                span.set_status(trace.Status(trace.StatusCode.ERROR, "Invalid file type"))
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
                )

            # Save uploaded file temporarily
            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=file_extension
            ) as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_file_path = temp_file.name

            # Record metrics
            upload_duration = time.time() - start_time
            record_video_processing_metrics(
                video_id=filename,
                duration=upload_duration,
                file_size=len(content),
                success=True,
                operation="upload"
            )

            logger.info(
                "Video uploaded successfully",
                filename=filename,
                size=len(content),
                duration=upload_duration
            )

            span.set_status(trace.Status(trace.StatusCode.OK))

            return {
                "message": "Video uploaded successfully",
                "filename": filename,
                "size": len(content),
                "temp_path": temp_file_path,
                "status": "uploaded",
                "processing_time": upload_duration
            }

        except Exception as e:
            # Record failed upload metrics
            upload_duration = time.time() - start_time
            record_video_processing_metrics(
                video_id=filename,
                duration=upload_duration,
                file_size=0,
                success=False,
                operation="upload",
                error=str(e)
            )

            logger.error(
                "Video upload failed",
                filename=filename,
                error=str(e),
                duration=upload_duration
            )

            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/process")
async def process_video(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a video through the AI pipeline.

    Args:
        request: Processing configuration and parameters

    Returns:
        Processing job information and status
    """
    start_time = time.time()

    with trace_operation(
        "video_processing",
        {
            "http.method": "POST",
            "http.endpoint": "/process",
            "processing.nodes": len(request.get("nodes", [])),
        }
    ) as span:
        try:
            # Extract processing parameters
            video_id = request.get("video_id", "unknown")
            nodes = request.get("nodes", [])

            logger.info(
                "Video processing started",
                video_id=video_id,
                node_count=len(nodes)
            )

            # This will be implemented with the node system
            # For now, return placeholder response
            processing_duration = time.time() - start_time

            # Record processing metrics
            record_video_processing_metrics(
                video_id=video_id,
                duration=processing_duration,
                file_size=0,  # Will be updated when actual processing is implemented
                success=True,
                operation="process",
                node_count=len(nodes)
            )

            logger.info(
                "Video processing completed",
                video_id=video_id,
                duration=processing_duration
            )

            span.set_status(trace.Status(trace.StatusCode.OK))

            return {
                "message": "Processing pipeline not yet implemented",
                "job_id": "placeholder",
                "status": "pending",
                "estimated_time": "TBD",
                "processing_time": processing_duration
            }

        except Exception as e:
            processing_duration = time.time() - start_time

            # Record failed processing metrics
            record_video_processing_metrics(
                video_id=request.get("video_id", "unknown"),
                duration=processing_duration,
                file_size=0,
                success=False,
                operation="process",
                error=str(e)
            )

            logger.error(
                "Video processing failed",
                error=str(e),
                duration=processing_duration
            )

            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.get("/status/{job_id}")
async def get_job_status(job_id: str) -> Dict[str, Any]:
    """
    Get the status of a processing job.

    Args:
        job_id: Unique identifier for the processing job

    Returns:
        Current status and progress information
    """
    # This will be implemented with the replay system
    return {
        "job_id": job_id,
        "status": "not_found",
        "message": "Job tracking not yet implemented"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
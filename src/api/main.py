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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
    try:
        # Validate file type
        allowed_extensions = {'.mp4', '.mov', '.avi', '.mkv', '.webm'}
        filename = file.filename or ''
        file_extension = os.path.splitext(filename)[1].lower()

        if file_extension not in allowed_extensions:
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

        logger.info(f"Video uploaded: {file.filename}, size: {len(content)} bytes")

        logger.info(f"Video uploaded: {file.filename}, size: {len(content)} bytes")

        return {
            "message": "Video uploaded successfully",
            "filename": file.filename,
            "size": len(content),
            "temp_path": temp_file_path,
            "status": "uploaded"
        }

    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
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
    try:
        # This will be implemented with the node system
        return {
            "message": "Processing pipeline not yet implemented",
            "job_id": "placeholder",
            "status": "pending",
            "estimated_time": "TBD"
        }

    except Exception as e:
        logger.error(f"Processing error: {str(e)}")
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
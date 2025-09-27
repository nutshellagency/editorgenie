"""
Export Service with Queue Management

Comprehensive export service that handles:
- Export job lifecycle management
- Priority-based queue system
- Concurrent processing with resource limits
- Progress tracking and notifications
- Error handling and recovery
- Quality validation and metrics
"""

import asyncio
import logging
import uuid
import json
import os
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
from dataclasses import dataclass, field
from pathlib import Path
import threading
import queue
import psutil
import GPUtil

from src.core.timeline.models import TimelineState, TimelineSegment, TimelineTrack


class ExportStatus(Enum):
    """Export job status enumeration"""
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class ExportFormat(Enum):
    """Supported export formats"""
    MP4 = "mp4"
    MOV = "mov"
    AVI = "avi"
    MKV = "mkv"
    WEBM = "webm"
    PRORES = "prores"
    DNXHR = "dnxhr"


class ExportPriority(Enum):
    """Export job priority levels"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    URGENT = 4


@dataclass
class ExportJob:
    """Export job data structure"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timeline_id: str = ""
    format: ExportFormat = ExportFormat.MP4
    settings: Dict[str, Any] = field(default_factory=dict)
    status: ExportStatus = ExportStatus.PENDING
    priority: ExportPriority = ExportPriority.NORMAL

    # Progress tracking
    progress: float = 0.0
    current_stage: str = ""
    stage_progress: float = 0.0

    # Timing
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_completion: Optional[datetime] = None

    # Results
    output_path: Optional[str] = None
    output_size: Optional[int] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Processing info
    worker_id: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3

    # Resource usage
    cpu_usage: float = 0.0
    memory_usage: int = 0  # MB
    gpu_usage: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert job to dictionary"""
        return {
            'id': self.id,
            'timeline_id': self.timeline_id,
            'format': self.format.value,
            'settings': self.settings,
            'status': self.status.value,
            'priority': self.priority.value,
            'progress': self.progress,
            'current_stage': self.current_stage,
            'stage_progress': self.stage_progress,
            'created_at': self.created_at.isoformat(),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'estimated_completion': self.estimated_completion.isoformat() if self.estimated_completion else None,
            'output_path': self.output_path,
            'output_size': self.output_size,
            'error_message': self.error_message,
            'metadata': self.metadata,
            'worker_id': self.worker_id,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'cpu_usage': self.cpu_usage,
            'memory_usage': self.memory_usage,
            'gpu_usage': self.gpu_usage
        }

    def update_progress(self, progress: float, stage: str = "", stage_progress: float = 0.0) -> None:
        """Update job progress"""
        self.progress = max(0.0, min(1.0, progress))
        self.current_stage = stage
        self.stage_progress = stage_progress

        if progress > 0 and not self.started_at:
            self.started_at = datetime.now()

    def mark_completed(self, output_path: str, output_size: int) -> None:
        """Mark job as completed"""
        self.status = ExportStatus.COMPLETED
        self.completed_at = datetime.now()
        self.output_path = output_path
        self.output_size = output_size
        self.progress = 1.0

    def mark_failed(self, error_message: str) -> None:
        """Mark job as failed"""
        self.status = ExportStatus.FAILED
        self.completed_at = datetime.now()
        self.error_message = error_message
        self.retry_count += 1

    def can_retry(self) -> bool:
        """Check if job can be retried"""
        return self.retry_count < self.max_retries and self.status == ExportStatus.FAILED


class ExportWorker:
    """Individual export worker"""

    def __init__(self, worker_id: str, export_service: 'ExportService'):
        self.worker_id = worker_id
        self.export_service = export_service
        self.current_job: Optional[ExportJob] = None
        self.is_running = False
        self._stop_event = threading.Event()

    async def start(self) -> None:
        """Start the worker"""
        self.is_running = True
        self._stop_event.clear()

        while not self._stop_event.is_set():
            try:
                # Get next job from queue
                job = await self.export_service.get_next_job()
                if job:
                    await self.process_job(job)
                else:
                    await asyncio.sleep(1)  # No jobs available
            except Exception as e:
                logging.error(f"Worker {self.worker_id} error: {e}")
                await asyncio.sleep(5)

    async def stop(self) -> None:
        """Stop the worker"""
        self.is_running = False
        self._stop_event.set()

        if self.current_job:
            await self.export_service.cancel_job(self.current_job.id)

    async def process_job(self, job: ExportJob) -> None:
        """Process a single export job"""
        self.current_job = job
        job.worker_id = self.worker_id
        job.status = ExportStatus.PROCESSING
        job.started_at = datetime.now()

        try:
            # Estimate completion time
            job.estimated_completion = datetime.now() + timedelta(minutes=30)

            # Process the export
            await self._process_export(job)

            # Mark as completed
            job.mark_completed(f"/exports/{job.id}.{job.format.value}", 0)

        except Exception as e:
            logging.error(f"Export job {job.id} failed: {e}")
            job.mark_failed(str(e))

            # Retry if possible
            if job.can_retry():
                await self.export_service.retry_job(job.id)
            else:
                logging.error(f"Export job {job.id} exceeded max retries")

        finally:
            self.current_job = None

    async def _process_export(self, job: ExportJob) -> None:
        """Internal export processing logic"""
        # This would integrate with FFmpeg or other export tools
        stages = [
            ("Validating timeline", 0.1),
            ("Preparing assets", 0.2),
            ("Processing video", 0.7),
            ("Processing audio", 0.8),
            ("Finalizing export", 0.95),
            ("Quality validation", 1.0)
        ]

        for stage_name, stage_progress in stages:
            job.update_progress(stage_progress, stage_name)
            await self.export_service.notify_progress(job.id, stage_progress, stage_name)

            # Simulate processing time
            await asyncio.sleep(2)

            # Update resource usage
            await self._update_resource_usage(job)

    async def _update_resource_usage(self, job: ExportJob) -> None:
        """Update job resource usage"""
        try:
            # Get current process info
            process = psutil.Process()
            job.cpu_usage = process.cpu_percent()
            job.memory_usage = process.memory_info().rss // 1024 // 1024  # MB

            # Get GPU info if available
            try:
                gpus = GPUtil.getGPUs()
                if gpus:
                    job.gpu_usage = gpus[0].load * 100
            except:
                pass  # GPU monitoring not available

        except Exception as e:
            logging.warning(f"Could not update resource usage: {e}")


class ExportService:
    """Main export service with queue management"""

    def __init__(self, max_concurrent_jobs: int = 3):
        self.max_concurrent_jobs = max_concurrent_jobs
        self.jobs: Dict[str, ExportJob] = {}
        self.job_queue: queue.PriorityQueue = queue.PriorityQueue()
        self.workers: List[ExportWorker] = []
        self.progress_callbacks: Dict[str, List[Callable]] = {}
        self.is_running = False

        # Configuration
        self.output_directory = Path("exports")
        self.temp_directory = Path("temp/exports")
        self.max_queue_size = 1000

        # Resource monitoring
        self.resource_check_interval = 30  # seconds
        self.last_resource_check = time.time()

        # Setup directories
        self._setup_directories()

        # Setup logging
        self.logger = logging.getLogger("ExportService")

    def _setup_directories(self) -> None:
        """Setup export directories"""
        try:
            self.output_directory.mkdir(exist_ok=True)
            self.temp_directory.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            self.logger.error(f"Failed to setup directories: {e}")

    async def start(self) -> None:
        """Start the export service"""
        if self.is_running:
            return

        self.is_running = True
        self.logger.info("Starting export service")

        # Start workers
        for i in range(self.max_concurrent_jobs):
            worker = ExportWorker(f"worker_{i+1}", self)
            self.workers.append(worker)
            asyncio.create_task(worker.start())

        # Start resource monitoring
        asyncio.create_task(self._monitor_resources())

        self.logger.info(f"Export service started with {len(self.workers)} workers")

    async def stop(self) -> None:
        """Stop the export service"""
        if not self.is_running:
            return

        self.is_running = False
        self.logger.info("Stopping export service")

        # Stop all workers
        for worker in self.workers:
            await worker.stop()

        self.workers.clear()
        self.logger.info("Export service stopped")

    async def create_export_job(
        self,
        timeline_id: str,
        format: ExportFormat,
        settings: Dict[str, Any],
        priority: ExportPriority = ExportPriority.NORMAL
    ) -> str:
        """Create a new export job"""
        if not self.is_running:
            raise RuntimeError("Export service is not running")

        if self.job_queue.qsize() >= self.max_queue_size:
            raise RuntimeError("Export queue is full")

        # Validate timeline exists (would check database in real implementation)
        if not await self._validate_timeline(timeline_id):
            raise ValueError(f"Timeline {timeline_id} not found")

        # Create job
        job = ExportJob(
            timeline_id=timeline_id,
            format=format,
            settings=settings,
            priority=priority
        )

        # Store job
        self.jobs[job.id] = job

        # Add to queue with priority (Python PriorityQueue uses negative for higher priority)
        queue_priority = -priority.value
        self.job_queue.put((queue_priority, job.created_at.timestamp(), job))

        self.logger.info(f"Created export job {job.id} for timeline {timeline_id}")
        return job.id

    async def get_next_job(self) -> Optional[ExportJob]:
        """Get next job from queue"""
        try:
            priority, timestamp, job = self.job_queue.get_nowait()
            job.status = ExportStatus.PROCESSING
            return job
        except queue.Empty:
            return None

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel an export job"""
        if job_id not in self.jobs:
            return False

        job = self.jobs[job_id]

        if job.status in [ExportStatus.COMPLETED, ExportStatus.FAILED, ExportStatus.CANCELLED]:
            return False

        job.status = ExportStatus.CANCELLED
        job.completed_at = datetime.now()

        # Remove from queue if still pending
        if job.status == ExportStatus.PENDING:
            # Note: In a real implementation, we'd need to search and remove from queue
            pass

        self.logger.info(f"Cancelled export job {job_id}")
        await self.notify_progress(job_id, 0, "Cancelled")
        return True

    async def retry_job(self, job_id: str) -> bool:
        """Retry a failed export job"""
        if job_id not in self.jobs:
            return False

        job = self.jobs[job_id]

        if not job.can_retry():
            return False

        job.status = ExportStatus.PENDING
        job.progress = 0.0
        job.error_message = None
        job.started_at = None
        job.completed_at = None

        # Re-queue the job
        queue_priority = -job.priority.value
        self.job_queue.put((queue_priority, job.created_at.timestamp(), job))

        self.logger.info(f"Retrying export job {job_id}")
        return True

    async def get_job_status(self, job_id: str) -> Optional[ExportJob]:
        """Get export job status"""
        return self.jobs.get(job_id)

    async def list_jobs(
        self,
        timeline_id: Optional[str] = None,
        status: Optional[ExportStatus] = None
    ) -> List[ExportJob]:
        """List export jobs with optional filtering"""
        jobs = list(self.jobs.values())

        if timeline_id:
            jobs = [job for job in jobs if job.timeline_id == timeline_id]

        if status:
            jobs = [job for job in jobs if job.status == status]

        # Sort by creation time (newest first)
        jobs.sort(key=lambda j: j.created_at, reverse=True)
        return jobs

    async def get_queue_status(self) -> Dict[str, Any]:
        """Get queue status information"""
        return {
            'queue_size': self.job_queue.qsize(),
            'max_queue_size': self.max_queue_size,
            'active_workers': len([w for w in self.workers if w.current_job is not None]),
            'total_workers': len(self.workers),
            'pending_jobs': len([j for j in self.jobs.values() if j.status == ExportStatus.PENDING]),
            'processing_jobs': len([j for j in self.jobs.values() if j.status == ExportStatus.PROCESSING]),
            'completed_jobs': len([j for j in self.jobs.values() if j.status == ExportStatus.COMPLETED]),
            'failed_jobs': len([j for j in self.jobs.values() if j.status == ExportStatus.FAILED])
        }

    async def add_progress_callback(self, job_id: str, callback: Callable) -> None:
        """Add progress callback for a job"""
        if job_id not in self.progress_callbacks:
            self.progress_callbacks[job_id] = []

        self.progress_callbacks[job_id].append(callback)

    async def remove_progress_callback(self, job_id: str, callback: Callable) -> None:
        """Remove progress callback for a job"""
        if job_id in self.progress_callbacks:
            try:
                self.progress_callbacks[job_id].remove(callback)
            except ValueError:
                pass

    async def notify_progress(self, job_id: str, progress: float, message: str) -> None:
        """Notify progress callbacks"""
        if job_id in self.progress_callbacks:
            for callback in self.progress_callbacks[job_id]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(job_id, progress, message)
                    else:
                        callback(job_id, progress, message)
                except Exception as e:
                    self.logger.warning(f"Progress callback error: {e}")

    async def _validate_timeline(self, timeline_id: str) -> bool:
        """Validate timeline exists and is exportable"""
        # In a real implementation, this would check the database
        # For now, just check if it's a valid UUID format
        try:
            uuid.UUID(timeline_id)
            return True
        except ValueError:
            return False

    async def _monitor_resources(self) -> None:
        """Monitor system resources"""
        while self.is_running:
            try:
                current_time = time.time()
                if current_time - self.last_resource_check > self.resource_check_interval:
                    await self._check_resource_limits()
                    self.last_resource_check = current_time

                await asyncio.sleep(10)
            except Exception as e:
                self.logger.error(f"Resource monitoring error: {e}")
                await asyncio.sleep(30)

    async def _check_resource_limits(self) -> None:
        """Check and enforce resource limits"""
        try:
            # Check memory usage
            memory = psutil.virtual_memory()
            memory_usage_percent = memory.percent

            if memory_usage_percent > 90:
                self.logger.warning(f"High memory usage: {memory_usage_percent}%")
                # Could pause low-priority jobs here

            # Check disk space
            disk = psutil.disk_usage(str(self.output_directory))
            disk_usage_percent = disk.percent

            if disk_usage_percent > 95:
                self.logger.error(f"Low disk space: {disk_usage_percent}%")
                # Could pause all exports here

        except Exception as e:
            self.logger.error(f"Resource check error: {e}")

    async def cleanup_old_exports(self, max_age_hours: int = 168) -> int:
        """Clean up old export files and jobs"""
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        cleaned_count = 0

        try:
            # Clean up old job records
            old_jobs = [
                job_id for job_id, job in self.jobs.items()
                if job.completed_at and job.completed_at < cutoff_time
            ]

            for job_id in old_jobs:
                del self.jobs[job_id]
                cleaned_count += 1

            # Clean up old export files
            for file_path in self.output_directory.iterdir():
                if file_path.is_file():
                    file_age = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if file_age < cutoff_time:
                        try:
                            file_path.unlink()
                            cleaned_count += 1
                        except Exception as e:
                            self.logger.warning(f"Could not delete old export file {file_path}: {e}")

            self.logger.info(f"Cleaned up {cleaned_count} old exports")
            return cleaned_count

        except Exception as e:
            self.logger.error(f"Cleanup error: {e}")
            return 0

    async def get_service_stats(self) -> Dict[str, Any]:
        """Get service statistics"""
        return {
            'total_jobs': len(self.jobs),
            'queue_size': self.job_queue.qsize(),
            'active_workers': len([w for w in self.workers if w.current_job is not None]),
            'uptime_seconds': time.time() - (self._start_time if hasattr(self, '_start_time') else time.time()),
            'resource_usage': await self._get_resource_usage()
        }

    async def _get_resource_usage(self) -> Dict[str, Any]:
        """Get current resource usage"""
        try:
            memory = psutil.virtual_memory()
            cpu_percent = psutil.cpu_percent(interval=1)

            return {
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'memory_used_gb': memory.used // (1024**3),
                'memory_available_gb': memory.available // (1024**3)
            }
        except Exception as e:
            return {'error': str(e)}


# Global export service instance
export_service = ExportService()


async def get_export_service() -> ExportService:
    """Get the global export service instance"""
    return export_service
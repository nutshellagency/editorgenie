"""
Export progress tracking and notification service.

Features:
- Real-time progress tracking for exports
- Multiple notification channels (WebSocket, email, webhook)
- Progress persistence and recovery
- Performance monitoring
- Error notification and recovery
"""

import asyncio
import logging
import time
import json
from pathlib import Path
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
import threading
from concurrent.futures import ThreadPoolExecutor

from src.core.schemas.base import BaseNodeInput, BaseNodeOutput
from src.core.replay.manifest import ReplayManifest


class NotificationChannel(Enum):
    """Notification channel types"""
    WEBSOCKET = "websocket"
    EMAIL = "email"
    WEBHOOK = "webhook"
    LOG = "log"
    DATABASE = "database"


class ProgressStatus(Enum):
    """Progress status types"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


@dataclass
class ProgressInfo:
    """Progress information"""
    job_id: str
    status: ProgressStatus
    progress: float  # 0.0 to 1.0
    stage: str
    message: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    estimated_completion: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NotificationConfig:
    """Notification configuration"""
    channels: List[NotificationChannel]
    webhook_url: Optional[str] = None
    email_recipients: List[str] = field(default_factory=list)
    enable_progress_updates: bool = True
    enable_completion_notifications: bool = True
    enable_error_notifications: bool = True


@dataclass
class ProgressTracker:
    """Progress tracker instance"""
    job_id: str
    total_stages: int
    current_stage: int = 0
    start_time: Optional[float] = None
    last_update: Optional[float] = None
    status: ProgressStatus = ProgressStatus.PENDING
    notification_config: Optional[NotificationConfig] = None
    progress_callbacks: List[Callable] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class ExportProgressTracker:
    """
    Export progress tracking and notification service.

    Provides real-time progress tracking for export operations
    with multiple notification channels.
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.active_trackers: Dict[str, ProgressTracker] = {}
        self.notification_handlers: Dict[NotificationChannel, Callable] = {}
        self.executor = ThreadPoolExecutor(max_workers=2)
        self._setup_notification_handlers()

    def _setup_notification_handlers(self):
        """Setup notification handlers"""
        self.notification_handlers[NotificationChannel.LOG] = self._handle_log_notification
        self.notification_handlers[NotificationChannel.DATABASE] = self._handle_database_notification
        # WebSocket and webhook handlers would be implemented based on specific requirements

    def _handle_log_notification(self, progress_info: ProgressInfo):
        """Handle log notifications"""
        if progress_info.status == ProgressStatus.RUNNING:
            self.logger.info(f"Export progress [{progress_info.job_id}]: {progress_info.progress".1%"} - {progress_info.message}")
        elif progress_info.status == ProgressStatus.COMPLETED:
            self.logger.info(f"Export completed [{progress_info.job_id}]: {progress_info.message}")
        elif progress_info.status == ProgressStatus.FAILED:
            self.logger.error(f"Export failed [{progress_info.job_id}]: {progress_info.message}")

    def _handle_database_notification(self, progress_info: ProgressInfo):
        """Handle database notifications"""
        # In a real implementation, this would save to database
        # For now, just log the notification
        self.logger.debug(f"Database notification for job {progress_info.job_id}: {progress_info.status}")

    def _handle_webhook_notification(self, progress_info: ProgressInfo, webhook_url: str):
        """Handle webhook notifications"""
        try:
            import requests

            payload = {
                'job_id': progress_info.job_id,
                'status': progress_info.status.value,
                'progress': progress_info.progress,
                'stage': progress_info.stage,
                'message': progress_info.message,
                'timestamp': time.time()
            }

            response = requests.post(webhook_url, json=payload, timeout=5)
            response.raise_for_status()

        except Exception as e:
            self.logger.error(f"Webhook notification failed: {e}")

    def _handle_email_notification(self, progress_info: ProgressInfo, recipients: List[str]):
        """Handle email notifications"""
        # In a real implementation, this would send emails
        # For now, just log the notification
        self.logger.info(f"Email notification for job {progress_info.job_id} to {recipients}: {progress_info.message}")

    def create_tracker(self, job_id: str, total_stages: int = 1,
                      notification_config: Optional[NotificationConfig] = None) -> str:
        """Create a new progress tracker"""
        tracker = ProgressTracker(
            job_id=job_id,
            total_stages=total_stages,
            notification_config=notification_config or NotificationConfig(channels=[NotificationChannel.LOG])
        )

        self.active_trackers[job_id] = tracker
        self.logger.info(f"Created progress tracker for job {job_id}")

        return job_id

    def start_job(self, job_id: str):
        """Start tracking a job"""
        if job_id not in self.active_trackers:
            raise ValueError(f"Tracker not found for job {job_id}")

        tracker = self.active_trackers[job_id]
        tracker.status = ProgressStatus.RUNNING
        tracker.start_time = time.time()
        tracker.last_update = time.time()

        # Send start notification
        self._send_notification(ProgressInfo(
            job_id=job_id,
            status=ProgressStatus.RUNNING,
            progress=0.0,
            stage="Starting export",
            message="Export job started",
            start_time=tracker.start_time,
            metadata=tracker.metadata
        ), tracker.notification_config)

    def update_progress(self, job_id: str, progress: float, stage: str, message: str,
                       metadata: Optional[Dict] = None):
        """Update job progress"""
        if job_id not in self.active_trackers:
            self.logger.warning(f"Tracker not found for job {job_id}")
            return

        tracker = self.active_trackers[job_id]
        if tracker.status != ProgressStatus.RUNNING:
            return

        tracker.last_update = time.time()

        # Calculate overall progress
        stage_progress = tracker.current_stage / tracker.total_stages
        overall_progress = stage_progress + (progress / tracker.total_stages)

        progress_info = ProgressInfo(
            job_id=job_id,
            status=ProgressStatus.RUNNING,
            progress=min(overall_progress, 0.99),  # Cap at 99% until completion
            stage=stage,
            message=message,
            start_time=tracker.start_time,
            metadata=metadata or {}
        )

        # Send progress notification if enabled
        if tracker.notification_config and tracker.notification_config.enable_progress_updates:
            self._send_notification(progress_info, tracker.notification_config)

        # Call progress callbacks
        for callback in tracker.progress_callbacks:
            try:
                callback(progress_info)
            except Exception as e:
                self.logger.error(f"Progress callback failed: {e}")

    def complete_stage(self, job_id: str, next_stage: Optional[str] = None):
        """Mark current stage as complete and move to next"""
        if job_id not in self.active_trackers:
            return

        tracker = self.active_trackers[job_id]
        tracker.current_stage += 1

        if next_stage:
            self.update_progress(
                job_id,
                0.0,
                next_stage,
                f"Starting stage: {next_stage}"
            )

    def complete_job(self, job_id: str, message: str = "Export completed successfully",
                    metadata: Optional[Dict] = None):
        """Mark job as completed"""
        if job_id not in self.active_trackers:
            return

        tracker = self.active_trackers[job_id]
        tracker.status = ProgressStatus.COMPLETED
        tracker.end_time = time.time()

        progress_info = ProgressInfo(
            job_id=job_id,
            status=ProgressStatus.COMPLETED,
            progress=1.0,
            stage="Export completed",
            message=message,
            start_time=tracker.start_time,
            end_time=tracker.end_time,
            metadata=metadata or {}
        )

        # Send completion notification
        if tracker.notification_config and tracker.notification_config.enable_completion_notifications:
            self._send_notification(progress_info, tracker.notification_config)

        self.logger.info(f"Job {job_id} completed successfully")

    def fail_job(self, job_id: str, error_message: str, metadata: Optional[Dict] = None):
        """Mark job as failed"""
        if job_id not in self.active_trackers:
            return

        tracker = self.active_trackers[job_id]
        tracker.status = ProgressStatus.FAILED
        tracker.end_time = time.time()

        progress_info = ProgressInfo(
            job_id=job_id,
            status=ProgressStatus.FAILED,
            progress=0.0,
            stage="Export failed",
            message=error_message,
            start_time=tracker.start_time,
            end_time=tracker.end_time,
            metadata=metadata or {}
        )

        # Send error notification
        if tracker.notification_config and tracker.notification_config.enable_error_notifications:
            self._send_notification(progress_info, tracker.notification_config)

        self.logger.error(f"Job {job_id} failed: {error_message}")

    def cancel_job(self, job_id: str):
        """Cancel a job"""
        if job_id not in self.active_trackers:
            return

        tracker = self.active_trackers[job_id]
        tracker.status = ProgressStatus.CANCELLED
        tracker.end_time = time.time()

        progress_info = ProgressInfo(
            job_id=job_id,
            status=ProgressStatus.CANCELLED,
            progress=0.0,
            stage="Export cancelled",
            message="Export was cancelled",
            start_time=tracker.start_time,
            end_time=tracker.end_time
        )

        self._send_notification(progress_info, tracker.notification_config)
        self.logger.info(f"Job {job_id} cancelled")

    def _send_notification(self, progress_info: ProgressInfo, config: Optional[NotificationConfig]):
        """Send notification through configured channels"""
        if not config:
            return

        for channel in config.channels:
            try:
                if channel == NotificationChannel.WEBSOCKET:
                    # WebSocket notification would be handled by WebSocket service
                    pass
                elif channel == NotificationChannel.WEBHOOK and config.webhook_url:
                    self._handle_webhook_notification(progress_info, config.webhook_url)
                elif channel == NotificationChannel.EMAIL and config.email_recipients:
                    self._handle_email_notification(progress_info, config.email_recipients)
                else:
                    # Use registered handler
                    handler = self.notification_handlers.get(channel)
                    if handler:
                        handler(progress_info)

            except Exception as e:
                self.logger.error(f"Notification failed for channel {channel}: {e}")

    def get_job_status(self, job_id: str) -> Optional[ProgressInfo]:
        """Get current status of a job"""
        if job_id not in self.active_trackers:
            return None

        tracker = self.active_trackers[job_id]

        return ProgressInfo(
            job_id=job_id,
            status=tracker.status,
            progress=tracker.current_stage / tracker.total_stages,
            stage=f"Stage {tracker.current_stage}/{tracker.total_stages}",
            message=f"Job {tracker.status.value}",
            start_time=tracker.start_time,
            metadata=tracker.metadata
        )

    def add_progress_callback(self, job_id: str, callback: Callable):
        """Add progress callback for a job"""
        if job_id in self.active_trackers:
            self.active_trackers[job_id].progress_callbacks.append(callback)

    def get_active_jobs(self) -> List[str]:
        """Get list of active job IDs"""
        return list(self.active_trackers.keys())

    def cleanup_job(self, job_id: str):
        """Clean up completed job tracker"""
        if job_id in self.active_trackers:
            del self.active_trackers[job_id]
            self.logger.debug(f"Cleaned up tracker for job {job_id}")

    def cleanup_old_jobs(self, max_age_hours: float = 24.0):
        """Clean up old completed/failed jobs"""
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600

        to_remove = []
        for job_id, tracker in self.active_trackers.items():
            if tracker.status in [ProgressStatus.COMPLETED, ProgressStatus.FAILED, ProgressStatus.CANCELLED]:
                if tracker.end_time and (current_time - tracker.end_time) > max_age_seconds:
                    to_remove.append(job_id)

        for job_id in to_remove:
            self.cleanup_job(job_id)

        if to_remove:
            self.logger.info(f"Cleaned up {len(to_remove)} old job trackers")

    def get_job_statistics(self) -> Dict[str, Any]:
        """Get statistics about tracked jobs"""
        if not self.active_trackers:
            return {'total_jobs': 0}

        status_counts = {}
        for tracker in self.active_trackers.values():
            status_counts[tracker.status.value] = status_counts.get(tracker.status.value, 0) + 1

        total_time = 0
        completed_jobs = 0
        for tracker in self.active_trackers.values():
            if tracker.status == ProgressStatus.COMPLETED and tracker.start_time and tracker.end_time:
                total_time += tracker.end_time - tracker.start_time
                completed_jobs += 1

        avg_completion_time = total_time / completed_jobs if completed_jobs > 0 else 0

        return {
            'total_jobs': len(self.active_trackers),
            'status_breakdown': status_counts,
            'average_completion_time': avg_completion_time,
            'active_jobs': len([t for t in self.active_trackers.values() if t.status == ProgressStatus.RUNNING])
        }

    def cleanup(self):
        """Cleanup resources"""
        self.executor.shutdown(wait=True)
        self.active_trackers.clear()
        self.logger.info("ExportProgressTracker cleanup completed")


# Global progress tracker instance
_progress_tracker = None

def get_progress_tracker() -> ExportProgressTracker:
    """Get global progress tracker instance"""
    global _progress_tracker
    if _progress_tracker is None:
        _progress_tracker = ExportProgressTracker()
    return _progress_tracker


def create_export_tracker(job_id: str, total_stages: int = 5,
                         notification_config: Optional[NotificationConfig] = None) -> str:
    """Create export progress tracker"""
    tracker = get_progress_tracker()
    return tracker.create_tracker(job_id, total_stages, notification_config)


def update_export_progress(job_id: str, progress: float, stage: str, message: str,
                          metadata: Optional[Dict] = None):
    """Update export progress"""
    tracker = get_progress_tracker()
    tracker.update_progress(job_id, progress, stage, message, metadata)


def complete_export_stage(job_id: str, next_stage: Optional[str] = None):
    """Complete current export stage"""
    tracker = get_progress_tracker()
    tracker.complete_stage(job_id, next_stage)


def complete_export_job(job_id: str, message: str = "Export completed successfully",
                       metadata: Optional[Dict] = None):
    """Complete export job"""
    tracker = get_progress_tracker()
    tracker.complete_job(job_id, message, metadata)


def fail_export_job(job_id: str, error_message: str, metadata: Optional[Dict] = None):
    """Fail export job"""
    tracker = get_progress_tracker()
    tracker.fail_job(job_id, error_message, metadata)


def get_export_status(job_id: str) -> Optional[ProgressInfo]:
    """Get export status"""
    tracker = get_progress_tracker()
    return tracker.get_job_status(job_id)


def cancel_export_job(job_id: str):
    """Cancel export job"""
    tracker = get_progress_tracker()
    tracker.cancel_job(job_id)
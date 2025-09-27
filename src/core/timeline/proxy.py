"""Proxy video generation service using FFmpeg."""

import asyncio
import json
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import logging
import time
from datetime import datetime
import shutil

from src.infrastructure.logging.structured_logger import StructuredLogger
from src.infrastructure.logging.opentelemetry import (
    trace_operation,
    record_video_processing_metrics
)


@dataclass
class ProxyQualitySettings:
    """Settings for proxy video quality."""
    resolution: str = "640x360"  # Width x Height
    bitrate: str = "800k"        # Target bitrate
    fps: int = 24               # Target FPS
    codec: str = "libx264"      # Video codec
    format: str = "mp4"         # Output format
    quality: str = "medium"     # Quality preset (fast, medium, slow)


@dataclass
class ProxyGenerationJob:
    """Represents a proxy generation job."""
    job_id: str
    source_path: str
    output_path: str
    settings: ProxyQualitySettings
    status: str = "pending"  # pending, running, completed, failed
    progress: float = 0.0
    error_message: Optional[str] = None
    created_at: datetime = None
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.metadata is None:
            self.metadata = {}


class ProxyGenerationService:
    """Service for generating proxy videos using FFmpeg."""

    def __init__(self, output_dir: str = "proxies"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.logger = StructuredLogger("proxy_service")
        self.active_jobs: Dict[str, ProxyGenerationJob] = {}
        self.job_queue: asyncio.Queue = asyncio.Queue()

        # Quality presets
        self.quality_presets = {
            "low": ProxyQualitySettings(
                resolution="480x270",
                bitrate="400k",
                fps=15,
                quality="fast"
            ),
            "medium": ProxyQualitySettings(
                resolution="640x360",
                bitrate="800k",
                fps=24,
                quality="medium"
            ),
            "high": ProxyQualitySettings(
                resolution="1280x720",
                bitrate="2000k",
                fps=30,
                quality="slow"
            ),
            "ultra": ProxyQualitySettings(
                resolution="1920x1080",
                bitrate="4000k",
                fps=30,
                quality="slow"
            )
        }

    def calculate_optimal_proxy_settings(
        self,
        source_path: str,
        target_resolution: Optional[str] = None
    ) -> ProxyQualitySettings:
        """Calculate optimal proxy settings based on source video."""
        try:
            # Get source video info
            probe_cmd = [
                "ffprobe", "-v", "quiet", "-print_format", "json",
                "-show_format", "-show_streams", source_path
            ]

            result = subprocess.run(probe_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                self.logger.warning("Failed to probe source video", source_path=source_path)
                return self.quality_presets["medium"]

            probe_data = json.loads(result.stdout)

            # Extract video stream info
            video_stream = None
            for stream in probe_data.get("streams", []):
                if stream.get("codec_type") == "video":
                    video_stream = stream
                    break

            if not video_stream:
                self.logger.warning("No video stream found", source_path=source_path)
                return self.quality_presets["medium"]

            # Get source dimensions and bitrate
            source_width = int(video_stream.get("width", 1920))
            source_height = int(video_stream.get("height", 1080))
            source_bitrate = probe_data.get("format", {}).get("bit_rate", "2000000")

            # Calculate target resolution
            if target_resolution:
                target_w, target_h = target_resolution.split("x")
            else:
                # Auto-calculate based on source
                if source_width <= 640:
                    return self.quality_presets["low"]
                elif source_width <= 1280:
                    return self.quality_presets["medium"]
                elif source_width <= 1920:
                    return self.quality_presets["high"]
                else:
                    return self.quality_presets["ultra"]

            # Create custom settings
            return ProxyQualitySettings(
                resolution=f"{target_w}x{target_h}",
                bitrate=f"{int(int(target_w) * int(target_h) * 0.1)}k",  # Rough calculation
                fps=min(30, int(video_stream.get("r_frame_rate", "30").split("/")[0])),
                quality="medium"
            )

        except Exception as e:
            self.logger.error("Error calculating proxy settings", error=str(e))
            return self.quality_presets["medium"]

    def generate_proxy(
        self,
        source_path: str,
        output_path: Optional[str] = None,
        quality: str = "medium",
        custom_settings: Optional[ProxyQualitySettings] = None
    ) -> str:
        """Generate a proxy video file."""
        job_id = f"proxy_{int(time.time())}_{os.path.basename(source_path)}"

        # Determine output path
        if output_path is None:
            source_name = Path(source_path).stem
            output_path = self.output_dir / f"{source_name}_proxy.mp4"

        # Get quality settings
        if custom_settings:
            settings = custom_settings
        else:
            settings = self.quality_presets.get(quality, self.quality_presets["medium"])

        # Create job
        job = ProxyGenerationJob(
            job_id=job_id,
            source_path=source_path,
            output_path=str(output_path),
            settings=settings
        )

        self.active_jobs[job_id] = job
        self.logger.info(
            "Proxy generation job created",
            job_id=job_id,
            source_path=source_path,
            output_path=str(output_path),
            quality=quality
        )

        # Start generation in background
        asyncio.create_task(self._generate_proxy_async(job))

        return job_id

    async def _generate_proxy_async(self, job: ProxyGenerationJob) -> None:
        """Generate proxy asynchronously."""
        try:
            job.status = "running"
            self.logger.info("Starting proxy generation", job_id=job.job_id)

            with trace_operation(
                "proxy_generation",
                {
                    "proxy.job_id": job.job_id,
                    "proxy.source_path": job.source_path,
                    "proxy.output_path": job.output_path,
                    "proxy.resolution": job.settings.resolution,
                    "proxy.bitrate": job.settings.bitrate,
                }
            ) as span:
                start_time = time.time()

                # Build FFmpeg command
                cmd = self._build_ffmpeg_command(job)

                # Run FFmpeg
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )

                # Monitor progress
                await self._monitor_progress(process, job)

                # Wait for completion
                stdout, stderr = await process.communicate()

                if process.returncode == 0:
                    job.status = "completed"
                    job.progress = 100.0
                    job.completed_at = datetime.utcnow()

                    # Record metrics
                    duration = time.time() - start_time
                    output_size = os.path.getsize(job.output_path) if os.path.exists(job.output_path) else 0

                    record_video_processing_metrics(
                        video_id=job.job_id,
                        duration=duration,
                        file_size=output_size,
                        success=True,
                        operation="proxy_generation"
                    )

                    self.logger.info(
                        "Proxy generation completed",
                        job_id=job.job_id,
                        duration=duration,
                        output_size=output_size
                    )

                    span.set_status(trace.Status(trace.StatusCode.OK))

                else:
                    job.status = "failed"
                    job.error_message = stderr.decode()
                    job.completed_at = datetime.utcnow()

                    # Record failed metrics
                    duration = time.time() - start_time

                    record_video_processing_metrics(
                        video_id=job.job_id,
                        duration=duration,
                        file_size=0,
                        success=False,
                        operation="proxy_generation",
                        error=job.error_message
                    )

                    self.logger.error(
                        "Proxy generation failed",
                        job_id=job.job_id,
                        error=job.error_message,
                        duration=duration
                    )

                    span.set_status(trace.Status(trace.StatusCode.ERROR, job.error_message))

        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()

            self.logger.error(
                "Proxy generation exception",
                job_id=job.job_id,
                error=str(e)
            )

    def _build_ffmpeg_command(self, job: ProxyGenerationJob) -> List[str]:
        """Build FFmpeg command for proxy generation."""
        cmd = [
            "ffmpeg", "-y",  # Overwrite output file
            "-i", job.source_path,  # Input file
            "-vf", f"scale={job.settings.resolution}",  # Scale filter
            "-r", str(job.settings.fps),  # Frame rate
            "-c:v", job.settings.codec,  # Video codec
            "-b:v", job.settings.bitrate,  # Video bitrate
            "-preset", job.settings.quality,  # Quality preset
            "-c:a", "aac",  # Audio codec
            "-b:a", "128k",  # Audio bitrate
            "-movflags", "+faststart",  # Enable streaming
            job.output_path  # Output file
        ]
        return cmd

    async def _monitor_progress(self, process: asyncio.subprocess.Process, job: ProxyGenerationJob) -> None:
        """Monitor FFmpeg progress."""
        try:
            while True:
                line = await process.stderr.readline()
                if not line:
                    break

                line_str = line.decode().strip()
                self.logger.debug("FFmpeg output", line=line_str, job_id=job.job_id)

                # Parse progress from FFmpeg output
                if "time=" in line_str:
                    # Extract time information and update progress
                    job.progress = min(job.progress + 1.0, 95.0)  # Rough estimate

        except Exception as e:
            self.logger.warning("Progress monitoring error", error=str(e), job_id=job.job_id)

    def get_job_status(self, job_id: str) -> Optional[ProxyGenerationJob]:
        """Get the status of a proxy generation job."""
        return self.active_jobs.get(job_id)

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a proxy generation job."""
        if job_id in self.active_jobs:
            job = self.active_jobs[job_id]
            if job.status == "running":
                job.status = "cancelled"
                return True
        return False

    def cleanup_old_proxies(self, max_age_hours: int = 24) -> int:
        """Clean up old proxy files."""
        cleaned_count = 0
        cutoff_time = datetime.utcnow().timestamp() - (max_age_hours * 3600)

        try:
            for file_path in self.output_dir.glob("*_proxy.*"):
                if file_path.is_file():
                    file_mtime = file_path.stat().st_mtime
                    if file_mtime < cutoff_time:
                        file_path.unlink()
                        cleaned_count += 1

            if cleaned_count > 0:
                self.logger.info(
                    "Cleaned up old proxy files",
                    count=clean_count,
                    max_age_hours=max_age_hours
                )

        except Exception as e:
            self.logger.error("Error cleaning up proxy files", error=str(e))

        return cleaned_count

    def get_proxy_path(self, source_path: str, quality: str = "medium") -> str:
        """Get the expected proxy file path for a source video."""
        source_name = Path(source_path).stem
        return str(self.output_dir / f"{source_name}_proxy_{quality}.mp4")

    def validate_proxy(self, proxy_path: str) -> bool:
        """Validate that a proxy file is valid and playable."""
        try:
            if not os.path.exists(proxy_path):
                return False

            # Use ffprobe to validate the file
            cmd = [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_format", "-show_streams",
                proxy_path
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            if result.returncode != 0:
                return False

            # Check if file has video stream
            probe_data = json.loads(result.stdout)
            video_streams = [
                s for s in probe_data.get("streams", [])
                if s.get("codec_type") == "video"
            ]

            return len(video_streams) > 0

        except Exception as e:
            self.logger.warning("Proxy validation error", proxy_path=proxy_path, error=str(e))
            return False


class ProxyManager:
    """Manager for proxy file operations and caching."""

    def __init__(self, service: ProxyGenerationService):
        self.service = service
        self.proxy_cache: Dict[str, Dict[str, Any]] = {}
        self.logger = StructuredLogger("proxy_manager")

    def get_or_create_proxy(
        self,
        source_path: str,
        quality: str = "medium"
    ) -> Optional[str]:
        """Get existing proxy or create new one."""
        cache_key = f"{source_path}:{quality}"

        # Check cache first
        if cache_key in self.proxy_cache:
            cached_info = self.proxy_cache[cache_key]
            proxy_path = cached_info["path"]

            if os.path.exists(proxy_path) and self.service.validate_proxy(proxy_path):
                self.logger.debug("Using cached proxy", source_path=source_path, proxy_path=proxy_path)
                return proxy_path
            else:
                # Remove invalid cache entry
                del self.proxy_cache[cache_key]

        # Generate new proxy
        proxy_path = self.service.get_proxy_path(source_path, quality)
        job_id = self.service.generate_proxy(source_path, proxy_path, quality)

        # Wait for completion (in real implementation, this would be async)
        import time
        while True:
            job = self.service.get_job_status(job_id)
            if job and job.status in ["completed", "failed"]:
                break
            time.sleep(0.1)

        if job and job.status == "completed":
            # Cache the result
            self.proxy_cache[cache_key] = {
                "path": proxy_path,
                "created_at": datetime.utcnow(),
                "quality": quality
            }
            return proxy_path

        return None

    def cleanup_cache(self, max_age_hours: int = 24) -> int:
        """Clean up old cache entries."""
        cutoff_time = datetime.utcnow().timestamp() - (max_age_hours * 3600)
        removed_count = 0

        for cache_key, cache_info in list(self.proxy_cache.items()):
            if cache_info["created_at"].timestamp() < cutoff_time:
                del self.proxy_cache[cache_key]
                removed_count += 1

        if removed_count > 0:
            self.logger.info("Cleaned up proxy cache", removed_count=removed_count)

        return removed_count

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            "total_entries": len(self.proxy_cache),
            "cache_size_mb": sum(
                os.path.getsize(info["path"]) / (1024 * 1024)
                for info in self.proxy_cache.values()
                if os.path.exists(info["path"])
            )
        }


# Global proxy service instance
_proxy_service = None
_proxy_manager = None


def get_proxy_service() -> ProxyGenerationService:
    """Get the global proxy service instance."""
    global _proxy_service
    if _proxy_service is None:
        _proxy_service = ProxyGenerationService()
    return _proxy_service


def get_proxy_manager() -> ProxyManager:
    """Get the global proxy manager instance."""
    global _proxy_manager
    if _proxy_manager is None:
        service = get_proxy_service()
        _proxy_manager = ProxyManager(service)
    return _proxy_manager


def generate_ffmpeg_proxy(
    source_path: str,
    output_path: Optional[str] = None,
    quality: str = "medium"
) -> str:
    """Convenience function to generate a proxy video."""
    service = get_proxy_service()
    return service.generate_proxy(source_path, output_path, quality)


def calculate_proxy_resolution(
    source_width: int,
    source_height: int,
    target_quality: str = "medium"
) -> Tuple[int, int]:
    """Calculate optimal proxy resolution."""
    quality_multipliers = {
        "low": 0.25,
        "medium": 0.33,
        "high": 0.67,
        "ultra": 1.0
    }

    multiplier = quality_multipliers.get(target_quality, 0.33)

    target_width = int(source_width * multiplier)
    target_height = int(source_height * multiplier)

    # Ensure even dimensions for better codec compatibility
    target_width = target_width - (target_width % 2)
    target_height = target_height - (target_height % 2)

    return target_width, target_height
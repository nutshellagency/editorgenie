"""
Multi-format video export service using FFmpeg.

Supports multiple output formats:
- MP4 with H.264/H.265 codecs
- MOV with ProRes/Animation codecs
- AVI with various codecs
- MKV with advanced features
- WEBM with VP8/VP9/AV1 codecs

Features:
- Format-specific optimizations
- Quality presets and custom settings
- Hardware acceleration support
- Progress tracking and error handling
- Resource management and cleanup
"""

import asyncio
import logging
import os
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import json
import time
import psutil
import threading
from concurrent.futures import ThreadPoolExecutor

from src.core.schemas.base import BaseNodeInput, BaseNodeOutput
from src.core.replay.manifest import ReplayManifest


class ExportFormat(Enum):
    """Supported export formats"""
    MP4 = "mp4"
    MOV = "mov"
    AVI = "avi"
    MKV = "mkv"
    WEBM = "webm"


class VideoCodec(Enum):
    """Supported video codecs"""
    H264 = "libx264"
    H265 = "libx265"
    PRORES = "prores"
    ANIMATION = "qtrle"
    VP8 = "libvpx"
    VP9 = "libvpx-vp9"
    AV1 = "libaom-av1"
    UNCOMPRESSED = "rawvideo"


class AudioCodec(Enum):
    """Supported audio codecs"""
    AAC = "aac"
    MP3 = "mp3"
    PCM = "pcm_s16le"
    OPUS = "opus"
    VORBIS = "vorbis"


class QualityPreset(Enum):
    """Quality presets"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    ULTRA = "ultra"
    CUSTOM = "custom"


@dataclass
class ExportSettings:
    """Export configuration settings"""
    format: ExportFormat
    video_codec: VideoCodec
    audio_codec: AudioCodec
    quality_preset: QualityPreset
    resolution: str
    fps: float
    bitrate: Optional[int] = None
    crf: Optional[int] = None
    custom_options: Dict[str, str] = field(default_factory=dict)
    two_pass: bool = False
    hardware_acceleration: bool = True


@dataclass
class ExportJob:
    """Export job information"""
    job_id: str
    input_path: str
    output_path: str
    settings: ExportSettings
    progress_callback: Optional[callable] = None
    status: str = "pending"
    error_message: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    file_size: Optional[int] = None


@dataclass
class ExportResult:
    """Export operation result"""
    success: bool
    output_path: str
    file_size: int
    duration: float
    error_message: Optional[str] = None
    metadata: Dict[str, any] = field(default_factory=dict)


class MultiFormatExporter:
    """
    Multi-format video export service using FFmpeg.

    Handles various export formats with optimized settings and
    comprehensive error handling.
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.active_jobs: Dict[str, ExportJob] = {}
        self.executor = ThreadPoolExecutor(max_workers=2)
        self._check_ffmpeg_availability()

    def _check_ffmpeg_availability(self):
        """Check if FFmpeg is available"""
        try:
            result = subprocess.run(
                ['ffmpeg', '-version'],
                capture_output=True,
                text=True,
                check=True
            )
            self.logger.info(f"FFmpeg available: {result.stdout.split()[2]}")
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            self.logger.error(f"FFmpeg not available: {e}")
            raise RuntimeError("FFmpeg is required but not available")

    def _get_codec_settings(self, settings: ExportSettings) -> Dict[str, str]:
        """Get codec-specific settings based on format and quality"""
        codec_settings = {}

        # Video codec settings
        if settings.video_codec == VideoCodec.H264:
            if settings.quality_preset == QualityPreset.LOW:
                codec_settings.update({
                    'c:v': 'libx264',
                    'preset': 'fast',
                    'crf': '28' if settings.crf is None else str(settings.crf),
                    'maxrate': '2000k',
                    'bufsize': '4000k'
                })
            elif settings.quality_preset == QualityPreset.MEDIUM:
                codec_settings.update({
                    'c:v': 'libx264',
                    'preset': 'medium',
                    'crf': '23' if settings.crf is None else str(settings.crf),
                    'maxrate': '5000k',
                    'bufsize': '10000k'
                })
            elif settings.quality_preset == QualityPreset.HIGH:
                codec_settings.update({
                    'c:v': 'libx264',
                    'preset': 'slow',
                    'crf': '18' if settings.crf is None else str(settings.crf),
                    'maxrate': '8000k',
                    'bufsize': '16000k'
                })
            elif settings.quality_preset == QualityPreset.ULTRA:
                codec_settings.update({
                    'c:v': 'libx264',
                    'preset': 'veryslow',
                    'crf': '15' if settings.crf is None else str(settings.crf),
                    'maxrate': '12000k',
                    'bufsize': '24000k'
                })

        elif settings.video_codec == VideoCodec.H265:
            if settings.quality_preset == QualityPreset.LOW:
                codec_settings.update({
                    'c:v': 'libx265',
                    'preset': 'fast',
                    'crf': '30' if settings.crf is None else str(settings.crf),
                    'maxrate': '1500k',
                    'bufsize': '3000k'
                })
            elif settings.quality_preset == QualityPreset.MEDIUM:
                codec_settings.update({
                    'c:v': 'libx265',
                    'preset': 'medium',
                    'crf': '25' if settings.crf is None else str(settings.crf),
                    'maxrate': '4000k',
                    'bufsize': '8000k'
                })
            elif settings.quality_preset == QualityPreset.HIGH:
                codec_settings.update({
                    'c:v': 'libx265',
                    'preset': 'slow',
                    'crf': '20' if settings.crf is None else str(settings.crf),
                    'maxrate': '6000k',
                    'bufsize': '12000k'
                })
            elif settings.quality_preset == QualityPreset.ULTRA:
                codec_settings.update({
                    'c:v': 'libx265',
                    'preset': 'veryslow',
                    'crf': '17' if settings.crf is None else str(settings.crf),
                    'maxrate': '10000k',
                    'bufsize': '20000k'
                })

        elif settings.video_codec == VideoCodec.PRORES:
            codec_settings.update({
                'c:v': 'prores',
                'profile:v': '2'  # ProRes 422
            })

        elif settings.video_codec == VideoCodec.ANIMATION:
            codec_settings.update({
                'c:v': 'qtrle',
                'pix_fmt': 'argb'
            })

        elif settings.video_codec == VideoCodec.VP8:
            codec_settings.update({
                'c:v': 'libvpx',
                'b:v': '1000k' if settings.bitrate is None else f"{settings.bitrate//1000}k",
                'crf': '10',
                'deadline': 'good'
            })

        elif settings.video_codec == VideoCodec.VP9:
            codec_settings.update({
                'c:v': 'libvpx-vp9',
                'b:v': '1000k' if settings.bitrate is None else f"{settings.bitrate//1000}k",
                'crf': '20' if settings.crf is None else str(settings.crf),
                'deadline': 'good'
            })

        elif settings.video_codec == VideoCodec.AV1:
            codec_settings.update({
                'c:v': 'libaom-av1',
                'b:v': '800k' if settings.bitrate is None else f"{settings.bitrate//1000}k",
                'crf': '25' if settings.crf is None else str(settings.crf),
                'cpu-used': '4'
            })

        # Audio codec settings
        if settings.audio_codec == AudioCodec.AAC:
            codec_settings.update({
                'c:a': 'aac',
                'b:a': '128k',
                'ar': '48000'
            })
        elif settings.audio_codec == AudioCodec.MP3:
            codec_settings.update({
                'c:a': 'mp3',
                'b:a': '192k'
            })
        elif settings.audio_codec == AudioCodec.PCM:
            codec_settings.update({
                'c:a': 'pcm_s16le',
                'ar': '48000'
            })
        elif settings.audio_codec == AudioCodec.OPUS:
            codec_settings.update({
                'c:a': 'opus',
                'b:a': '96k',
                'compression_level': '10'
            })
        elif settings.audio_codec == AudioCodec.VORBIS:
            codec_settings.update({
                'c:a': 'vorbis',
                'b:a': '128k'
            })

        # Resolution and frame rate
        if settings.resolution != "original":
            codec_settings.update({
                's': settings.resolution,
                'aspect': '16:9'  # Default aspect ratio
            })

        codec_settings['r'] = str(settings.fps)

        # Custom bitrate override
        if settings.bitrate:
            codec_settings['b:v'] = f"{settings.bitrate//1000}k"

        # Custom options
        codec_settings.update(settings.custom_options)

        return codec_settings

    def _build_ffmpeg_command(self, input_path: str, output_path: str, settings: ExportSettings) -> List[str]:
        """Build FFmpeg command for export"""
        cmd = ['ffmpeg', '-y', '-i', input_path]

        # Input options
        cmd.extend(['-hide_banner', '-loglevel', 'info'])

        # Video filter for resolution scaling
        if settings.resolution != "original":
            cmd.extend(['-vf', f'scale={settings.resolution}'])

        # Codec settings
        codec_settings = self._get_codec_settings(settings)
        for key, value in codec_settings.items():
            cmd.extend(['-' + key, value])

        # Format-specific options
        if settings.format == ExportFormat.MP4:
            cmd.extend(['-movflags', '+faststart'])
        elif settings.format == ExportFormat.WEBM:
            cmd.extend(['-f', 'webm'])
        elif settings.format == ExportFormat.MOV:
            cmd.extend(['-f', 'mov'])

        cmd.append(output_path)

        return cmd

    def _check_system_resources(self) -> bool:
        """Check if system has sufficient resources for export"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()

            # Allow export if CPU < 80% and memory < 85%
            return cpu_percent < 80 and memory.percent < 85
        except Exception as e:
            self.logger.warning(f"Could not check system resources: {e}")
            return True  # Assume sufficient resources if check fails

    def _run_ffmpeg_export(self, job: ExportJob) -> ExportResult:
        """Run FFmpeg export in subprocess"""
        try:
            job.status = "running"
            job.start_time = time.time()

            # Check system resources
            if not self._check_system_resources():
                raise RuntimeError("Insufficient system resources for export")

            # Build FFmpeg command
            cmd = self._build_ffmpeg_command(
                job.input_path,
                job.output_path,
                job.settings
            )

            self.logger.info(f"Starting export: {' '.join(cmd)}")

            # Run FFmpeg with progress monitoring
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )

            # Monitor progress
            while True:
                if process.poll() is not None:
                    break

                if job.progress_callback:
                    # Parse FFmpeg output for progress
                    progress = self._parse_ffmpeg_progress(process.stdout)
                    job.progress_callback(progress)

                time.sleep(0.1)

            # Check result
            if process.returncode == 0:
                # Get output file info
                output_path = Path(job.output_path)
                file_size = output_path.stat().st_size if output_path.exists() else 0

                job.status = "completed"
                job.end_time = time.time()
                job.file_size = file_size

                return ExportResult(
                    success=True,
                    output_path=job.output_path,
                    file_size=file_size,
                    duration=time.time() - job.start_time,
                    metadata={'format': job.settings.format.value}
                )
            else:
                error_output = process.stdout.read() if process.stdout else "Unknown error"
                job.status = "failed"
                job.error_message = f"FFmpeg failed with code {process.returncode}: {error_output}"

                return ExportResult(
                    success=False,
                    output_path=job.output_path,
                    file_size=0,
                    duration=time.time() - job.start_time,
                    error_message=job.error_message
                )

        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)

            return ExportResult(
                success=False,
                output_path=job.output_path,
                file_size=0,
                duration=time.time() - job.start_time if job.start_time else 0,
                error_message=str(e)
            )

    def _parse_ffmpeg_progress(self, stdout) -> float:
        """Parse FFmpeg output for progress percentage"""
        try:
            # Read last few lines for progress info
            lines = []
            while True:
                line = stdout.readline()
                if not line:
                    break
                lines.append(line)

            # Look for time/progress information
            for line in reversed(lines[-10:]):  # Check last 10 lines
                if 'time=' in line:
                    # Extract time information and estimate progress
                    # This is a simplified progress estimation
                    return min(90.0, len(lines) * 2)  # Rough estimate

            return 0.0
        except:
            return 0.0

    async def export_video(self, job: ExportJob) -> ExportResult:
        """Export video asynchronously"""
        job_id = job.job_id

        if job_id in self.active_jobs:
            raise ValueError(f"Job {job_id} already exists")

        self.active_jobs[job_id] = job

        try:
            # Run export in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._run_ffmpeg_export,
                job
            )

            return result

        finally:
            # Cleanup
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]

    def get_job_status(self, job_id: str) -> Optional[ExportJob]:
        """Get status of export job"""
        return self.active_jobs.get(job_id)

    def cancel_job(self, job_id: str) -> bool:
        """Cancel export job"""
        job = self.active_jobs.get(job_id)
        if job and job.status == "running":
            job.status = "cancelled"
            return True
        return False

    def get_supported_formats(self) -> List[Dict]:
        """Get list of supported export formats"""
        return [
            {
                'format': ExportFormat.MP4.value,
                'name': 'MP4',
                'description': 'MPEG-4 Part 14',
                'video_codecs': [VideoCodec.H264.value, VideoCodec.H265.value],
                'audio_codecs': [AudioCodec.AAC.value, AudioCodec.MP3.value],
                'extensions': ['.mp4']
            },
            {
                'format': ExportFormat.MOV.value,
                'name': 'QuickTime MOV',
                'description': 'Apple QuickTime Movie',
                'video_codecs': [VideoCodec.PRORES.value, VideoCodec.ANIMATION.value, VideoCodec.H264.value],
                'audio_codecs': [AudioCodec.AAC.value, AudioCodec.PCM.value],
                'extensions': ['.mov']
            },
            {
                'format': ExportFormat.AVI.value,
                'name': 'AVI',
                'description': 'Audio Video Interleave',
                'video_codecs': [VideoCodec.H264.value, VideoCodec.UNCOMPRESSED.value],
                'audio_codecs': [AudioCodec.MP3.value, AudioCodec.PCM.value],
                'extensions': ['.avi']
            },
            {
                'format': ExportFormat.MKV.value,
                'name': 'Matroska MKV',
                'description': 'Matroska Multimedia Container',
                'video_codecs': [VideoCodec.H264.value, VideoCodec.H265.value, VideoCodec.VP9.value],
                'audio_codecs': [AudioCodec.AAC.value, AudioCodec.OPUS.value, AudioCodec.VORBIS.value],
                'extensions': ['.mkv']
            },
            {
                'format': ExportFormat.WEBM.value,
                'name': 'WebM',
                'description': 'WebM Multimedia Container',
                'video_codecs': [VideoCodec.VP8.value, VideoCodec.VP9.value, VideoCodec.AV1.value],
                'audio_codecs': [AudioCodec.OPUS.value, AudioCodec.VORBIS.value],
                'extensions': ['.webm']
            }
        ]

    def validate_settings(self, settings: ExportSettings) -> List[str]:
        """Validate export settings"""
        errors = []

        # Check format compatibility
        if settings.format == ExportFormat.MP4:
            if settings.video_codec not in [VideoCodec.H264, VideoCodec.H265]:
                errors.append("MP4 format requires H.264 or H.265 codec")
        elif settings.format == ExportFormat.MOV:
            if settings.video_codec not in [VideoCodec.PRORES, VideoCodec.ANIMATION, VideoCodec.H264]:
                errors.append("MOV format requires ProRes, Animation, or H.264 codec")
        elif settings.format == ExportFormat.WEBM:
            if settings.video_codec not in [VideoCodec.VP8, VideoCodec.VP9, VideoCodec.AV1]:
                errors.append("WebM format requires VP8, VP9, or AV1 codec")

        # Check resolution format
        if settings.resolution != "original":
            if 'x' not in settings.resolution:
                errors.append("Resolution must be in format 'WIDTHxHEIGHT' or 'original'")

        # Check bitrate range
        if settings.bitrate:
            if not (100 <= settings.bitrate <= 50000):
                errors.append("Bitrate must be between 100 kbps and 50 Mbps")

        # Check CRF range
        if settings.crf:
            if not (0 <= settings.crf <= 51):
                errors.append("CRF must be between 0 and 51")

        return errors

    def estimate_export_time(self, input_path: str, settings: ExportSettings) -> float:
        """Estimate export time in seconds"""
        try:
            # Get input file info
            probe_cmd = [
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_format', '-show_streams', input_path
            ]

            result = subprocess.run(probe_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                return 60.0  # Default estimate

            info = json.loads(result.stdout)
            duration = float(info['format']['duration'])

            # Estimate based on format and quality
            base_time = duration * 0.5  # Base processing time

            if settings.two_pass:
                base_time *= 1.8  # Two-pass takes longer

            if settings.quality_preset in [QualityPreset.HIGH, QualityPreset.ULTRA]:
                base_time *= 1.5  # Higher quality takes longer

            if settings.hardware_acceleration:
                base_time *= 0.7  # Hardware acceleration is faster

            return max(base_time, 10.0)  # Minimum 10 seconds

        except Exception as e:
            self.logger.warning(f"Could not estimate export time: {e}")
            return 60.0  # Default estimate

    def cleanup(self):
        """Cleanup resources"""
        self.executor.shutdown(wait=True)
        self.logger.info("MultiFormatExporter cleanup completed")


# Convenience functions for common exports
def export_mp4_h264(input_path: str, output_path: str, quality: str = "high") -> ExportResult:
    """Export MP4 with H.264 codec"""
    exporter = MultiFormatExporter()
    settings = ExportSettings(
        format=ExportFormat.MP4,
        video_codec=VideoCodec.H264,
        audio_codec=AudioCodec.AAC,
        quality_preset=QualityPreset(quality.upper()),
        resolution="1920x1080",
        fps=30.0
    )

    job = ExportJob(
        job_id=f"mp4_{int(time.time())}",
        input_path=input_path,
        output_path=output_path,
        settings=settings
    )

    return asyncio.run(exporter.export_video(job))


def export_mov_prores(input_path: str, output_path: str) -> ExportResult:
    """Export MOV with ProRes codec"""
    exporter = MultiFormatExporter()
    settings = ExportSettings(
        format=ExportFormat.MOV,
        video_codec=VideoCodec.PRORES,
        audio_codec=AudioCodec.PCM,
        quality_preset=QualityPreset.HIGH,
        resolution="original",
        fps=30.0
    )

    job = ExportJob(
        job_id=f"mov_{int(time.time())}",
        input_path=input_path,
        output_path=output_path,
        settings=settings
    )

    return asyncio.run(exporter.export_video(job))


def export_webm_vp9(input_path: str, output_path: str) -> ExportResult:
    """Export WebM with VP9 codec"""
    exporter = MultiFormatExporter()
    settings = ExportSettings(
        format=ExportFormat.WEBM,
        video_codec=VideoCodec.VP9,
        audio_codec=AudioCodec.OPUS,
        quality_preset=QualityPreset.HIGH,
        resolution="1920x1080",
        fps=30.0
    )

    job = ExportJob(
        job_id=f"webm_{int(time.time())}",
        input_path=input_path,
        output_path=output_path,
        settings=settings
    )

    return asyncio.run(exporter.export_video(job))
"""
Social media optimization service for video exports.

Optimizes videos for different social media platforms:
- YouTube
- TikTok
- Instagram
- Facebook
- Twitter/X

Features:
- Platform-specific format optimization
- Resolution and aspect ratio optimization
- Metadata and SEO optimization
- Quality vs file size optimization
- Performance optimization
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
from concurrent.futures import ThreadPoolExecutor

from src.core.schemas.base import BaseNodeInput, BaseNodeOutput
from src.core.replay.manifest import ReplayManifest


class Platform(Enum):
    """Supported social media platforms"""
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    TWITTER = "twitter"
    LINKEDIN = "linkedin"


@dataclass
class VideoSpecs:
    """Video specifications for platform"""
    max_duration: Optional[float] = None
    preferred_resolution: str = "1920x1080"
    max_file_size: Optional[int] = None  # in bytes
    supported_formats: List[str] = field(default_factory=list)
    preferred_codec: str = "h264"
    max_bitrate: Optional[int] = None
    aspect_ratios: List[str] = field(default_factory=list)


@dataclass
class MetadataSettings:
    """Metadata optimization settings"""
    title: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    thumbnail_path: Optional[str] = None
    privacy_status: str = "public"
    category: Optional[str] = None


@dataclass
class OptimizationSettings:
    """Social media optimization settings"""
    platform: Platform
    target_quality: str = "high"  # low, medium, high, ultra
    optimize_for_mobile: bool = True
    include_metadata: bool = True
    generate_thumbnail: bool = True
    custom_specs: Optional[VideoSpecs] = None
    metadata_settings: Optional[MetadataSettings] = None


@dataclass
class OptimizationResult:
    """Optimization result"""
    success: bool
    output_path: str
    platform: Platform
    original_size: int
    optimized_size: int
    compression_ratio: float
    processing_time: float
    error_message: Optional[str] = None
    metadata: Dict[str, any] = field(default_factory=dict)


class SocialMediaOptimizer:
    """
    Social media optimization service.

    Optimizes videos for different social media platforms
    with platform-specific settings and optimizations.
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.active_optimizations: Dict[str, dict] = {}
        self.executor = ThreadPoolExecutor(max_workers=2)
        self._check_ffmpeg_availability()
        self._load_platform_specs()

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

    def _load_platform_specs(self):
        """Load platform-specific specifications"""
        self.platform_specs = {
            Platform.YOUTUBE: VideoSpecs(
                max_duration=43200.0,  # 12 hours
                preferred_resolution="1920x1080",
                max_file_size=2147483648,  # 2GB
                supported_formats=["mp4", "mov", "avi", "wmv", "flv", "webm"],
                preferred_codec="h264",
                max_bitrate=50000000,  # 50 Mbps
                aspect_ratios=["16:9", "9:16", "1:1", "4:3"]
            ),
            Platform.TIKTOK: VideoSpecs(
                max_duration=600.0,  # 10 minutes
                preferred_resolution="1080x1920",
                max_file_size=104857600,  # 100MB
                supported_formats=["mp4", "mov", "webm"],
                preferred_codec="h264",
                max_bitrate=20000000,  # 20 Mbps
                aspect_ratios=["9:16", "1:1"]
            ),
            Platform.INSTAGRAM: VideoSpecs(
                max_duration=90.0,  # 90 seconds for feed, 15 minutes for IGTV
                preferred_resolution="1080x1080",
                max_file_size=104857600,  # 100MB
                supported_formats=["mp4", "mov"],
                preferred_codec="h264",
                max_bitrate=15000000,  # 15 Mbps
                aspect_ratios=["16:9", "9:16", "1:1", "4:3"]
            ),
            Platform.FACEBOOK: VideoSpecs(
                max_duration=14400.0,  # 4 hours
                preferred_resolution="1280x720",
                max_file_size=4294967296,  # 4GB
                supported_formats=["mp4", "mov", "avi", "wmv"],
                preferred_codec="h264",
                max_bitrate=30000000,  # 30 Mbps
                aspect_ratios=["16:9", "9:16", "1:1", "4:3"]
            ),
            Platform.TWITTER: VideoSpecs(
                max_duration=140.0,  # 2 minutes 20 seconds
                preferred_resolution="1280x720",
                max_file_size=524288000,  # 500MB
                supported_formats=["mp4", "mov", "webm"],
                preferred_codec="h264",
                max_bitrate=25000000,  # 25 Mbps
                aspect_ratios=["16:9", "1:1"]
            ),
            Platform.LINKEDIN: VideoSpecs(
                max_duration=600.0,  # 10 minutes
                preferred_resolution="1920x1080",
                max_file_size=209715200,  # 200MB
                supported_formats=["mp4", "mov", "webm"],
                preferred_codec="h264",
                max_bitrate=20000000,  # 20 Mbps
                aspect_ratios=["16:9", "1:1"]
            )
        }

    def _get_video_info(self, input_path: str) -> Tuple[Dict, float]:
        """Get video information"""
        try:
            cmd = [
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_format', '-show_streams', input_path
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            info = json.loads(result.stdout)

            # Get video stream info
            video_stream = None
            for stream in info['streams']:
                if stream['codec_type'] == 'video':
                    video_stream = stream
                    break

            if not video_stream:
                raise ValueError("No video stream found")

            # Get file size
            file_size = int(info['format']['size'])
            duration = float(info['format']['duration'])

            video_info = {
                'width': int(video_stream['width']),
                'height': int(video_stream['height']),
                'fps': float(video_stream.get('r_frame_rate', '30').split('/')[0]),
                'bitrate': int(video_stream.get('bit_rate', '5000000')),
                'codec': video_stream.get('codec_name', 'unknown'),
                'file_size': file_size,
                'duration': duration
            }

            return video_info, duration

        except Exception as e:
            self.logger.error(f"Failed to get video info: {e}")
            raise RuntimeError(f"Could not analyze video file: {e}")

    def _calculate_optimal_settings(self, input_info: Dict, settings: OptimizationSettings) -> Dict:
        """Calculate optimal encoding settings for platform"""
        platform_spec = self.platform_specs[settings.platform]

        # Base settings
        optimal_settings = {
            'codec': platform_spec.preferred_codec,
            'resolution': platform_spec.preferred_resolution,
            'fps': min(input_info['fps'], 30),  # Most platforms prefer 30fps max
            'bitrate': platform_spec.max_bitrate // 4,  # Conservative bitrate
            'format': 'mp4'  # Most compatible format
        }

        # Quality adjustments
        if settings.target_quality == "low":
            optimal_settings['bitrate'] = optimal_settings['bitrate'] // 2
            optimal_settings['resolution'] = "854x480"
        elif settings.target_quality == "medium":
            optimal_settings['bitrate'] = optimal_settings['bitrate'] * 3 // 4
            optimal_settings['resolution'] = "1280x720"
        elif settings.target_quality == "high":
            optimal_settings['bitrate'] = min(optimal_settings['bitrate'], platform_spec.max_bitrate // 2)
        elif settings.target_quality == "ultra":
            optimal_settings['bitrate'] = min(optimal_settings['bitrate'] * 2, platform_spec.max_bitrate)

        # Mobile optimization
        if settings.optimize_for_mobile:
            optimal_settings['bitrate'] = min(optimal_settings['bitrate'], 2500000)  # 2.5 Mbps for mobile
            optimal_settings['resolution'] = "1280x720"  # 720p for mobile

        # Ensure we don't exceed platform limits
        if platform_spec.max_bitrate:
            optimal_settings['bitrate'] = min(optimal_settings['bitrate'], platform_spec.max_bitrate)

        return optimal_settings

    def _build_ffmpeg_command(self, input_path: str, output_path: str,
                            optimal_settings: Dict) -> List[str]:
        """Build FFmpeg command for optimization"""
        cmd = ['ffmpeg', '-y', '-i', input_path]

        # Input options
        cmd.extend(['-hide_banner', '-loglevel', 'info'])

        # Video codec and settings
        cmd.extend([
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23'
        ])

        # Resolution scaling
        if optimal_settings['resolution'] != "original":
            cmd.extend(['-vf', f'scale={optimal_settings["resolution"]}'])

        # Frame rate
        cmd.extend(['-r', str(optimal_settings['fps'])])

        # Bitrate
        cmd.extend(['-b:v', f"{optimal_settings['bitrate']//1000}k"])

        # Audio settings (copy to preserve quality)
        cmd.extend(['-c:a', 'aac', '-b:a', '128k'])

        # Output format
        cmd.append(output_path)

        return cmd

    def _run_optimization(self, input_path: str, output_path: str,
                         settings: OptimizationSettings) -> OptimizationResult:
        """Run social media optimization"""
        try:
            start_time = time.time()

            # Get input video info
            input_info, duration = self._get_video_info(input_path)
            original_size = input_info['file_size']

            # Calculate optimal settings
            optimal_settings = self._calculate_optimal_settings(input_info, settings)

            # Build FFmpeg command
            cmd = self._build_ffmpeg_command(input_path, output_path, optimal_settings)

            self.logger.info(f"Starting optimization: {' '.join(cmd)}")

            # Run FFmpeg optimization
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )

            # Get output file size
            output_path_obj = Path(output_path)
            optimized_size = output_path_obj.stat().st_size if output_path_obj.exists() else 0

            processing_time = time.time() - start_time
            compression_ratio = original_size / optimized_size if optimized_size > 0 else 1.0

            return OptimizationResult(
                success=True,
                output_path=output_path,
                platform=settings.platform,
                original_size=original_size,
                optimized_size=optimized_size,
                compression_ratio=compression_ratio,
                processing_time=processing_time,
                metadata={
                    'optimal_settings': optimal_settings,
                    'input_info': input_info,
                    'duration': duration
                }
            )

        except subprocess.CalledProcessError as e:
            return OptimizationResult(
                success=False,
                output_path=output_path,
                platform=settings.platform,
                original_size=0,
                optimized_size=0,
                compression_ratio=1.0,
                processing_time=time.time() - start_time,
                error_message=f"FFmpeg failed: {e.stderr}"
            )
        except Exception as e:
            return OptimizationResult(
                success=False,
                output_path=output_path,
                platform=settings.platform,
                original_size=0,
                optimized_size=0,
                compression_ratio=1.0,
                processing_time=time.time() - start_time,
                error_message=str(e)
            )

    async def optimize_for_platform(self, input_path: str, output_path: str,
                                  settings: OptimizationSettings) -> OptimizationResult:
        """Optimize video for social media platform asynchronously"""
        loop = asyncio.get_event_loop()

        # Run optimization in thread pool
        result = await loop.run_in_executor(
            self.executor,
            self._run_optimization,
            input_path,
            output_path,
            settings
        )

        return result

    def get_platform_specs(self, platform: Platform) -> VideoSpecs:
        """Get specifications for platform"""
        return self.platform_specs[platform]

    def get_supported_platforms(self) -> List[Dict]:
        """Get list of supported platforms"""
        return [
            {
                'platform': Platform.YOUTUBE.value,
                'name': 'YouTube',
                'description': 'Video sharing platform',
                'max_duration': '12 hours',
                'max_size': '2GB',
                'preferred_format': 'MP4',
                'aspect_ratios': ['16:9', '9:16', '1:1', '4:3']
            },
            {
                'platform': Platform.TIKTOK.value,
                'name': 'TikTok',
                'description': 'Short-form video platform',
                'max_duration': '10 minutes',
                'max_size': '100MB',
                'preferred_format': 'MP4',
                'aspect_ratios': ['9:16', '1:1']
            },
            {
                'platform': Platform.INSTAGRAM.value,
                'name': 'Instagram',
                'description': 'Photo and video sharing',
                'max_duration': '90 seconds (feed)',
                'max_size': '100MB',
                'preferred_format': 'MP4',
                'aspect_ratios': ['16:9', '9:16', '1:1', '4:3']
            },
            {
                'platform': Platform.FACEBOOK.value,
                'name': 'Facebook',
                'description': 'Social networking platform',
                'max_duration': '4 hours',
                'max_size': '4GB',
                'preferred_format': 'MP4',
                'aspect_ratios': ['16:9', '9:16', '1:1', '4:3']
            },
            {
                'platform': Platform.TWITTER.value,
                'name': 'Twitter/X',
                'description': 'Microblogging platform',
                'max_duration': '2m 20s',
                'max_size': '500MB',
                'preferred_format': 'MP4',
                'aspect_ratios': ['16:9', '1:1']
            }
        ]

    def validate_settings(self, settings: OptimizationSettings) -> List[str]:
        """Validate optimization settings"""
        errors = []

        # Validate platform
        if settings.platform not in self.platform_specs:
            errors.append(f"Unsupported platform: {settings.platform}")

        # Validate quality setting
        if settings.target_quality not in ["low", "medium", "high", "ultra"]:
            errors.append("Target quality must be: low, medium, high, or ultra")

        # Validate metadata settings if provided
        if settings.metadata_settings:
            metadata = settings.metadata_settings
            if metadata.title and len(metadata.title) > 100:
                errors.append("Title must be 100 characters or less")

            if metadata.description and len(metadata.description) > 5000:
                errors.append("Description must be 5000 characters or less")

        return errors

    def estimate_optimization_time(self, input_path: str, settings: OptimizationSettings) -> float:
        """Estimate optimization time"""
        try:
            # Get video info
            input_info, duration = self._get_video_info(input_path)

            # Base time estimate
            base_time = duration * 0.2  # Base processing factor

            # Adjust for quality
            quality_multipliers = {
                "low": 0.8,
                "medium": 1.0,
                "high": 1.3,
                "ultra": 1.8
            }
            base_time *= quality_multipliers.get(settings.target_quality, 1.0)

            # Adjust for resolution changes
            target_resolution = settings.custom_specs.preferred_resolution if settings.custom_specs else "1920x1080"
            if target_resolution != "original":
                try:
                    target_width, target_height = target_resolution.split('x')
                    current_pixels = input_info['width'] * input_info['height']
                    target_pixels = int(target_width) * int(target_height)
                    scale_factor = target_pixels / current_pixels

                    if scale_factor > 1:
                        base_time *= scale_factor  # Upscaling takes longer
                    else:
                        base_time *= 0.9  # Downscaling is faster
                except:
                    pass

            return max(base_time, 5.0)  # Minimum 5 seconds

        except Exception as e:
            self.logger.warning(f"Could not estimate optimization time: {e}")
            return 30.0  # Default estimate

    def cleanup(self):
        """Cleanup resources"""
        self.executor.shutdown(wait=True)
        self.logger.info("SocialMediaOptimizer cleanup completed")


# Convenience functions for common platform optimizations
def optimize_for_youtube(input_path: str, output_path: str, quality: str = "high") -> OptimizationResult:
    """Optimize video for YouTube"""
    optimizer = SocialMediaOptimizer()
    settings = OptimizationSettings(
        platform=Platform.YOUTUBE,
        target_quality=quality,
        optimize_for_mobile=True
    )

    return asyncio.run(optimizer.optimize_for_platform(input_path, output_path, settings))


def optimize_for_tiktok(input_path: str, output_path: str) -> OptimizationResult:
    """Optimize video for TikTok"""
    optimizer = SocialMediaOptimizer()
    settings = OptimizationSettings(
        platform=Platform.TIKTOK,
        target_quality="high",
        optimize_for_mobile=True
    )

    return asyncio.run(optimizer.optimize_for_platform(input_path, output_path, settings))


def optimize_for_instagram(input_path: str, output_path: str, quality: str = "high") -> OptimizationResult:
    """Optimize video for Instagram"""
    optimizer = SocialMediaOptimizer()
    settings = OptimizationSettings(
        platform=Platform.INSTAGRAM,
        target_quality=quality,
        optimize_for_mobile=True
    )

    return asyncio.run(optimizer.optimize_for_platform(input_path, output_path, settings))


def optimize_for_facebook(input_path: str, output_path: str, quality: str = "high") -> OptimizationResult:
    """Optimize video for Facebook"""
    optimizer = SocialMediaOptimizer()
    settings = OptimizationSettings(
        platform=Platform.FACEBOOK,
        target_quality=quality,
        optimize_for_mobile=True
    )

    return asyncio.run(optimizer.optimize_for_platform(input_path, output_path, settings))


def optimize_for_twitter(input_path: str, output_path: str) -> OptimizationResult:
    """Optimize video for Twitter/X"""
    optimizer = SocialMediaOptimizer()
    settings = OptimizationSettings(
        platform=Platform.TWITTER,
        target_quality="high",
        optimize_for_mobile=True
    )

    return asyncio.run(optimizer.optimize_for_platform(input_path, output_path, settings))
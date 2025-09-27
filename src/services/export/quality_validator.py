"""
Export quality validation and error recovery service.

Features:
- Video quality validation (resolution, bitrate, frame rate)
- Audio quality validation (sample rate, channels, volume)
- File integrity validation
- Format compliance validation
- Error recovery mechanisms
- Quality metrics calculation
"""

import asyncio
import logging
import os
import subprocess
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Callable
from dataclasses import dataclass, field
from enum import Enum
import hashlib
from concurrent.futures import ThreadPoolExecutor

from src.core.schemas.base import BaseNodeInput, BaseNodeOutput
from src.core.replay.manifest import ReplayManifest


class QualityLevel(Enum):
    """Quality levels"""
    EXCELLENT = "excellent"
    GOOD = "good"
    ACCEPTABLE = "acceptable"
    POOR = "poor"
    UNACCEPTABLE = "unacceptable"


class ValidationType(Enum):
    """Validation types"""
    VIDEO_QUALITY = "video_quality"
    AUDIO_QUALITY = "audio_quality"
    FILE_INTEGRITY = "file_integrity"
    FORMAT_COMPLIANCE = "format_compliance"
    METADATA = "metadata"
    PERFORMANCE = "performance"


@dataclass
class QualityMetrics:
    """Quality metrics"""
    overall_score: float  # 0.0 to 100.0
    quality_level: QualityLevel
    video_score: float
    audio_score: float
    technical_score: float
    details: Dict[str, any] = field(default_factory=dict)


@dataclass
class ValidationResult:
    """Validation result"""
    is_valid: bool
    quality_metrics: QualityMetrics
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    metadata: Dict[str, any] = field(default_factory=dict)


@dataclass
class ErrorRecoveryAction:
    """Error recovery action"""
    action_type: str
    description: str
    parameters: Dict[str, any] = field(default_factory=dict)
    confidence: float = 1.0


class ExportQualityValidator:
    """
    Export quality validation and error recovery service.

    Validates export quality and provides error recovery
    mechanisms for failed exports.
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.active_validations: Dict[str, dict] = {}
        self.executor = ThreadPoolExecutor(max_workers=2)
        self._check_dependencies()

    def _check_dependencies(self):
        """Check required dependencies"""
        required_tools = ['ffprobe', 'ffmpeg']
        for tool in required_tools:
            if not self._check_tool_availability(tool):
                self.logger.warning(f"Tool {tool} not found - some features may not work")

    def _check_tool_availability(self, tool: str) -> bool:
        """Check if a tool is available"""
        try:
            subprocess.run([tool, '-version'], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def _get_video_info(self, file_path: str) -> Dict:
        """Get comprehensive video information"""
        try:
            cmd = [
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_format', '-show_streams', '-show_error', file_path
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return json.loads(result.stdout)

        except Exception as e:
            self.logger.error(f"Failed to get video info: {e}")
            raise RuntimeError(f"Could not analyze video file: {e}")

    def _validate_video_quality(self, file_path: str) -> Tuple[float, List[str], List[str]]:
        """Validate video quality metrics"""
        try:
            info = self._get_video_info(file_path)
            issues = []
            warnings = []
            score = 100.0

            # Get video stream
            video_stream = None
            for stream in info['streams']:
                if stream['codec_type'] == 'video':
                    video_stream = stream
                    break

            if not video_stream:
                return 0.0, ["No video stream found"], []

            # Resolution validation
            width = int(video_stream['width'])
            height = int(video_stream['height'])

            if width < 480 or height < 360:
                issues.append(f"Low resolution: {width}x{height}")
                score -= 30
            elif width < 720 or height < 480:
                warnings.append(f"SD resolution: {width}x{height}")
                score -= 10
            elif width >= 3840 or height >= 2160:
                warnings.append(f"Very high resolution: {width}x{height} - may cause performance issues")

            # Frame rate validation
            fps = float(video_stream.get('r_frame_rate', '30').split('/')[0])
            if fps < 24:
                issues.append(f"Low frame rate: {fps} fps")
                score -= 20
            elif fps < 30:
                warnings.append(f"Below standard frame rate: {fps} fps")
                score -= 5

            # Bitrate validation
            bitrate = int(video_stream.get('bit_rate', '0'))
            if bitrate == 0:
                warnings.append("No bitrate information available")
                score -= 10
            elif bitrate < 1000000:  # Less than 1 Mbps
                issues.append(f"Low bitrate: {bitrate//1000} kbps")
                score -= 25
            elif bitrate < 3000000:  # Less than 3 Mbps
                warnings.append(f"Moderate bitrate: {bitrate//1000} kbps")
                score -= 5

            # Codec validation
            codec = video_stream.get('codec_name', 'unknown')
            if codec in ['h264', 'h265', 'av1', 'vp9']:
                warnings.append(f"Good codec: {codec}")
            else:
                warnings.append(f"Less common codec: {codec}")
                score -= 5

            return max(score, 0.0), issues, warnings

        except Exception as e:
            return 0.0, [f"Video analysis failed: {str(e)}"], []

    def _validate_audio_quality(self, file_path: str) -> Tuple[float, List[str], List[str]]:
        """Validate audio quality metrics"""
        try:
            info = self._get_video_info(file_path)
            issues = []
            warnings = []
            score = 100.0

            # Get audio stream
            audio_stream = None
            for stream in info['streams']:
                if stream['codec_type'] == 'audio':
                    audio_stream = stream
                    break

            if not audio_stream:
                return 50.0, ["No audio stream found"], []

            # Sample rate validation
            sample_rate = int(audio_stream.get('sample_rate', '0'))
            if sample_rate == 0:
                issues.append("No sample rate information")
                score -= 20
            elif sample_rate < 44100:
                issues.append(f"Low sample rate: {sample_rate} Hz")
                score -= 15
            elif sample_rate < 48000:
                warnings.append(f"Standard sample rate: {sample_rate} Hz")

            # Channels validation
            channels = int(audio_stream.get('channels', '0'))
            if channels == 0:
                issues.append("No channel information")
                score -= 10
            elif channels == 1:
                warnings.append("Mono audio")
            elif channels >= 2:
                warnings.append(f"Good: {channels} channels")

            # Audio bitrate validation
            audio_bitrate = int(audio_stream.get('bit_rate', '0'))
            if audio_bitrate == 0:
                warnings.append("No audio bitrate information")
                score -= 5
            elif audio_bitrate < 128000:  # Less than 128 kbps
                issues.append(f"Low audio bitrate: {audio_bitrate//1000} kbps")
                score -= 15
            elif audio_bitrate < 320000:  # Less than 320 kbps
                warnings.append(f"Good audio bitrate: {audio_bitrate//1000} kbps")

            # Codec validation
            codec = audio_stream.get('codec_name', 'unknown')
            if codec in ['aac', 'mp3', 'opus', 'flac']:
                warnings.append(f"Good audio codec: {codec}")
            else:
                warnings.append(f"Less common audio codec: {codec}")
                score -= 5

            return max(score, 0.0), issues, warnings

        except Exception as e:
            return 0.0, [f"Audio analysis failed: {str(e)}"], []

    def _validate_file_integrity(self, file_path: str) -> Tuple[float, List[str], List[str]]:
        """Validate file integrity"""
        try:
            issues = []
            warnings = []
            score = 100.0

            file_path_obj = Path(file_path)

            # File size validation
            file_size = file_path_obj.stat().st_size
            if file_size == 0:
                issues.append("Empty file")
                return 0.0, issues, warnings
            elif file_size < 1024:  # Less than 1KB
                issues.append(f"Very small file: {file_size} bytes")
                score -= 30

            # File hash validation (basic)
            try:
                with open(file_path, 'rb') as f:
                    file_hash = hashlib.md5(f.read(1024)).hexdigest()  # First 1KB
                warnings.append(f"File hash: {file_hash[:8]}...")
            except Exception as e:
                issues.append(f"Could not read file: {e}")
                score -= 20

            # File extension validation
            expected_extensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
            if file_path_obj.suffix.lower() not in expected_extensions:
                warnings.append(f"Unusual extension: {file_path_obj.suffix}")
                score -= 5

            return max(score, 0.0), issues, warnings

        except Exception as e:
            return 0.0, [f"File integrity check failed: {str(e)}"], []

    def _validate_format_compliance(self, file_path: str) -> Tuple[float, List[str], List[str]]:
        """Validate format compliance"""
        try:
            issues = []
            warnings = []
            score = 100.0

            info = self._get_video_info(file_path)

            # Container format validation
            format_name = info['format']['format_name']
            if format_name in ['mp4', 'mov', 'matroska', 'webm']:
                warnings.append(f"Good container: {format_name}")
            else:
                warnings.append(f"Less common container: {format_name}")
                score -= 5

            # Stream count validation
            stream_count = len(info['streams'])
            if stream_count == 0:
                issues.append("No streams found")
                score -= 50
            elif stream_count < 2:
                warnings.append("Only one stream (video or audio missing)")
                score -= 10

            # Duration validation
            duration = float(info['format']['duration'])
            if duration <= 0:
                issues.append("Invalid duration")
                score -= 20
            elif duration < 1.0:
                warnings.append(f"Very short duration: {duration".2f"}s")
                score -= 5

            return max(score, 0.0), issues, warnings

        except Exception as e:
            return 0.0, [f"Format validation failed: {str(e)}"], []

    def _calculate_overall_score(self, video_score: float, audio_score: float,
                               technical_score: float) -> Tuple[float, QualityLevel]:
        """Calculate overall quality score"""
        overall = (video_score * 0.5) + (audio_score * 0.3) + (technical_score * 0.2)

        if overall >= 90:
            level = QualityLevel.EXCELLENT
        elif overall >= 75:
            level = QualityLevel.GOOD
        elif overall >= 60:
            level = QualityLevel.ACCEPTABLE
        elif overall >= 40:
            level = QualityLevel.POOR
        else:
            level = QualityLevel.UNACCEPTABLE

        return overall, level

    def _run_validation(self, file_path: str) -> ValidationResult:
        """Run comprehensive validation"""
        try:
            # Video quality validation
            video_score, video_issues, video_warnings = self._validate_video_quality(file_path)

            # Audio quality validation
            audio_score, audio_issues, audio_warnings = self._validate_audio_quality(file_path)

            # File integrity validation
            integrity_score, integrity_issues, integrity_warnings = self._validate_file_integrity(file_path)

            # Format compliance validation
            format_score, format_issues, format_warnings = self._validate_format_compliance(file_path)

            # Calculate technical score (average of integrity and format)
            technical_score = (integrity_score + format_score) / 2

            # Calculate overall score
            overall_score, quality_level = self._calculate_overall_score(
                video_score, audio_score, technical_score
            )

            # Combine all issues and warnings
            all_issues = video_issues + audio_issues + integrity_issues + format_issues
            all_warnings = video_warnings + audio_warnings + integrity_warnings + format_warnings

            # Generate suggestions
            suggestions = self._generate_suggestions(
                overall_score, quality_level, all_issues, all_warnings
            )

            # Create quality metrics
            quality_metrics = QualityMetrics(
                overall_score=overall_score,
                quality_level=quality_level,
                video_score=video_score,
                audio_score=audio_score,
                technical_score=technical_score,
                details={
                    'video_issues': video_issues,
                    'audio_issues': audio_issues,
                    'technical_issues': integrity_issues + format_issues,
                    'warnings': all_warnings
                }
            )

            # Determine if valid
            is_valid = overall_score >= 60 and len(all_issues) == 0

            return ValidationResult(
                is_valid=is_valid,
                quality_metrics=quality_metrics,
                issues=all_issues,
                warnings=all_warnings,
                suggestions=suggestions,
                metadata={
                    'file_path': file_path,
                    'validation_time': time.time()
                }
            )

        except Exception as e:
            return ValidationResult(
                is_valid=False,
                quality_metrics=QualityMetrics(
                    overall_score=0.0,
                    quality_level=QualityLevel.UNACCEPTABLE,
                    video_score=0.0,
                    audio_score=0.0,
                    technical_score=0.0
                ),
                issues=[f"Validation failed: {str(e)}"],
                warnings=[],
                suggestions=["Check file format and try again"]
            )

    def _generate_suggestions(self, overall_score: float, quality_level: QualityLevel,
                            issues: List[str], warnings: List[str]) -> List[str]:
        """Generate improvement suggestions"""
        suggestions = []

        if quality_level == QualityLevel.UNACCEPTABLE:
            suggestions.append("File quality is unacceptable - consider re-exporting with better settings")
        elif quality_level == QualityLevel.POOR:
            suggestions.append("File quality is poor - consider increasing bitrate and resolution")
        elif quality_level == QualityLevel.ACCEPTABLE:
            suggestions.append("File quality is acceptable but could be improved")

        if any("bitrate" in issue.lower() for issue in issues):
            suggestions.append("Consider increasing video bitrate for better quality")

        if any("resolution" in issue.lower() for issue in issues):
            suggestions.append("Consider increasing resolution for better quality")

        if any("frame rate" in issue.lower() for issue in issues):
            suggestions.append("Consider increasing frame rate for smoother motion")

        if any("audio" in issue.lower() for issue in issues):
            suggestions.append("Consider improving audio quality settings")

        if not suggestions:
            suggestions.append("File quality looks good - no specific improvements needed")

        return suggestions

    async def validate_export(self, file_path: str) -> ValidationResult:
        """Validate export file asynchronously"""
        loop = asyncio.get_event_loop()

        # Run validation in thread pool
        result = await loop.run_in_executor(
            self.executor,
            self._run_validation,
            file_path
        )

        return result

    def suggest_error_recovery(self, error_message: str, file_path: str) -> List[ErrorRecoveryAction]:
        """Suggest error recovery actions based on error message"""
        actions = []

        # Analyze error message and suggest recovery
        if "codec" in error_message.lower():
            actions.append(ErrorRecoveryAction(
                action_type="codec_fallback",
                description="Try different codec",
                parameters={"suggested_codec": "h264"},
                confidence=0.8
            ))

        if "resolution" in error_message.lower():
            actions.append(ErrorRecoveryAction(
                action_type="resolution_reduction",
                description="Reduce resolution",
                parameters={"suggested_resolution": "1280x720"},
                confidence=0.9
            ))

        if "bitrate" in error_message.lower():
            actions.append(ErrorRecoveryAction(
                action_type="bitrate_reduction",
                description="Reduce bitrate",
                parameters={"suggested_bitrate": "2000000"},
                confidence=0.9
            ))

        if "memory" in error_message.lower() or "space" in error_message.lower():
            actions.append(ErrorRecoveryAction(
                action_type="resource_cleanup",
                description="Free up system resources",
                parameters={"cleanup_temp": True},
                confidence=0.7
            ))

        if "format" in error_message.lower():
            actions.append(ErrorRecoveryAction(
                action_type="format_conversion",
                description="Convert to different format",
                parameters={"target_format": "mp4"},
                confidence=0.6
            ))

        # Default recovery action
        if not actions:
            actions.append(ErrorRecoveryAction(
                action_type="retry",
                description="Retry with same settings",
                confidence=0.5
            ))

        return actions

    def get_validation_report(self, result: ValidationResult) -> str:
        """Generate human-readable validation report"""
        report = []
        report.append("=== Export Quality Validation Report ===")
        report.append(f"Overall Score: {result.quality_metrics.overall_score".1f"}/100")
        report.append(f"Quality Level: {result.quality_metrics.quality_level.value.upper()}")
        report.append("")

        if result.issues:
            report.append("ISSUES:")
            for issue in result.issues:
                report.append(f"  • {issue}")
            report.append("")

        if result.warnings:
            report.append("WARNINGS:")
            for warning in result.warnings:
                report.append(f"  • {warning}")
            report.append("")

        if result.suggestions:
            report.append("SUGGESTIONS:")
            for suggestion in result.suggestions:
                report.append(f"  • {suggestion}")
            report.append("")

        report.append("DETAILED SCORES:")
        report.append(f"  Video Quality: {result.quality_metrics.video_score".1f"}/100")
        report.append(f"  Audio Quality: {result.quality_metrics.audio_score".1f"}/100")
        report.append(f"  Technical Quality: {result.quality_metrics.technical_score".1f"}/100")

        return "\n".join(report)

    def cleanup(self):
        """Cleanup resources"""
        self.executor.shutdown(wait=True)
        self.logger.info("ExportQualityValidator cleanup completed")


# Convenience functions for quality validation
def validate_export_quality(file_path: str) -> ValidationResult:
    """Validate export file quality"""
    validator = ExportQualityValidator()
    return asyncio.run(validator.validate_export(file_path))


def get_quality_report(file_path: str) -> str:
    """Get human-readable quality report"""
    validator = ExportQualityValidator()
    result = asyncio.run(validator.validate_export(file_path))
    return validator.get_validation_report(result)


def suggest_export_improvements(file_path: str) -> List[str]:
    """Get suggestions for improving export quality"""
    validator = ExportQualityValidator()
    result = asyncio.run(validator.validate_export(file_path))
    return result.suggestions


def check_export_issues(file_path: str) -> List[str]:
    """Get list of issues with export"""
    validator = ExportQualityValidator()
    result = asyncio.run(validator.validate_export(file_path))
    return result.issues
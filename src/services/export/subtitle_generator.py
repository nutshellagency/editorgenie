"""
Subtitle generation service for creating SRT and other subtitle formats from transcripts.

Features:
- SRT subtitle file generation
- Multiple subtitle format support (SRT, VTT, ASS, SCC)
- Transcript synchronization and timing
- Text processing and formatting
- Quality optimization
- Error handling and validation
"""

import asyncio
import logging
import os
import re
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import time
from concurrent.futures import ThreadPoolExecutor

from src.core.schemas.base import BaseNodeInput, BaseNodeOutput
from src.core.replay.manifest import ReplayManifest


class SubtitleFormat(Enum):
    """Supported subtitle formats"""
    SRT = "srt"
    VTT = "vtt"
    ASS = "ass"
    SCC = "scc"


class TimingMode(Enum):
    """Timing calculation modes"""
    SYNC = "sync"          # Synchronized with original timing
    EVEN = "even"          # Even distribution
    CUSTOM = "custom"      # Custom timing parameters


@dataclass
class TranscriptSegment:
    """Transcript segment with timing and content"""
    start_time: float
    end_time: float
    text: str
    confidence: float = 1.0
    speaker_id: Optional[str] = None
    words: List[Dict] = field(default_factory=list)


@dataclass
class SubtitleSettings:
    """Subtitle generation settings"""
    format: SubtitleFormat = SubtitleFormat.SRT
    timing_mode: TimingMode = TimingMode.SYNC
    max_line_length: int = 42
    max_lines_per_subtitle: int = 2
    min_duration: float = 1.0
    max_duration: float = 7.0
    include_speaker_labels: bool = False
    reading_speed_wpm: int = 150
    confidence_threshold: float = 0.8


@dataclass
class SubtitleResult:
    """Subtitle generation result"""
    success: bool
    output_path: str
    format: SubtitleFormat
    subtitle_count: int
    total_duration: float
    error_message: Optional[str] = None
    metadata: Dict[str, any] = field(default_factory=dict)


class SubtitleGenerator:
    """
    Subtitle generation service.

    Creates subtitle files from transcript data with
    proper timing and formatting.
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.active_generations: Dict[str, dict] = {}
        self.executor = ThreadPoolExecutor(max_workers=2)

    def _format_srt_timestamp(self, seconds: float) -> str:
        """Format timestamp for SRT format (HH:MM:SS,mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        milliseconds = int((seconds % 1) * 1000)

        return f"{hours"02d"}:{minutes"02d"}:{secs"02d"},{milliseconds"03d"}"

    def _format_vtt_timestamp(self, seconds: float) -> str:
        """Format timestamp for VTT format (HH:MM:SS.mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        milliseconds = int((seconds % 1) * 1000)

        return f"{hours"02d"}:{minutes"02d"}:{secs"02d"}.{milliseconds"03d"}"

    def _format_ass_timestamp(self, seconds: float) -> str:
        """Format timestamp for ASS format (H:MM:SS.cc)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        centiseconds = int((seconds % 1) * 100)

        return f"{hours"01d"}:{minutes"02d"}:{secs"02d"}.{centiseconds"02d"}"

    def _process_text_for_subtitle(self, text: str, max_line_length: int,
                                 max_lines: int) -> List[str]:
        """Process text for subtitle formatting"""
        # Clean up text
        text = re.sub(r'\s+', ' ', text.strip())

        if not text:
            return []

        # Split into words
        words = text.split()
        lines = []
        current_line = ""

        for word in words:
            # Check if adding this word would exceed line length
            if len(current_line) + len(word) + 1 <= max_line_length:
                current_line += " " + word if current_line else word
            else:
                # Line would be too long, start new line
                if current_line:
                    lines.append(current_line.strip())
                    current_line = word
                else:
                    # Single word is too long, truncate it
                    lines.append(word[:max_line_length])
                    current_line = ""

                # Check if we've reached max lines
                if len(lines) >= max_lines:
                    break

        # Add remaining text
        if current_line and len(lines) < max_lines:
            lines.append(current_line.strip())

        return lines

    def _calculate_optimal_timing(self, segments: List[TranscriptSegment],
                                settings: SubtitleSettings) -> List[TranscriptSegment]:
        """Calculate optimal timing for subtitles"""
        if settings.timing_mode == TimingMode.SYNC:
            # Use original timing
            return segments
        elif settings.timing_mode == TimingMode.EVEN:
            # Distribute timing evenly
            return self._calculate_even_timing(segments, settings)
        else:  # CUSTOM
            # Use custom timing parameters
            return self._calculate_custom_timing(segments, settings)

    def _calculate_even_timing(self, segments: List[TranscriptSegment],
                             settings: SubtitleSettings) -> List[TranscriptSegment]:
        """Calculate even timing distribution"""
        if not segments:
            return segments

        total_duration = segments[-1].end_time - segments[0].start_time
        num_segments = len(segments)

        if num_segments == 0:
            return segments

        # Calculate even duration per segment
        even_duration = total_duration / num_segments

        # Adjust durations based on content length and reading speed
        adjusted_segments = []
        current_time = segments[0].start_time

        for i, segment in enumerate(segments):
            # Calculate duration based on text length and reading speed
            word_count = len(segment.text.split())
            reading_time = (word_count / settings.reading_speed_wpm) * 60  # Convert to seconds

            # Use the longer of even duration or reading time
            duration = max(even_duration, reading_time, settings.min_duration)

            # Ensure we don't exceed max duration
            duration = min(duration, settings.max_duration)

            # Create new segment with adjusted timing
            adjusted_segment = TranscriptSegment(
                start_time=current_time,
                end_time=current_time + duration,
                text=segment.text,
                confidence=segment.confidence,
                speaker_id=segment.speaker_id,
                words=segment.words
            )

            adjusted_segments.append(adjusted_segment)
            current_time += duration

        return adjusted_segments

    def _calculate_custom_timing(self, segments: List[TranscriptSegment],
                               settings: SubtitleSettings) -> List[TranscriptSegment]:
        """Calculate custom timing based on parameters"""
        # For now, use even timing as fallback
        # In a full implementation, this would use custom parameters
        return self._calculate_even_timing(segments, settings)

    def _generate_srt_content(self, segments: List[TranscriptSegment],
                            settings: SubtitleSettings) -> str:
        """Generate SRT format content"""
        lines = []

        for i, segment in enumerate(segments):
            # Skip low confidence segments
            if segment.confidence < settings.confidence_threshold:
                continue

            # Process text for subtitle formatting
            subtitle_lines = self._process_text_for_subtitle(
                segment.text, settings.max_line_length, settings.max_lines_per_subtitle
            )

            if not subtitle_lines:
                continue

            # Add speaker label if enabled
            if settings.include_speaker_labels and segment.speaker_id:
                speaker_text = f"[{segment.speaker_id}]: " + " ".join(subtitle_lines)
                subtitle_lines = [speaker_text]

            # SRT format
            lines.append(str(i + 1))  # Subtitle number
            lines.append(f"{self._format_srt_timestamp(segment.start_time)} --> {self._format_srt_timestamp(segment.end_time)}")
            lines.append("\n".join(subtitle_lines))
            lines.append("")  # Empty line between subtitles

        return "\n".join(lines)

    def _generate_vtt_content(self, segments: List[TranscriptSegment],
                            settings: SubtitleSettings) -> str:
        """Generate WebVTT format content"""
        lines = ["WEBVTT", ""]  # VTT header

        for i, segment in enumerate(segments):
            # Skip low confidence segments
            if segment.confidence < settings.confidence_threshold:
                continue

            # Process text for subtitle formatting
            subtitle_lines = self._process_text_for_subtitle(
                segment.text, settings.max_line_length, settings.max_lines_per_subtitle
            )

            if not subtitle_lines:
                continue

            # Add speaker label if enabled
            if settings.include_speaker_labels and segment.speaker_id:
                speaker_text = f"<v {segment.speaker_id}>{" ".join(subtitle_lines)}"
                subtitle_lines = [speaker_text]

            # VTT format
            lines.append(str(i + 1))
            lines.append(f"{self._format_vtt_timestamp(segment.start_time)} --> {self._format_vtt_timestamp(segment.end_time)}")
            lines.append("\n".join(subtitle_lines))
            lines.append("")

        return "\n".join(lines)

    def _generate_ass_content(self, segments: List[TranscriptSegment],
                            settings: SubtitleSettings) -> str:
        """Generate ASS/SSA format content"""
        lines = [
            "[Script Info]",
            "Title: Generated Subtitles",
            "ScriptType: v4.00+",
            "WrapStyle: 0",
            "ScaledBorderAndShadow: yes",
            "Collisions: Normal",
            "",
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
            "Style: Default,Arial,20,&Hffffff,&Hffffff,&H0,&H0,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1",
            "",
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
        ]

        for segment in segments:
            # Skip low confidence segments
            if segment.confidence < settings.confidence_threshold:
                continue

            # Process text for subtitle formatting
            subtitle_lines = self._process_text_for_subtitle(
                segment.text, settings.max_line_length, settings.max_lines_per_subtitle
            )

            if not subtitle_lines:
                continue

            # Add speaker label if enabled
            text_content = "\\N".join(subtitle_lines)
            if settings.include_speaker_labels and segment.speaker_id:
                text_content = f"{{{segment.speaker_id}: }}{text_content}"

            # ASS format
            lines.append(f"Dialogue: 0,{self._format_ass_timestamp(segment.start_time)},{self._format_ass_timestamp(segment.end_time)},Default,,0,0,0,,{text_content}")

        return "\n".join(lines)

    def _generate_scc_content(self, segments: List[TranscriptSegment],
                            settings: SubtitleSettings) -> str:
        """Generate SCC format content (simplified)"""
        # SCC is a complex binary format
        # This is a simplified implementation
        lines = []

        for segment in segments:
            # Skip low confidence segments
            if segment.confidence < settings.confidence_threshold:
                continue

            # Process text for subtitle formatting
            subtitle_lines = self._process_text_for_subtitle(
                segment.text, settings.max_line_length, settings.max_lines_per_subtitle
            )

            if not subtitle_lines:
                continue

            # Simplified SCC-like format
            text_content = " ".join(subtitle_lines)
            if settings.include_speaker_labels and segment.speaker_id:
                text_content = f"[{segment.speaker_id}] {text_content}"

            lines.append(f"{self._format_srt_timestamp(segment.start_time)} - {self._format_srt_timestamp(segment.end_time)}: {text_content}")

        return "\n".join(lines)

    def _generate_subtitle_content(self, segments: List[TranscriptSegment],
                                 settings: SubtitleSettings) -> str:
        """Generate subtitle content based on format"""
        if settings.format == SubtitleFormat.SRT:
            return self._generate_srt_content(segments, settings)
        elif settings.format == SubtitleFormat.VTT:
            return self._generate_vtt_content(segments, settings)
        elif settings.format == SubtitleFormat.ASS:
            return self._generate_ass_content(segments, settings)
        elif settings.format == SubtitleFormat.SCC:
            return self._generate_scc_content(segments, settings)
        else:
            raise ValueError(f"Unsupported subtitle format: {settings.format}")

    def _run_subtitle_generation(self, segments: List[TranscriptSegment],
                               output_path: str, settings: SubtitleSettings) -> SubtitleResult:
        """Run subtitle generation"""
        try:
            start_time = time.time()

            # Filter segments by confidence
            filtered_segments = [
                segment for segment in segments
                if segment.confidence >= settings.confidence_threshold
            ]

            if not filtered_segments:
                raise ValueError("No segments meet confidence threshold")

            # Calculate optimal timing
            timed_segments = self._calculate_optimal_timing(filtered_segments, settings)

            # Generate content
            content = self._generate_subtitle_content(timed_segments, settings)

            # Write to file
            output_path_obj = Path(output_path)
            output_path_obj.parent.mkdir(parents=True, exist_ok=True)
            output_path_obj.write_text(content, encoding='utf-8')

            processing_time = time.time() - start_time

            return SubtitleResult(
                success=True,
                output_path=output_path,
                format=settings.format,
                subtitle_count=len(timed_segments),
                total_duration=timed_segments[-1].end_time - timed_segments[0].start_time if timed_segments else 0,
                metadata={
                    'original_segments': len(segments),
                    'filtered_segments': len(filtered_segments),
                    'processing_time': processing_time
                }
            )

        except Exception as e:
            return SubtitleResult(
                success=False,
                output_path=output_path,
                format=settings.format,
                subtitle_count=0,
                total_duration=0,
                error_message=str(e)
            )

    async def generate_subtitles(self, segments: List[TranscriptSegment],
                               output_path: str, settings: SubtitleSettings) -> SubtitleResult:
        """Generate subtitle file asynchronously"""
        loop = asyncio.get_event_loop()

        # Run generation in thread pool
        result = await loop.run_in_executor(
            self.executor,
            self._run_subtitle_generation,
            segments,
            output_path,
            settings
        )

        return result

    def get_supported_formats(self) -> List[Dict]:
        """Get list of supported subtitle formats"""
        return [
            {
                'format': SubtitleFormat.SRT.value,
                'name': 'SubRip (SRT)',
                'description': 'Standard subtitle format',
                'extensions': ['.srt'],
                'common_uses': ['Most video players', 'YouTube', 'Vimeo']
            },
            {
                'format': SubtitleFormat.VTT.value,
                'name': 'WebVTT (VTT)',
                'description': 'Web video subtitle format',
                'extensions': ['.vtt'],
                'common_uses': ['HTML5 video', 'Web browsers', 'Streaming']
            },
            {
                'format': SubtitleFormat.ASS.value,
                'name': 'Advanced SubStation Alpha (ASS)',
                'description': 'Advanced subtitle format with styling',
                'extensions': ['.ass'],
                'common_uses': ['Anime', 'Advanced formatting', 'Professional']
            },
            {
                'format': SubtitleFormat.SCC.value,
                'name': 'Scenarist Closed Caption (SCC)',
                'description': 'Broadcast caption format',
                'extensions': ['.scc'],
                'common_uses': ['Broadcast TV', 'Professional video', 'Accessibility']
            }
        ]

    def validate_settings(self, settings: SubtitleSettings) -> List[str]:
        """Validate subtitle settings"""
        errors = []

        # Validate line length
        if not (10 <= settings.max_line_length <= 100):
            errors.append("Max line length must be between 10 and 100")

        # Validate lines per subtitle
        if not (1 <= settings.max_lines_per_subtitle <= 5):
            errors.append("Max lines per subtitle must be between 1 and 5")

        # Validate duration constraints
        if settings.min_duration <= 0:
            errors.append("Minimum duration must be positive")

        if settings.max_duration <= settings.min_duration:
            errors.append("Maximum duration must be greater than minimum duration")

        # Validate reading speed
        if not (50 <= settings.reading_speed_wpm <= 300):
            errors.append("Reading speed must be between 50 and 300 WPM")

        # Validate confidence threshold
        if not (0.0 <= settings.confidence_threshold <= 1.0):
            errors.append("Confidence threshold must be between 0.0 and 1.0")

        return errors

    def estimate_generation_time(self, segments: List[TranscriptSegment],
                               settings: SubtitleSettings) -> float:
        """Estimate subtitle generation time"""
        # Base time estimate
        base_time = len(segments) * 0.01  # 10ms per segment

        # Adjust for format complexity
        if settings.format in [SubtitleFormat.ASS, SubtitleFormat.SCC]:
            base_time *= 2.0  # More complex formats take longer

        # Adjust for text processing
        total_text_length = sum(len(segment.text) for segment in segments)
        text_factor = total_text_length / 1000  # Adjust for text volume

        return max(base_time + text_factor * 0.1, 0.1)  # Minimum 100ms

    def cleanup(self):
        """Cleanup resources"""
        self.executor.shutdown(wait=True)
        self.logger.info("SubtitleGenerator cleanup completed")


# Convenience functions for common subtitle generation
def generate_srt_subtitles(segments: List[TranscriptSegment],
                          output_path: str) -> SubtitleResult:
    """Generate SRT subtitle file"""
    generator = SubtitleGenerator()
    settings = SubtitleSettings(
        format=SubtitleFormat.SRT,
        timing_mode=TimingMode.SYNC
    )

    return asyncio.run(generator.generate_subtitles(segments, output_path, settings))


def generate_vtt_subtitles(segments: List[TranscriptSegment],
                          output_path: str) -> SubtitleResult:
    """Generate WebVTT subtitle file"""
    generator = SubtitleGenerator()
    settings = SubtitleSettings(
        format=SubtitleFormat.VTT,
        timing_mode=TimingMode.SYNC
    )

    return asyncio.run(generator.generate_subtitles(segments, output_path, settings))


def generate_subtitles_from_transcript(transcript_segments: List[TranscriptSegment],
                                     output_path: str, format: str = "srt") -> SubtitleResult:
    """Generate subtitle file from transcript segments"""
    generator = SubtitleGenerator()
    settings = SubtitleSettings(
        format=SubtitleFormat(format),
        timing_mode=TimingMode.SYNC
    )

    return asyncio.run(generator.generate_subtitles(transcript_segments, output_path, settings))
"""
Assembly node implementation.
Combines video, audio, and other elements using FFmpeg integration.
"""

import asyncio
import os
import tempfile
import json
from typing import Dict, Any, List, Optional
from pathlib import Path
import subprocess

from ..schemas.base import (
    BaseNodeInput,
    BaseNodeOutput,
    NodeContract,
    NodeType,
    NodeStatus
)
from .base import BaseNode, NodeExecutionContext


class AssemblyNode(BaseNode):
    """
    Assembly node with FFmpeg integration for video composition.

    Combines multiple video clips, audio tracks, and other elements
    into a final video using professional FFmpeg capabilities.
    """

    @property
    def node_type(self) -> str:
        return "assembly"

    async def process(self, input_data: BaseNodeInput) -> BaseNodeOutput:
        """
        Process timeline decisions and assemble final video using FFmpeg.

        Args:
            input_data: Input containing timeline decisions and media files

        Returns:
            BaseNodeOutput with assembly results and output file information
        """
        try:
            # Extract input data
            timeline_decisions = input_data.input_data.get("timeline_decisions", [])
            source_videos = input_data.input_data.get("source_videos", [])
            audio_tracks = input_data.input_data.get("audio_tracks", [])
            output_resolution = input_data.input_data.get("output_resolution", "1920x1080")
            output_format = input_data.input_data.get("output_format", "mp4")
            video_codec = input_data.input_data.get("video_codec", "libx264")
            audio_codec = input_data.input_data.get("audio_codec", "aac")

            # Get configuration
            ffmpeg_path = self.context.config.get("ffmpeg_path", "ffmpeg")
            default_video_codec = self.context.config.get("default_video_codec", "libx264")
            default_audio_codec = self.context.config.get("default_audio_codec", "aac")
            temp_directory = self.context.config.get("temp_directory", "/tmp")

            # Validate inputs
            if not timeline_decisions:
                raise ValueError("timeline_decisions must be provided")
            if not source_videos:
                raise ValueError("source_videos must be provided")

            # Create temporary files for assembly
            temp_dir = tempfile.mkdtemp(dir=temp_directory)
            output_file = os.path.join(temp_dir, f"assembled_video.{output_format}")

            # Generate FFmpeg script
            ffmpeg_script = self._generate_ffmpeg_script(
                timeline_decisions, source_videos, audio_tracks,
                output_file, output_resolution, video_codec, audio_codec
            )

            # Execute FFmpeg assembly
            await self._execute_ffmpeg_assembly(ffmpeg_path, ffmpeg_script, output_file)

            # Get output file information
            file_info = await self._get_file_info(output_file)

            output_data = {
                "output_file": output_file,
                "duration": file_info.get("duration", 0.0),
                "file_size": file_info.get("size", 0),
                "video_codec": video_codec,
                "audio_codec": audio_codec,
                "resolution": output_resolution,
                "frame_rate": file_info.get("frame_rate", 30.0),
                "bitrate": file_info.get("bitrate", 2000)
            }

            # Update manifest
            self._update_manifest_with_assembly(
                output_file, timeline_decisions, source_videos, audio_tracks
            )

            return self._create_output(
                NodeStatus.COMPLETED,
                output_data,
                {
                    "source_files": source_videos,
                    "audio_tracks_count": len(audio_tracks),
                    "timeline_decisions_count": len(timeline_decisions),
                    "output_format": output_format,
                    "temp_directory": temp_dir
                }
            )

        except Exception as e:
            return self._create_output(
                NodeStatus.FAILED,
                {},
                error_message=f"Assembly processing failed: {str(e)}"
            )

    def _generate_ffmpeg_script(
        self,
        timeline_decisions: List[Dict[str, Any]],
        source_videos: List[str],
        audio_tracks: List[Dict[str, Any]],
        output_file: str,
        output_resolution: str,
        video_codec: str,
        audio_codec: str
    ) -> List[str]:
        """
        Generate FFmpeg command script for video assembly.

        Args:
            timeline_decisions: Timeline decisions from AI Director
            source_videos: List of source video files
            audio_tracks: List of audio track configurations
            output_file: Output file path
            output_resolution: Output video resolution
            video_codec: Video codec to use
            audio_codec: Audio codec to use

        Returns:
            List of FFmpeg command arguments
        """
        try:
            # Build complex FFmpeg filter graph
            filter_parts = []

            # Video input mapping
            video_inputs = []
            for i, video_file in enumerate(source_videos):
                video_inputs.append(f"-i {video_file}")

            # Audio input mapping
            audio_inputs = []
            for i, audio_track in enumerate(audio_tracks):
                audio_inputs.append(f"-i {audio_track['file']}")

            # Build filter graph for timeline decisions
            video_filter = self._build_video_filter(timeline_decisions, output_resolution)
            audio_filter = self._build_audio_filter(audio_tracks, timeline_decisions)

            # Construct FFmpeg command
            cmd = [
                "ffmpeg",
                "-y"  # Overwrite output files
            ]

            # Add all input files
            for video_file in source_videos:
                cmd.extend(["-i", video_file])

            for audio_track in audio_tracks:
                cmd.extend(["-i", audio_track["file"]])

            # Add filter graphs
            if video_filter:
                cmd.extend(["-filter_complex", video_filter])

            if audio_filter:
                cmd.extend(["-filter_complex", audio_filter])

            # Output settings
            cmd.extend([
                "-c:v", video_codec,
                "-c:a", audio_codec,
                "-s", output_resolution,
                "-r", "30",  # Frame rate
                "-b:v", "2000k",  # Video bitrate
                "-b:a", "128k",  # Audio bitrate
                "-ar", "44100",  # Audio sample rate
                "-ac", "2",  # Audio channels
                output_file
            ])

            return cmd

        except Exception as e:
            raise RuntimeError(f"Failed to generate FFmpeg script: {str(e)}")

    def _build_video_filter(self, timeline_decisions: List[Dict[str, Any]], output_resolution: str) -> str:
        """
        Build FFmpeg video filter graph for timeline decisions.

        Args:
            timeline_decisions: Timeline decisions
            output_resolution: Output resolution

        Returns:
            FFmpeg video filter string
        """
        try:
            # Mock implementation - in reality this would create complex filter graphs
            # for transitions, effects, and timeline assembly
            return f"scale={output_resolution},format=yuv420p"

        except Exception as e:
            self.logger.warning(f"Failed to build video filter: {str(e)}")
            return f"scale={output_resolution}"

    def _build_audio_filter(self, audio_tracks: List[Dict[str, Any]], timeline_decisions: List[Dict[str, Any]]) -> str:
        """
        Build FFmpeg audio filter graph for audio tracks.

        Args:
            audio_tracks: Audio track configurations
            timeline_decisions: Timeline decisions

        Returns:
            FFmpeg audio filter string
        """
        try:
            # Mock implementation - in reality this would create complex audio mixing
            # with volume adjustments, fades, and multi-track mixing
            if len(audio_tracks) == 1:
                return "volume=1.0"
            else:
                return "amix=inputs=2:duration=longest:dropout_transition=2"

        except Exception as e:
            self.logger.warning(f"Failed to build audio filter: {str(e)}")
            return "volume=1.0"

    async def _execute_ffmpeg_assembly(self, ffmpeg_path: str, script: List[str], output_file: str) -> None:
        """
        Execute FFmpeg assembly process.

        Args:
            ffmpeg_path: Path to FFmpeg executable
            script: FFmpeg command script
            output_file: Output file path
        """
        try:
            # Mock implementation - in reality this would execute the actual FFmpeg command
            # and monitor progress, handle errors, etc.

            # Simulate FFmpeg execution time
            await asyncio.sleep(0.2)

            # Create a mock output file
            with open(output_file, 'wb') as f:
                f.write(b'mock video data')

            self.logger.info(f"FFmpeg assembly completed: {output_file}")

        except Exception as e:
            raise RuntimeError(f"FFmpeg execution failed: {str(e)}")

    async def _get_file_info(self, file_path: str) -> Dict[str, Any]:
        """
        Get information about the assembled video file.

        Args:
            file_path: Path to the video file

        Returns:
            Dictionary with file information
        """
        try:
            # Mock implementation - in reality this would use ffprobe or similar
            # to get actual file information
            return {
                "duration": 30.0,
                "size": 1024000,  # 1MB
                "frame_rate": 30.0,
                "bitrate": 2000,
                "codec": "h264",
                "resolution": "1920x1080"
            }

        except Exception as e:
            self.logger.warning(f"Failed to get file info: {str(e)}")
            return {
                "duration": 0.0,
                "size": 0,
                "frame_rate": 30.0,
                "bitrate": 2000
            }

    def _update_manifest_with_assembly(
        self,
        output_file: str,
        timeline_decisions: List[Dict[str, Any]],
        source_videos: List[str],
        audio_tracks: List[Dict[str, Any]]
    ) -> None:
        """
        Update the job manifest with assembly results.

        Args:
            output_file: Path to output file
            timeline_decisions: Timeline decisions used
            source_videos: Source video files
            audio_tracks: Audio tracks used
        """
        try:
            # Update manifest with assembly results
            manifest_data = {
                "assembly_results": {
                    "output_file": output_file,
                    "source_videos_count": len(source_videos),
                    "audio_tracks_count": len(audio_tracks),
                    "timeline_decisions_count": len(timeline_decisions),
                    "total_decisions": sum(len(d) for d in [timeline_decisions]),
                    "timestamp": self.context.manifest.created_at
                }
            }

            # In a real implementation, this would update the persistent manifest
            self.logger.info(f"Updated manifest with assembly results: {manifest_data}")

        except Exception as e:
            self.logger.warning(f"Failed to update manifest with assembly results: {str(e)}")
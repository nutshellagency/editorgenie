"""
Shot Detection node implementation.
Detects scene changes and shot boundaries in video files using Qwen Vision.
"""

import asyncio
import os
import tempfile
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


class ShotDetectionNode(BaseNode):
    """
    Shot Detection node using Qwen Vision for scene analysis.

    Analyzes video files to detect shot boundaries, scene changes,
    and visual transitions for automated video editing.
    """

    @property
    def node_type(self) -> str:
        return "shot_detect"

    async def process(self, input_data: BaseNodeInput) -> BaseNodeOutput:
        """
        Process video input and detect shot boundaries using Qwen Vision.

        Args:
            input_data: Input containing video file paths and detection settings

        Returns:
            BaseNodeOutput with shot detection results and metadata
        """
        try:
            # Extract configuration
            video_file = input_data.input_data.get("video_file")
            threshold = input_data.input_data.get("threshold", 0.8)
            min_shot_duration = input_data.input_data.get("min_shot_duration", 1.0)
            enable_qwen_vision = input_data.input_data.get("enable_qwen_vision", True)
            frame_sampling_rate = input_data.input_data.get("frame_sampling_rate", 30)

            # Validate input
            if not video_file:
                raise ValueError("video_file must be provided")

            # Get Qwen Vision API key from config
            api_key = self.context.config.get("qwen_api_key")
            if not api_key:
                raise ValueError("Qwen Vision API key not found in configuration")

            # Extract frames from video
            frames = await self._extract_frames(video_file, frame_sampling_rate)

            # Analyze frames with Qwen Vision
            shot_boundaries = await self._analyze_frames_with_qwen(
                api_key, frames, threshold, enable_qwen_vision
            )

            # Process shot boundaries
            shots = self._process_shot_boundaries(shot_boundaries, min_shot_duration)

            # Calculate statistics
            total_shots = len(shots)
            average_duration = sum(shot["duration"] for shot in shots) / max(total_shots, 1)
            scene_changes = [shot["start_time"] for shot in shots if shot["shot_type"] == "scene_change"]

            output_data = {
                "shots": shots,
                "total_shots": total_shots,
                "average_shot_duration": average_duration,
                "scene_changes": scene_changes,
                "threshold_used": threshold,
                "frame_sampling_rate": frame_sampling_rate,
                "detection_method": "qwen_vision" if enable_qwen_vision else "frame_analysis"
            }

            # Update manifest
            self._update_manifest_with_shots(shots, video_file)

            return self._create_output(
                NodeStatus.COMPLETED,
                output_data,
                {
                    "video_file": video_file,
                    "detection_method": "qwen_vision" if enable_qwen_vision else "frame_analysis",
                    "frames_analyzed": len(frames),
                    "settings": {
                        "threshold": threshold,
                        "min_shot_duration": min_shot_duration,
                        "frame_sampling_rate": frame_sampling_rate
                    }
                }
            )

        except Exception as e:
            return self._create_output(
                NodeStatus.FAILED,
                {},
                error_message=f"Shot detection failed: {str(e)}"
            )

    async def _extract_frames(self, video_file: str, sampling_rate: int) -> List[Dict[str, Any]]:
        """
        Extract frames from video at specified sampling rate.

        Args:
            video_file: Path to video file
            sampling_rate: Frames per second to extract

        Returns:
            List of frame data with timestamps
        """
        try:
            # Create temporary directory for frames
            temp_dir = tempfile.mkdtemp()
            frame_pattern = os.path.join(temp_dir, "frame_%06d.jpg")

            # Use FFmpeg to extract frames
            cmd = [
                "ffmpeg", "-i", video_file,
                "-vf", f"fps={sampling_rate}",
                "-q:v", "2",  # High quality
                "-frame_pts", "true",
                frame_pattern
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, check=True)

            # Get list of extracted frames
            frames = []
            for frame_file in sorted(Path(temp_dir).glob("frame_*.jpg")):
                # Calculate timestamp based on frame number and sampling rate
                frame_num = int(frame_file.stem.split("_")[1])
                timestamp = frame_num / sampling_rate

                frames.append({
                    "file_path": str(frame_file),
                    "timestamp": timestamp,
                    "frame_number": frame_num
                })

            self.logger.info(f"Extracted {len(frames)} frames from video: {video_file}")
            return frames

        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to extract frames from video: {e.stderr}")

    async def _analyze_frames_with_qwen(
        self,
        api_key: str,
        frames: List[Dict[str, Any]],
        threshold: float,
        enable_vision: bool
    ) -> List[Dict[str, Any]]:
        """
        Analyze frames using Qwen Vision to detect shot boundaries.

        Args:
            api_key: Qwen Vision API key
            frames: List of frame data
            threshold: Similarity threshold for shot detection
            enable_vision: Whether to use Qwen Vision or basic analysis

        Returns:
            List of shot boundary data
        """
        try:
            shot_boundaries = []

            if enable_vision:
                # Use Qwen Vision for advanced scene analysis
                shot_boundaries = await self._qwen_vision_analysis(api_key, frames, threshold)
            else:
                # Use basic frame comparison
                shot_boundaries = await self._basic_frame_analysis(frames, threshold)

            return shot_boundaries

        except Exception as e:
            raise RuntimeError(f"Frame analysis failed: {str(e)}")

    async def _qwen_vision_analysis(
        self,
        api_key: str,
        frames: List[Dict[str, Any]],
        threshold: float
    ) -> List[Dict[str, Any]]:
        """
        Analyze frames using Qwen Vision API.

        Args:
            api_key: Qwen Vision API key
            frames: List of frame data
            threshold: Similarity threshold

        Returns:
            List of shot boundary data
        """
        try:
            # This is a mock implementation
            # In a real implementation, this would:
            # 1. Upload frames to Qwen Vision
            # 2. Analyze scene similarity
            # 3. Detect shot boundaries
            # 4. Return structured results

            # Mock response for testing
            mock_boundaries = []

            # Simulate analysis delay
            await asyncio.sleep(0.1)

            # Generate mock shot boundaries
            for i in range(1, len(frames)):
                # Randomly detect shot boundaries (for testing)
                if i % 10 == 0:  # Every 10th frame is a shot boundary
                    mock_boundaries.append({
                        "frame_index": i,
                        "timestamp": frames[i]["timestamp"],
                        "confidence": 0.85,
                        "boundary_type": "cut" if i % 20 == 0 else "transition",
                        "similarity_score": 0.3 if i % 20 == 0 else 0.7
                    })

            return mock_boundaries

        except Exception as e:
            raise RuntimeError(f"Qwen Vision analysis failed: {str(e)}")

    async def _basic_frame_analysis(
        self,
        frames: List[Dict[str, Any]],
        threshold: float
    ) -> List[Dict[str, Any]]:
        """
        Basic frame analysis without Qwen Vision.

        Args:
            frames: List of frame data
            threshold: Similarity threshold

        Returns:
            List of shot boundary data
        """
        try:
            # Mock basic analysis
            mock_boundaries = []

            for i in range(1, len(frames)):
                # Simple mock logic - detect boundaries every 15 frames
                if i % 15 == 0:
                    mock_boundaries.append({
                        "frame_index": i,
                        "timestamp": frames[i]["timestamp"],
                        "confidence": 0.75,
                        "boundary_type": "basic_cut",
                        "similarity_score": 0.5
                    })

            return mock_boundaries

        except Exception as e:
            raise RuntimeError(f"Basic frame analysis failed: {str(e)}")

    def _process_shot_boundaries(
        self,
        boundaries: List[Dict[str, Any]],
        min_duration: float
    ) -> List[Dict[str, Any]]:
        """
        Process shot boundaries into shot segments.

        Args:
            boundaries: List of shot boundary data
            min_duration: Minimum shot duration in seconds

        Returns:
            List of shot segment data
        """
        try:
            shots = []
            prev_boundary = None

            for boundary in boundaries:
                if prev_boundary is None:
                    prev_boundary = boundary
                    continue

                duration = boundary["timestamp"] - prev_boundary["timestamp"]

                if duration >= min_duration:
                    shots.append({
                        "start_time": prev_boundary["timestamp"],
                        "end_time": boundary["timestamp"],
                        "duration": duration,
                        "shot_type": boundary["boundary_type"],
                        "confidence": boundary["confidence"],
                        "frame_count": int(duration * 30)  # Assuming 30fps
                    })

                prev_boundary = boundary

            return shots

        except Exception as e:
            self.logger.warning(f"Failed to process shot boundaries: {str(e)}")
            return []

    def _update_manifest_with_shots(
        self,
        shots: List[Dict[str, Any]],
        video_file: str
    ) -> None:
        """
        Update the job manifest with shot detection data.

        Args:
            shots: List of detected shots
            video_file: Path to video file
        """
        try:
            # Update manifest with shot detection results
            manifest_data = {
                "shot_detection_results": {
                    "video_file": video_file,
                    "total_shots": len(shots),
                    "average_shot_duration": sum(shot["duration"] for shot in shots) / max(len(shots), 1),
                    "shot_types": list(set(shot["shot_type"] for shot in shots)),
                    "timestamp": self.context.manifest.created_at
                }
            }

            # In a real implementation, this would update the persistent manifest
            self.logger.info(f"Updated manifest with shot detection results: {manifest_data}")

        except Exception as e:
            self.logger.warning(f"Failed to update manifest with shot detection results: {str(e)}")
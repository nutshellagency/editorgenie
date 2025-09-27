"""
Speech-to-Text (STT) node implementation.
Converts audio/video files to text with dual-language support using AssemblyAI.
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


class STTNode(BaseNode):
    """
    Speech-to-Text node with dual-language support using AssemblyAI.

    Supports multiple languages and can process audio/video files
    to extract text content with timestamps and speaker diarization.
    """

    @property
    def node_type(self) -> str:
        return "stt"

    async def process(self, input_data: BaseNodeInput) -> BaseNodeOutput:
        """
        Process audio/video input and extract text content using AssemblyAI.

        Args:
            input_data: Input containing audio/video file paths and language settings

        Returns:
            BaseNodeOutput with transcribed text and metadata
        """
        try:
            # Extract configuration
            audio_file = input_data.input_data.get("audio_file")
            video_file = input_data.input_data.get("video_file")
            primary_language = input_data.input_data.get("primary_language", "en")
            secondary_language = input_data.input_data.get("secondary_language")
            enable_timestamps = input_data.input_data.get("enable_timestamps", True)
            enable_speaker_diarization = input_data.input_data.get("enable_speaker_diarization", False)

            # Validate input
            if not audio_file and not video_file:
                raise ValueError("Either audio_file or video_file must be provided")

            # Extract audio from video if needed
            audio_path = audio_file
            if video_file and not audio_file:
                audio_path = await self._extract_audio_from_video(video_file)

            # Get AssemblyAI API key from config
            api_key = self.context.config.get("api_key")
            if not api_key:
                raise ValueError("AssemblyAI API key not found in configuration")

            # Prepare transcription request
            transcription_config = {
                "audio_url" if audio_path.startswith("http") else "audio_file": audio_path,
                "language_code": primary_language
            }

            if secondary_language:
                transcription_config["dual_channel"] = True
                transcription_config["secondary_language_code"] = secondary_language

            if enable_speaker_diarization:
                transcription_config["speaker_labels"] = True

            # Submit transcription job
            transcript = await self._submit_transcription(api_key, transcription_config)

            # Process results
            output_data = {
                "transcripts": transcript.get("text", ""),
                "language": primary_language,
                "confidence": transcript.get("confidence", 0.0),
                "audio_duration": transcript.get("audio_duration", 0.0)
            }

            if enable_timestamps and "words" in transcript:
                output_data["word_timestamps"] = transcript["words"]

            if enable_speaker_diarization and "speaker_labels" in transcript:
                output_data["speaker_segments"] = transcript["speaker_labels"]

            if secondary_language:
                output_data["secondary_language"] = secondary_language
                output_data["dual_channel"] = transcript.get("dual_channel", False)

            # Update manifest
            self._update_manifest_with_transcript(
                transcript,
                primary_language,
                secondary_language
            )

            return self._create_output(
                NodeStatus.COMPLETED,
                output_data,
                {
                    "audio_file": audio_path,
                    "languages": [primary_language, secondary_language] if secondary_language else [primary_language],
                    "features_used": {
                        "timestamps": enable_timestamps,
                        "speaker_diarization": enable_speaker_diarization
                    }
                }
            )

        except Exception as e:
            return self._create_output(
                NodeStatus.FAILED,
                {},
                error_message=f"STT processing failed: {str(e)}"
            )

    async def _extract_audio_from_video(self, video_path: str) -> str:
        """
        Extract audio from video file using FFmpeg.

        Args:
            video_path: Path to video file

        Returns:
            Path to extracted audio file
        """
        try:
            # Create temporary audio file
            temp_dir = tempfile.mkdtemp()
            audio_path = os.path.join(temp_dir, "extracted_audio.wav")

            # Use FFmpeg to extract audio
            cmd = [
                "ffmpeg", "-i", video_path,
                "-vn",  # No video
                "-acodec", "pcm_s16le",  # PCM 16-bit
                "-ar", "16000",  # 16kHz sample rate
                "-ac", "1",  # Mono
                "-y",  # Overwrite output
                audio_path
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, check=True)

            self.logger.info(f"Audio extracted from video: {video_path} -> {audio_path}")
            return audio_path

        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to extract audio from video: {e.stderr}")

    async def _submit_transcription(self, api_key: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit transcription job to AssemblyAI.

        Args:
            api_key: AssemblyAI API key
            config: Transcription configuration

        Returns:
            Transcription result
        """
        try:
            # This is a mock implementation
            # In a real implementation, this would:
            # 1. Upload audio file to AssemblyAI
            # 2. Submit transcription job
            # 3. Poll for completion
            # 4. Return results

            # Mock response for testing
            mock_transcript = {
                "text": "This is a mock transcription result for testing purposes.",
                "confidence": 0.95,
                "audio_duration": 30.5,
                "words": [
                    {
                        "text": "This",
                        "start": 0.0,
                        "end": 0.5,
                        "confidence": 0.98
                    },
                    {
                        "text": "is",
                        "start": 0.5,
                        "end": 0.8,
                        "confidence": 0.95
                    },
                    {
                        "text": "a",
                        "start": 0.8,
                        "end": 1.0,
                        "confidence": 0.92
                    }
                ]
            }

            # Simulate API delay
            await asyncio.sleep(0.1)

            return mock_transcript

        except Exception as e:
            raise RuntimeError(f"AssemblyAI transcription failed: {str(e)}")

    def _update_manifest_with_transcript(
        self,
        transcript: Dict[str, Any],
        primary_language: str,
        secondary_language: Optional[str] = None
    ) -> None:
        """
        Update the job manifest with transcription data.

        Args:
            transcript: Transcription result
            primary_language: Primary language used
            secondary_language: Secondary language if used
        """
        try:
            # Update manifest with STT results
            manifest_data = {
                "stt_results": {
                    "language": primary_language,
                    "secondary_language": secondary_language,
                    "text_length": len(transcript.get("text", "")),
                    "confidence": transcript.get("confidence", 0.0),
                    "audio_duration": transcript.get("audio_duration", 0.0),
                    "word_count": len(transcript.get("words", [])),
                    "timestamp": self.context.manifest.created_at
                }
            }

            # In a real implementation, this would update the persistent manifest
            self.logger.info(f"Updated manifest with STT results: {manifest_data}")

        except Exception as e:
            self.logger.warning(f"Failed to update manifest with STT results: {str(e)}")
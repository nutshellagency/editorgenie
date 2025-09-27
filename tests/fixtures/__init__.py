"""
Test fixtures and sample data for testing.

This module provides sample data files and fixtures that can be used
across different test modules for consistent testing.
"""
from pathlib import Path

# Sample data files that tests can use
SAMPLE_VIDEO_PATH = Path(__file__).parent / "sample_video.mp4"
SAMPLE_AUDIO_PATH = Path(__file__).parent / "sample_audio.wav"
SAMPLE_CONFIG_PATH = Path(__file__).parent / "sample_config.json"
SAMPLE_TRANSCRIPT_PATH = Path(__file__).parent / "sample_transcript.json"

__all__ = [
    "SAMPLE_VIDEO_PATH",
    "SAMPLE_AUDIO_PATH",
    "SAMPLE_CONFIG_PATH",
    "SAMPLE_TRANSCRIPT_PATH"
]
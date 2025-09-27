"""
Shared pytest fixtures and configuration for all test modules.

This module provides common fixtures, base test classes, and utilities
that can be used across all test modules in the project.
"""
import os
import tempfile
import shutil
from pathlib import Path
from typing import Generator, Dict, Any
import pytest
from unittest.mock import Mock, MagicMock

# Test data constants
TEST_DATA_DIR = Path(__file__) / "fixtures"
TEMP_DIR = Path(tempfile.gettempdir()) / "ai_video_editor_tests"


class BaseTestCase:
    """Base test case with common test utilities."""

    def setup_method(self):
        """Set up test environment before each test method."""
        self.temp_dir = Path(tempfile.mkdtemp(prefix="test_"))
        self.mock_data = {}

    def teardown_method(self):
        """Clean up test environment after each test method."""
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)

    def create_test_file(self, filename: str, content: str = "") -> Path:
        """Create a test file in the temporary directory."""
        file_path = self.temp_dir / filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)
        return file_path

    def create_mock_node_input(self, **kwargs) -> Dict[str, Any]:
        """Create a mock node input for testing."""
        default_input = {
            "video_path": str(self.create_test_file("test_video.mp4", "fake video content")),
            "audio_path": str(self.create_test_file("test_audio.wav", "fake audio content")),
            "metadata": {
                "duration": 10.0,
                "fps": 30,
                "resolution": "1920x1080"
            }
        }
        default_input.update(kwargs)
        return default_input

    def create_mock_node_output(self, **kwargs) -> Dict[str, Any]:
        """Create a mock node output for testing."""
        default_output = {
            "status": "success",
            "output_path": str(self.create_test_file("output.mp4")),
            "metadata": {
                "processing_time": 1.5,
                "output_format": "mp4"
            }
        }
        default_output.update(kwargs)
        return default_output


@pytest.fixture(scope="session")
def test_data_dir() -> Path:
    """Provide the test data directory path."""
    return TEST_DATA_DIR


@pytest.fixture(scope="session")
def temp_dir() -> Path:
    """Provide a temporary directory for tests."""
    temp_path = TEMP_DIR
    temp_path.mkdir(exist_ok=True)
    return temp_path


@pytest.fixture
def isolated_temp_dir(temp_dir: Path) -> Generator[Path, None, None]:
    """Provide an isolated temporary directory for each test."""
    test_temp_dir = temp_dir / "isolated" / str(id(tempfile._gettempdir()))
    test_temp_dir.mkdir(parents=True, exist_ok=True)

    yield test_temp_dir

    # Cleanup after test
    if test_temp_dir.exists():
        shutil.rmtree(test_temp_dir)


@pytest.fixture
def mock_video_file(isolated_temp_dir: Path) -> Path:
    """Create a mock video file for testing."""
    video_file = isolated_temp_dir / "test_video.mp4"
    # Create a fake video file (just some binary data)
    video_file.write_bytes(b'\x00\x01\x02\x03' * 1000)
    return video_file


@pytest.fixture
def mock_audio_file(isolated_temp_dir: Path) -> Path:
    """Create a mock audio file for testing."""
    audio_file = isolated_temp_dir / "test_audio.wav"
    # Create a fake audio file (just some binary data)
    audio_file.write_bytes(b'RIFF' + b'\x00' * 1000)
    return audio_file


@pytest.fixture
def mock_config() -> Dict[str, Any]:
    """Provide a mock configuration for testing."""
    return {
        "api": {
            "host": "localhost",
            "port": 8000,
            "debug": True
        },
        "processing": {
            "max_video_duration": 300,
            "supported_formats": ["mp4", "avi", "mov"],
            "temp_directory": "/tmp/processing"
        },
        "ai_services": {
            "assemblyai_api_key": "test_key",
            "qwen_api_key": "test_key",
            "gemini_api_key": "test_key"
        }
    }


@pytest.fixture
def mock_node_contract() -> Dict[str, Any]:
    """Provide a mock node contract for testing."""
    return {
        "type": "object",
        "properties": {
            "input_schema": {
                "type": "object",
                "properties": {
                    "video_path": {"type": "string"},
                    "audio_path": {"type": "string"}
                },
                "required": ["video_path"]
            },
            "output_schema": {
                "type": "object",
                "properties": {
                    "output_path": {"type": "string"},
                    "status": {"type": "string"}
                },
                "required": ["output_path", "status"]
            }
        }
    }


@pytest.fixture
def mock_job_manifest() -> Dict[str, Any]:
    """Provide a mock job manifest for testing."""
    return {
        "job_id": "test-job-123",
        "workflow": [
            {
                "node_id": "stt_1",
                "node_type": "stt",
                "input": {"video_path": "/path/to/video.mp4"},
                "output": {"transcript": "/path/to/transcript.json"}
            }
        ],
        "created_at": "2024-01-01T00:00:00Z",
        "status": "pending"
    }


@pytest.fixture
def mock_ai_service():
    """Provide a mock AI service for testing."""
    service = Mock()
    service.process.return_value = {"result": "mocked response"}
    service.get_cost.return_value = 0.01
    service.validate_input.return_value = True
    return service


@pytest.fixture
def sample_video_metadata() -> Dict[str, Any]:
    """Provide sample video metadata for testing."""
    return {
        "duration": 10.5,
        "fps": 30,
        "resolution": {"width": 1920, "height": 1080},
        "format": "mp4",
        "bitrate": 2000000,
        "codec": "h264"
    }


@pytest.fixture
def sample_transcript() -> Dict[str, Any]:
    """Provide sample transcript data for testing."""
    return {
        "text": "This is a sample transcript for testing purposes.",
        "language": "en",
        "confidence": 0.95,
        "words": [
            {"word": "This", "start": 0.0, "end": 0.5, "confidence": 0.9},
            {"word": "is", "start": 0.5, "end": 0.8, "confidence": 0.95},
            {"word": "a", "start": 0.8, "end": 1.0, "confidence": 0.98},
            {"word": "sample", "start": 1.0, "end": 1.5, "confidence": 0.92}
        ]
    }


# Performance testing utilities
@pytest.fixture
def performance_timer():
    """Provide a simple performance timer for benchmarking."""
    import time

    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None

        def __enter__(self):
            self.start_time = time.perf_counter()
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            self.end_time = time.perf_counter()

        @property
        def duration(self) -> float:
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return 0.0

    return Timer


# Coverage utilities
def pytest_configure(config):
    """Configure pytest with custom markers and settings."""
    # Register custom markers
    config.addinivalue_line("markers", "unit: Unit tests")
    config.addinivalue_line("markers", "integration: Integration tests")
    config.addinivalue_line("markers", "e2e: End-to-end tests")
    config.addinivalue_line("markers", "visual: Visual regression tests")
    config.addinivalue_line("markers", "performance: Performance tests")
    config.addinivalue_line("markers", "security: Security tests")


def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers automatically."""
    for item in items:
        # Add markers based on file path
        if "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        elif "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        elif "e2e" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)
        elif "visual" in str(item.fspath):
            item.add_marker(pytest.mark.visual)
        elif "performance" in str(item.fspath):
            item.add_marker(pytest.mark.performance)
        elif "security" in str(item.fspath):
            item.add_marker(pytest.mark.security)
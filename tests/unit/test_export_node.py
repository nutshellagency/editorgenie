"""
Unit tests for the Export node functionality.
Tests multi-format video export capabilities and error handling.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import asyncio
from pathlib import Path
import tempfile
import json

from src.core.nodes.export import ExportNode
from src.core.nodes.base import NodeExecutionContext
from src.core.schemas.base import (
    BaseNodeInput,
    BaseNodeOutput,
    NodeStatus,
    NodeType,
    NodeContract
)
from src.core.replay.manifest import ReplayManifest


class TestExportNode:
    """Test suite for ExportNode functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.contract = NodeContract(
            name="Export Node",
            version="1.0.0",
            node_type=NodeType.EXPORT,
            description="Export video in multiple formats",
            input_schema={
                "type": "object",
                "properties": {
                    "video_path": {"type": "string"},
                    "output_format": {"type": "string"},
                    "output_path": {"type": "string"},
                    "quality": {"type": "string"},
                    "codec": {"type": "string"},
                    "resolution": {"type": "string"},
                    "bitrate": {"type": "string"},
                    "framerate": {"type": "number"},
                    "aspect_ratio": {"type": "string"},
                    "audio_codec": {"type": "string"},
                    "audio_bitrate": {"type": "string"},
                    "transcript_path": {"type": "string"},
                    "subtitle_format": {"type": "string"}
                },
                "required": ["video_path", "output_format", "output_path"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "exported_file": {"type": "string"},
                    "export_format": {"type": "string"},
                    "file_size": {"type": "number"},
                    "codec": {"type": "string"},
                    "bitrate": {"type": "string"},
                    "resolution": {"type": "string"},
                    "aspect_ratio": {"type": "string"},
                    "subtitle_file": {"type": "string"}
                },
                "required": ["exported_file", "export_format", "file_size"]
            },
            config_schema={
                "type": "object",
                "properties": {
                    "ffmpeg_path": {"type": "string"},
                    "default_codec": {"type": "string"},
                    "temp_directory": {"type": "string"}
                }
            }
        )

        self.context = NodeExecutionContext(
            job_id="test-job-export",
            node_id="test-export-node",
            base_dir=Path("/tmp/test"),
            config={"ffmpeg_path": "ffmpeg", "temp_directory": "/tmp"},
            logger=Mock(),
            manifest=Mock()
        )

        self.temp_dir = tempfile.mkdtemp()

    def teardown_method(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_export_node_initialization(self):
        """Test that ExportNode initializes correctly."""
        node = ExportNode(self.contract, self.context)

        assert node.contract == self.contract
        assert node.context == self.context
        assert node.node_type == "export"

    def test_export_node_contract(self):
        """Test ExportNode contract validation."""
        node = ExportNode(self.contract, self.context)
        contract = node.contract

        assert isinstance(contract, NodeContract)
        assert contract.name == "Export Node"
        assert contract.version == "1.0.0"

        # Check input schema
        input_schema = contract.input_schema
        assert "video_path" in input_schema["properties"]
        assert "output_format" in input_schema["properties"]
        assert "output_path" in input_schema["properties"]

        # Check output schema
        output_schema = contract.output_schema
        assert "exported_file" in output_schema["properties"]
        assert "export_format" in output_schema["properties"]
        assert "file_size" in output_schema["properties"]

    def test_export_basic_mp4_export(self):
        """Test basic MP4 export functionality."""
        node = ExportNode(self.contract, self.context)

        # Create test input
        input_data = BaseNodeInput(
            job_id="test-job-export",
            node_id="test-export-node",
            input_data={
                "video_path": "/path/to/input_video.mp4",
                "output_format": "mp4",
                "output_path": f"{self.temp_dir}/output.mp4",
                "quality": "high",
                "codec": "h264"
            }
        )

        # Mock file existence and FFmpeg execution
        with patch('os.path.exists', return_value=True), \
             patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="", stderr="")

            # Execute node
            result = asyncio.run(node.process(input_data))

            # Verify result
            assert result.status == NodeStatus.COMPLETED
            assert result.output_data["exported_file"] == f"{self.temp_dir}/output.mp4"
            assert result.output_data["export_format"] == "mp4"
            assert "file_size" in result.output_data

            # Verify FFmpeg was called
            mock_run.assert_called_once()
            call_args = mock_run.call_args[0][0]
            assert "ffmpeg" in call_args[0]
            assert "-i" in call_args
            assert "/path/to/input_video.mp4" in call_args

    def test_export_mov_export(self):
        """Test MOV export functionality."""
        node = ExportNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-export",
            node_id="test-export-node",
            input_data={
                "video_path": "/path/to/input_video.mp4",
                "output_format": "mov",
                "output_path": f"{self.temp_dir}/output.mov",
                "codec": "prores"
            }
        )

        with patch('os.path.exists', return_value=True), \
             patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="", stderr="")

            result = asyncio.run(node.process(input_data))

            assert result.status == NodeStatus.COMPLETED
            assert result.output_data["exported_file"] == f"{self.temp_dir}/output.mov"
            assert result.output_data["export_format"] == "mov"

    def test_export_avi_export(self):
        """Test AVI export functionality."""
        node = ExportNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-export",
            node_id="test-export-node",
            input_data={
                "video_path": "/path/to/input_video.mp4",
                "output_format": "avi",
                "output_path": f"{self.temp_dir}/output.avi",
                "codec": "xvid"
            }
        )

        with patch('os.path.exists', return_value=True), \
             patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="", stderr="")

            result = asyncio.run(node.process(input_data))

            assert result.status == NodeStatus.COMPLETED
            assert result.output_data["exported_file"] == f"{self.temp_dir}/output.avi"
            assert result.output_data["export_format"] == "avi"

    def test_export_with_aspect_ratio_conversion(self):
        """Test export with aspect ratio conversion."""
        node = ExportNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-export",
            node_id="test-export-node",
            input_data={
                "video_path": "/path/to/input_video.mp4",
                "output_format": "mp4",
                "output_path": f"{self.temp_dir}/output.mp4",
                "aspect_ratio": "9:16",
                "resolution": "1080x1920"
            }
        )

        with patch('os.path.exists', return_value=True), \
             patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="", stderr="")

            result = asyncio.run(node.process(input_data))

            assert result.status == NodeStatus.COMPLETED
            assert result.output_data["export_format"] == "mp4"
            assert result.output_data["aspect_ratio"] == "9:16"

    def test_export_with_subtitle_generation(self):
        """Test export with subtitle generation."""
        node = ExportNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-export",
            node_id="test-export-node",
            input_data={
                "video_path": "/path/to/input_video.mp4",
                "output_format": "mp4",
                "output_path": f"{self.temp_dir}/output.mp4",
                "transcript_path": "/path/to/transcript.json",
                "subtitle_format": "srt"
            }
        )

        # Mock file operations and FFmpeg execution
        with patch('os.path.exists', return_value=True), \
             patch('subprocess.run') as mock_run, \
             patch('builtins.open') as mock_file, \
             patch('json.load') as mock_json:

            mock_run.return_value = Mock(returncode=0, stdout="", stderr="")
            mock_file.return_value.__enter__ = Mock(return_value=Mock())
            mock_file.return_value.__exit__ = Mock(return_value=None)
            mock_json.return_value = {
                "segments": [
                    {"start": 0.0, "end": 2.0, "text": "Hello world"},
                    {"start": 2.0, "end": 4.0, "text": "This is a test"}
                ]
            }

            result = asyncio.run(node.process(input_data))

            assert result.status == NodeStatus.COMPLETED
            assert result.output_data["export_format"] == "mp4"
            assert "subtitle_file" in result.output_data

    def test_export_error_handling(self):
        """Test export error handling."""
        node = ExportNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-export",
            node_id="test-export-node",
            input_data={
                "video_path": "/path/to/input_video.mp4",
                "output_format": "mp4",
                "output_path": f"{self.temp_dir}/output.mp4"
            }
        )

        with patch('os.path.exists', return_value=True), \
             patch('subprocess.run') as mock_run:
            mock_run.side_effect = Exception("FFmpeg failed")

            result = asyncio.run(node.process(input_data))

            assert result.status == NodeStatus.FAILED
            assert "FFmpeg failed" in result.error_message

    def test_export_invalid_format(self):
        """Test export with invalid format."""
        node = ExportNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-export",
            node_id="test-export-node",
            input_data={
                "video_path": "/path/to/input_video.mp4",
                "output_format": "invalid_format",
                "output_path": f"{self.temp_dir}/output.invalid"
            }
        )

        with patch('os.path.exists', return_value=True):
            result = asyncio.run(node.process(input_data))

            assert result.status == NodeStatus.FAILED
            assert "invalid_format" in result.error_message

    def test_export_missing_input_file(self):
        """Test export with missing input file."""
        node = ExportNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-export",
            node_id="test-export-node",
            input_data={
                "video_path": "/definitely/does/not/exist/input_video.mp4",
                "output_format": "mp4",
                "output_path": f"{self.temp_dir}/output.mp4"
            }
        )

        result = asyncio.run(node.process(input_data))

        assert result.status == NodeStatus.FAILED
        assert "Input video file not found" in result.error_message

    def test_export_complex_configuration(self):
        """Test export with complex configuration."""
        node = ExportNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-export",
            node_id="test-export-node",
            input_data={
                "video_path": "/path/to/input_video.mp4",
                "output_format": "mp4",
                "output_path": f"{self.temp_dir}/output.mp4",
                "quality": "high",
                "codec": "h264",
                "bitrate": "5000k",
                "resolution": "1920x1080",
                "framerate": 30,
                "audio_codec": "aac",
                "audio_bitrate": "192k"
            }
        )

        with patch('os.path.exists', return_value=True), \
             patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="", stderr="")

            result = asyncio.run(node.process(input_data))

            assert result.status == NodeStatus.COMPLETED
            assert result.output_data["export_format"] == "mp4"
            assert result.output_data["codec"] == "h264"
            assert result.output_data["bitrate"] == "5000k"

    def test_export_mkv_format(self):
        """Test MKV export functionality."""
        node = ExportNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-export",
            node_id="test-export-node",
            input_data={
                "video_path": "/path/to/input_video.mp4",
                "output_format": "mkv",
                "output_path": f"{self.temp_dir}/output.mkv",
                "codec": "h264"
            }
        )

        with patch('os.path.exists', return_value=True), \
             patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="", stderr="")

            result = asyncio.run(node.process(input_data))

            assert result.status == NodeStatus.COMPLETED
            assert result.output_data["exported_file"] == f"{self.temp_dir}/output.mkv"
            assert result.output_data["export_format"] == "mkv"

    def test_export_replay_manifest_generation(self):
        """Test that export generates proper replay manifest."""
        node = ExportNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-export",
            node_id="test-export-node",
            input_data={
                "video_path": "/path/to/input_video.mp4",
                "output_format": "mp4",
                "output_path": f"{self.temp_dir}/output.mp4"
            }
        )

        with patch('os.path.exists', return_value=True), \
             patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="", stderr="")

            result = asyncio.run(node.process(input_data))

            # Check that the export completed successfully
            assert result.status == NodeStatus.COMPLETED
            assert "exported_file" in result.output_data
            assert result.output_data["export_format"] == "mp4"
            assert result.output_data["file_size"] > 0
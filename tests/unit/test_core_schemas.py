"""
Unit tests for core schema definitions.
"""

import pytest
from datetime import datetime
from pathlib import Path

from src.core.schemas.base import (
    NodeType,
    NodeStatus,
    BaseNodeInput,
    BaseNodeOutput,
    NodeContract,
    JobManifest
)


class TestNodeTypes:
    """Test node type enumerations."""

    def test_node_types(self):
        """Test that all node types are defined."""
        assert NodeType.STT == "stt"
        assert NodeType.SHOT_DETECT == "shot_detect"
        assert NodeType.VISION == "vision"
        assert NodeType.DIRECTOR == "director"
        assert NodeType.ASSEMBLY == "assembly"
        assert NodeType.EXPORT == "export"

    def test_node_statuses(self):
        """Test that all node statuses are defined."""
        assert NodeStatus.PENDING == "pending"
        assert NodeStatus.RUNNING == "running"
        assert NodeStatus.COMPLETED == "completed"
        assert NodeStatus.FAILED == "failed"
        assert NodeStatus.CANCELLED == "cancelled"


class TestBaseNodeInput:
    """Test base node input schema."""

    def test_valid_input(self):
        """Test creating valid input."""
        input_data = BaseNodeInput(
            job_id="test-job-123",
            node_id="test-node-456",
            input_data={"video_path": "/path/to/video.mp4"},
            config={"param1": "value1"},
            dependencies=["node1", "node2"]
        )

        assert input_data.job_id == "test-job-123"
        assert input_data.node_id == "test-node-456"
        assert input_data.input_data == {"video_path": "/path/to/video.mp4"}
        assert input_data.config == {"param1": "value1"}
        assert input_data.dependencies == ["node1", "node2"]

    def test_default_values(self):
        """Test default values for optional fields."""
        input_data = BaseNodeInput(
            job_id="test-job-123",
            node_id="test-node-456",
            input_data={"test": "data"}
        )

        assert input_data.config == {}
        assert input_data.dependencies == []


class TestBaseNodeOutput:
    """Test base node output schema."""

    def test_valid_output(self):
        """Test creating valid output."""
        output_data = BaseNodeOutput(
            job_id="test-job-123",
            node_id="test-node-456",
            status=NodeStatus.COMPLETED,
            output_data={"result": "success"},
            metadata={"duration": 1.5},
            error_message=None,
            execution_time=1.23,
            timestamp=datetime.now().isoformat()
        )

        assert output_data.job_id == "test-job-123"
        assert output_data.node_id == "test-node-456"
        assert output_data.status == NodeStatus.COMPLETED
        assert output_data.output_data == {"result": "success"}
        assert output_data.metadata == {"duration": 1.5}
        assert output_data.error_message is None
        assert output_data.execution_time == 1.23


class TestNodeContract:
    """Test node contract schema."""

    def test_valid_contract(self):
        """Test creating valid contract."""
        contract = NodeContract(
            name="Test STT Node",
            version="1.0.0",
            node_type=NodeType.STT,
            description="Speech-to-text processing node",
            input_schema={
                "type": "object",
                "properties": {
                    "audio_file": {"type": "string"}
                }
            },
            output_schema={
                "type": "object",
                "properties": {
                    "transcript": {"type": "string"}
                }
            },
            config_schema={
                "type": "object",
                "properties": {
                    "language": {"type": "string", "default": "en"}
                }
            },
            dependencies=["ffmpeg"],
            timeout=300,
            retry_count=3,
            memory_mb=512,
            tags=["audio", "speech"]
        )

        assert contract.name == "Test STT Node"
        assert contract.version == "1.0.0"
        assert contract.node_type == NodeType.STT
        assert contract.description == "Speech-to-text processing node"
        assert contract.timeout == 300
        assert contract.retry_count == 3
        assert contract.memory_mb == 512
        assert contract.tags == ["audio", "speech"]

    def test_default_values(self):
        """Test default values for optional fields."""
        contract = NodeContract(
            name="Test Node",
            version="1.0.0",
            node_type=NodeType.STT,
            description="Test description",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        assert contract.dependencies == []
        assert contract.timeout == 300
        assert contract.retry_count == 3
        assert contract.memory_mb == 512
        assert contract.tags == []


class TestJobManifest:
    """Test job manifest schema."""

    def test_valid_manifest(self):
        """Test creating valid manifest."""
        manifest = JobManifest(
            job_id="test-job-123",
            status="running",
            nodes=[
                {
                    "id": "node1",
                    "type": "stt",
                    "config": {"language": "en"}
                }
            ],
            input_files=["/path/to/video.mp4"],
            output_files=["/path/to/output.json"],
            created_at=datetime.now().isoformat(),
            completed_at=None,
            node_versions={"stt": "1.0.0"},
            environment={"PYTHONPATH": "/app"},
            replay_data={"test": "data"}
        )

        assert manifest.job_id == "test-job-123"
        assert manifest.status == "running"
        assert len(manifest.nodes) == 1
        assert manifest.input_files == ["/path/to/video.mp4"]
        assert manifest.output_files == ["/path/to/output.json"]
        assert manifest.node_versions == {"stt": "1.0.0"}
        assert manifest.environment == {"PYTHONPATH": "/app"}
        assert manifest.replay_data == {"test": "data"}

    def test_default_values(self):
        """Test default values for optional fields."""
        manifest = JobManifest(
            job_id="test-job-123",
            status="pending",
            nodes=[],
            input_files=[],
            output_files=[],
            created_at=datetime.now().isoformat(),
            node_versions={},
            environment={}
        )

        assert manifest.completed_at is None
        assert manifest.replay_data == {}
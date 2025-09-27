"""
Unit tests for replay manifest system.
"""

import pytest
import json
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from unittest.mock import Mock, patch

from src.core.replay.manifest import (
    ReplayManifest,
    NodeExecutionRecord,
    ReplayArtifact
)
from src.core.schemas.base import NodeStatus, JobManifest


class TestReplayArtifact:
    """Test replay artifact functionality."""

    def test_artifact_creation(self):
        """Test creating a replay artifact."""
        artifact = ReplayArtifact(
            node_id="test-node-123",
            artifact_type="transcript",
            file_path="/path/to/transcript.json",
            metadata={"duration": 120.5, "language": "en"},
            created_at=datetime.now().isoformat()
        )

        assert artifact.node_id == "test-node-123"
        assert artifact.artifact_type == "transcript"
        assert artifact.file_path == "/path/to/transcript.json"
        assert artifact.metadata == {"duration": 120.5, "language": "en"}


class TestNodeExecutionRecord:
    """Test node execution record functionality."""

    def test_record_creation(self):
        """Test creating an execution record."""
        record = NodeExecutionRecord(
            node_id="test-node-123",
            node_type="stt",
            node_version="1.0.0",
            status=NodeStatus.COMPLETED,
            input_data={"audio_file": "/path/to/audio.wav"},
            output_data={"transcript": "Hello world"},
            execution_time=1.23,
            started_at=datetime.now().isoformat(),
            completed_at=datetime.now().isoformat(),
            error_message=None,
            artifacts=[
                ReplayArtifact(
                    node_id="test-node-123",
                    artifact_type="transcript",
                    file_path="/path/to/transcript.json",
                    metadata={"duration": 120.5},
                    created_at=datetime.now().isoformat()
                )
            ]
        )

        assert record.node_id == "test-node-123"
        assert record.node_type == "stt"
        assert record.node_version == "1.0.0"
        assert record.status == NodeStatus.COMPLETED
        assert record.input_data == {"audio_file": "/path/to/audio.wav"}
        assert record.output_data == {"transcript": "Hello world"}
        assert record.execution_time == 1.23
        assert len(record.artifacts) == 1

    def test_default_artifacts(self):
        """Test default empty artifacts list."""
        record = NodeExecutionRecord(
            node_id="test-node-123",
            node_type="stt",
            node_version="1.0.0",
            status=NodeStatus.COMPLETED,
            input_data={},
            output_data={},
            execution_time=1.0,
            started_at=datetime.now().isoformat(),
            completed_at=datetime.now().isoformat()
        )

        assert record.artifacts == []


class TestReplayManifest:
    """Test replay manifest functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.manifest_path = Path(self.temp_dir) / "test_manifest.json"

    def teardown_method(self):
        """Clean up test fixtures."""
        if self.manifest_path.exists():
            self.manifest_path.unlink()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_manifest_initialization_new_file(self):
        """Test initializing manifest with new file."""
        manifest = ReplayManifest(self.manifest_path)

        assert manifest.manifest.job_id == ""
        assert manifest.manifest.status == "pending"
        assert manifest.manifest.nodes == []
        assert manifest.manifest.input_files == []
        assert manifest.manifest.output_files == []
        assert manifest.manifest.node_versions == {}
        assert manifest.manifest.environment == {}
        assert manifest.manifest.replay_data == {}

    def test_manifest_initialization_existing_file(self):
        """Test initializing manifest with existing file."""
        # Create existing manifest
        existing_data = {
            "job_id": "existing-job-123",
            "status": "running",
            "nodes": [{"id": "node1", "type": "stt"}],
            "input_files": ["/path/to/video.mp4"],
            "output_files": ["/path/to/output.json"],
            "created_at": datetime.now().isoformat(),
            "completed_at": None,
            "node_versions": {"stt": "1.0.0"},
            "environment": {"TEST": "value"},
            "replay_data": {"test": "data"}
        }

        with open(self.manifest_path, 'w') as f:
            json.dump(existing_data, f)

        manifest = ReplayManifest(self.manifest_path)

        assert manifest.manifest.job_id == "existing-job-123"
        assert manifest.manifest.status == "running"
        assert len(manifest.manifest.nodes) == 1
        assert manifest.manifest.input_files == ["/path/to/video.mp4"]
        assert manifest.manifest.output_files == ["/path/to/output.json"]
        assert manifest.manifest.node_versions == {"stt": "1.0.0"}
        assert manifest.manifest.environment == {"TEST": "value"}
        assert manifest.manifest.replay_data == {"test": "data"}

    def test_initialize_job(self):
        """Test job initialization."""
        manifest = ReplayManifest(self.manifest_path)

        nodes = [
            {"id": "node1", "type": "stt", "config": {"language": "en"}},
            {"id": "node2", "type": "vision", "config": {"model": "gpt-4"}}
        ]
        input_files = ["/path/to/video.mp4"]
        node_versions = {"stt": "1.0.0", "vision": "2.0.0"}
        environment = {"PYTHONPATH": "/app", "CUDA_VISIBLE_DEVICES": "0"}

        manifest.initialize_job(
            job_id="test-job-123",
            nodes=nodes,
            input_files=input_files,
            node_versions=node_versions,
            environment=environment
        )

        assert manifest.manifest.job_id == "test-job-123"
        assert manifest.manifest.status == "running"
        assert manifest.manifest.nodes == nodes
        assert manifest.manifest.input_files == input_files
        assert manifest.manifest.node_versions == node_versions
        assert manifest.manifest.environment == environment

    def test_add_execution_record(self):
        """Test adding execution records."""
        manifest = ReplayManifest(self.manifest_path)

        record = NodeExecutionRecord(
            node_id="test-node-123",
            node_type="stt",
            node_version="1.0.0",
            status=NodeStatus.COMPLETED,
            input_data={"audio_file": "/path/to/audio.wav"},
            output_data={"transcript": "Hello world"},
            execution_time=1.23,
            started_at=datetime.now().isoformat(),
            completed_at=datetime.now().isoformat()
        )

        manifest.add_execution_record(record)

        assert len(manifest.execution_records) == 1
        assert manifest.execution_records[0] == record

    def test_get_execution_record(self):
        """Test getting execution records."""
        manifest = ReplayManifest(self.manifest_path)

        record1 = NodeExecutionRecord(
            node_id="node1",
            node_type="stt",
            node_version="1.0.0",
            status=NodeStatus.COMPLETED,
            input_data={},
            output_data={},
            execution_time=1.0,
            started_at=datetime.now().isoformat(),
            completed_at=datetime.now().isoformat()
        )

        record2 = NodeExecutionRecord(
            node_id="node2",
            node_type="vision",
            node_version="2.0.0",
            status=NodeStatus.FAILED,
            input_data={},
            output_data={},
            execution_time=0.5,
            started_at=datetime.now().isoformat(),
            completed_at=datetime.now().isoformat(),
            error_message="Test error"
        )

        manifest.add_execution_record(record1)
        manifest.add_execution_record(record2)

        assert manifest.get_execution_record("node1") == record1
        assert manifest.get_execution_record("node2") == record2
        assert manifest.get_execution_record("nonexistent") is None

    def test_add_artifact(self):
        """Test adding artifacts to execution records."""
        manifest = ReplayManifest(self.manifest_path)

        record = NodeExecutionRecord(
            node_id="test-node-123",
            node_type="stt",
            node_version="1.0.0",
            status=NodeStatus.COMPLETED,
            input_data={},
            output_data={},
            execution_time=1.0,
            started_at=datetime.now().isoformat(),
            completed_at=datetime.now().isoformat()
        )

        manifest.add_execution_record(record)

        artifact = ReplayArtifact(
            node_id="test-node-123",
            artifact_type="transcript",
            file_path="/path/to/transcript.json",
            metadata={"duration": 120.5},
            created_at=datetime.now().isoformat()
        )

        manifest.add_artifact("test-node-123", artifact)

        retrieved_record = manifest.get_execution_record("test-node-123")
        assert len(retrieved_record.artifacts) == 1
        assert retrieved_record.artifacts[0] == artifact

    def test_job_status_updates(self):
        """Test job status updates based on node executions."""
        manifest = ReplayManifest(self.manifest_path)

        # Initialize job
        manifest.initialize_job(
            job_id="test-job-123",
            nodes=[
                {"id": "node1", "type": "stt"},
                {"id": "node2", "type": "vision"}
            ],
            input_files=[],
            node_versions={},
            environment={}
        )

        # Add successful record
        record1 = NodeExecutionRecord(
            node_id="node1",
            node_type="stt",
            node_version="1.0.0",
            status=NodeStatus.COMPLETED,
            input_data={},
            output_data={},
            execution_time=1.0,
            started_at=datetime.now().isoformat(),
            completed_at=datetime.now().isoformat()
        )

        manifest.add_execution_record(record1)
        assert manifest.manifest.status == "running"  # Still running, not all nodes completed

        # Add failed record
        record2 = NodeExecutionRecord(
            node_id="node2",
            node_type="vision",
            node_version="2.0.0",
            status=NodeStatus.FAILED,
            input_data={},
            output_data={},
            execution_time=0.5,
            started_at=datetime.now().isoformat(),
            completed_at=datetime.now().isoformat(),
            error_message="Test error"
        )

        manifest.add_execution_record(record2)
        assert manifest.manifest.status == "failed"  # Failed because one node failed

    def test_get_replay_data(self):
        """Test getting replay data."""
        manifest = ReplayManifest(self.manifest_path)

        # Initialize job
        manifest.initialize_job(
            job_id="test-job-123",
            nodes=[{"id": "node1", "type": "stt"}],
            input_files=["/path/to/video.mp4"],
            node_versions={"stt": "1.0.0"},
            environment={"TEST": "value"}
        )

        # Add execution record
        record = NodeExecutionRecord(
            node_id="node1",
            node_type="stt",
            node_version="1.0.0",
            status=NodeStatus.COMPLETED,
            input_data={"audio_file": "/path/to/audio.wav"},
            output_data={"transcript": "Hello world"},
            execution_time=1.23,
            started_at=datetime.now().isoformat(),
            completed_at=datetime.now().isoformat()
        )

        manifest.add_execution_record(record)

        replay_data = manifest.get_replay_data()

        assert "manifest" in replay_data
        assert "execution_records" in replay_data
        assert "replay_instructions" in replay_data
        assert len(replay_data["execution_records"]) == 1

    def test_validate_replay_environment(self):
        """Test environment validation for replay."""
        manifest = ReplayManifest(self.manifest_path)

        manifest.initialize_job(
            job_id="test-job-123",
            nodes=[],
            input_files=[],
            node_versions={"stt": "1.0.0", "vision": "2.0.0"},
            environment={"PYTHONPATH": "/app", "CUDA_VISIBLE_DEVICES": "0"}
        )

        issues = manifest.validate_replay_environment()

        # Should return validation issues (though we can't actually check versions in unit test)
        assert len(issues) == 4  # 2 node versions + 2 environment variables
        assert any("stt" in issue for issue in issues)
        assert any("vision" in issue for issue in issues)
        assert any("PYTHONPATH" in issue for issue in issues)
        assert any("CUDA_VISIBLE_DEVICES" in issue for issue in issues)

    def test_export_for_debug(self):
        """Test exporting manifest for debugging."""
        manifest = ReplayManifest(self.manifest_path)

        # Initialize job and add some data
        manifest.initialize_job(
            job_id="test-job-123",
            nodes=[{"id": "node1", "type": "stt"}],
            input_files=["/path/to/video.mp4"],
            node_versions={"stt": "1.0.0"},
            environment={"TEST": "value"}
        )

        record = NodeExecutionRecord(
            node_id="node1",
            node_type="stt",
            node_version="1.0.0",
            status=NodeStatus.COMPLETED,
            input_data={},
            output_data={},
            execution_time=1.0,
            started_at=datetime.now().isoformat(),
            completed_at=datetime.now().isoformat()
        )

        manifest.add_execution_record(record)

        # Export for debug
        debug_path = Path(self.temp_dir) / "debug_export.json"
        manifest.export_for_debug(debug_path)

        # Verify export file was created and contains expected data
        assert debug_path.exists()

        with open(debug_path, 'r') as f:
            debug_data = json.load(f)

        assert debug_data["manifest"]["job_id"] == "test-job-123"
        assert len(debug_data["execution_records"]) == 1
        assert "exported_at" in debug_data
        assert "validation_issues" in debug_data
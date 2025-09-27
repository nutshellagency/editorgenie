"""
Replay manifest system for job reproducibility and debugging.
Captures all inputs, node versions, and artifacts for deterministic replay.
"""

import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

from ..schemas.base import JobManifest, NodeStatus


@dataclass
class ReplayArtifact:
    """Represents an artifact from node execution."""
    node_id: str
    artifact_type: str  # e.g., "transcript", "shot_data", "edited_video"
    file_path: str
    metadata: Dict[str, Any]
    created_at: str


@dataclass
class NodeExecutionRecord:
    """Record of a single node execution."""
    node_id: str
    node_type: str
    node_version: str
    status: NodeStatus
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    execution_time: float
    started_at: str
    completed_at: str
    error_message: Optional[str] = None
    artifacts: List[ReplayArtifact] = None

    def __post_init__(self):
        if self.artifacts is None:
            self.artifacts = []


class ReplayManifest:
    """
    Manages the replay manifest for a job.
    Ensures all job executions are reproducible and debuggable.
    """

    def __init__(self, manifest_path: Path):
        self.manifest_path = manifest_path
        self.manifest: JobManifest = None
        self.execution_records: List[NodeExecutionRecord] = []
        self._load_manifest()

    def _load_manifest(self) -> None:
        """Load existing manifest or create new one."""
        if self.manifest_path.exists():
            with open(self.manifest_path, 'r') as f:
                data = json.load(f)
                self.manifest = JobManifest(**data)
        else:
            self.manifest = JobManifest(
                job_id="",
                status="pending",
                nodes=[],
                input_files=[],
                output_files=[],
                created_at=datetime.now().isoformat(),
                completed_at=None,
                node_versions={},
                environment={},
                replay_data={}
            )

    def initialize_job(
        self,
        job_id: str,
        nodes: List[Dict[str, Any]],
        input_files: List[str],
        node_versions: Dict[str, str],
        environment: Dict[str, str]
    ) -> None:
        """Initialize the manifest for a new job."""
        self.manifest.job_id = job_id
        self.manifest.nodes = nodes
        self.manifest.input_files = input_files
        self.manifest.node_versions = node_versions
        self.manifest.environment = environment
        self.manifest.created_at = datetime.now().isoformat()
        self.manifest.status = "running"

        self._save_manifest()

    def add_execution_record(self, record: NodeExecutionRecord) -> None:
        """Add a node execution record to the manifest."""
        self.execution_records.append(record)
        self._update_job_status()

    def get_execution_record(self, node_id: str) -> Optional[NodeExecutionRecord]:
        """Get execution record for a specific node."""
        for record in self.execution_records:
            if record.node_id == node_id:
                return record
        return None

    def add_artifact(self, node_id: str, artifact: ReplayArtifact) -> None:
        """Add an artifact to a node's execution record."""
        record = self.get_execution_record(node_id)
        if record:
            record.artifacts.append(artifact)

    def _update_job_status(self) -> None:
        """Update overall job status based on node executions."""
        if not self.execution_records:
            return

        # Check if any nodes failed
        failed_nodes = [r for r in self.execution_records if r.status == NodeStatus.FAILED]
        if failed_nodes:
            self.manifest.status = "failed"
        else:
            # Check if all nodes completed
            completed_nodes = [r for r in self.execution_records if r.status == NodeStatus.COMPLETED]
            if len(completed_nodes) == len(self.manifest.nodes):
                self.manifest.status = "completed"
                self.manifest.completed_at = datetime.now().isoformat()
            else:
                self.manifest.status = "running"

        self._save_manifest()

    def _save_manifest(self) -> None:
        """Save the manifest to disk."""
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)

        with open(self.manifest_path, 'w') as f:
            json.dump(self.manifest.model_dump(), f, indent=2, default=str)

    def get_replay_data(self) -> Dict[str, Any]:
        """Get data needed for job replay."""
        return {
            "manifest": self.manifest.model_dump(),
            "execution_records": [asdict(record) for record in self.execution_records],
            "replay_instructions": self._generate_replay_instructions()
        }

    def _generate_replay_instructions(self) -> str:
        """Generate instructions for replaying the job."""
        instructions = f"""
# Replay Instructions for Job {self.manifest.job_id}

## Environment Setup
{chr(10).join(f"export {k}={v}" for k, v in self.manifest.environment.items())}

## Node Versions
{chr(10).join(f"- {node_type}: {version}" for node_type, version in self.manifest.node_versions.items())}

## Execution Order
"""
        # Add execution order based on dependencies
        executed_nodes = {record.node_id: record for record in self.execution_records}
        for node in self.manifest.nodes:
            if node["id"] in executed_nodes:
                record = executed_nodes[node["id"]]
                instructions += f"- {node['id']} ({node['type']}): {record.status.value} in {record.execution_time:.2f}s{chr(10)}"

        return instructions

    def validate_replay_environment(self) -> List[str]:
        """Validate that the current environment matches the replay requirements."""
        issues = []

        # Check node versions
        for node_type, required_version in self.manifest.node_versions.items():
            # This would check against installed versions
            # For now, just log the requirement
            issues.append(f"Node {node_type} requires version {required_version}")

        # Check environment variables
        for key, required_value in self.manifest.environment.items():
            # This would check current environment
            # For now, just log the requirement
            issues.append(f"Environment variable {key} should be set to {required_value}")

        return issues

    def export_for_debug(self, output_path: Path) -> None:
        """Export manifest and records for debugging purposes."""
        debug_data = {
            "manifest": self.manifest.model_dump(),
            "execution_records": [asdict(record) for record in self.execution_records],
            "exported_at": datetime.now().isoformat(),
            "validation_issues": self.validate_replay_environment()
        }

        with open(output_path, 'w') as f:
            json.dump(debug_data, f, indent=2, default=str)
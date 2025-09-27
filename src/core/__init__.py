"""
Core module for the Automated AI Video Editor.
Contains node system, schemas, and replay functionality.
"""

from .nodes.base import BaseNode, NodeRegistry, NodeExecutionContext
from .schemas.base import (
    NodeType,
    NodeStatus,
    BaseNodeInput,
    BaseNodeOutput,
    NodeContract,
    JobManifest
)
from .replay.manifest import ReplayManifest, NodeExecutionRecord, ReplayArtifact

__all__ = [
    "BaseNode",
    "NodeRegistry",
    "NodeExecutionContext",
    "NodeType",
    "NodeStatus",
    "BaseNodeInput",
    "BaseNodeOutput",
    "NodeContract",
    "JobManifest",
    "ReplayManifest",
    "NodeExecutionRecord",
    "ReplayArtifact"
]
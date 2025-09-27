"""
Base schema definitions for the node system.
Defines common interfaces and contracts for all processing nodes.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from enum import Enum
from pathlib import Path


class NodeType(str, Enum):
    """Types of processing nodes in the system."""
    STT = "stt"
    SHOT_DETECT = "shot_detect"
    VISION = "vision"
    DIRECTOR = "director"
    ASSEMBLY = "assembly"
    EXPORT = "export"


class NodeStatus(str, Enum):
    """Status of a node execution."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class NodeState(str, Enum):
    """Internal state of a node for state management."""
    IDLE = "idle"
    INITIALIZING = "initializing"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"


class BaseNodeInput(BaseModel):
    """Base input schema for all nodes."""
    job_id: str = Field(..., description="Unique job identifier")
    node_id: str = Field(..., description="Unique node instance identifier")
    input_data: Dict[str, Any] = Field(..., description="Input data for the node")
    config: Dict[str, Any] = Field(default_factory=dict, description="Node-specific configuration")
    dependencies: List[str] = Field(default_factory=list, description="List of node IDs this node depends on")


class BaseNodeOutput(BaseModel):
    """Base output schema for all nodes."""
    job_id: str = Field(..., description="Unique job identifier")
    node_id: str = Field(..., description="Unique node instance identifier")
    status: NodeStatus = Field(..., description="Execution status")
    output_data: Dict[str, Any] = Field(..., description="Output data from the node")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    error_message: Optional[str] = Field(None, description="Error message if execution failed")
    execution_time: float = Field(..., description="Execution time in seconds")
    timestamp: str = Field(..., description="ISO timestamp of completion")


class NodeContract(BaseModel):
    """Contract definition for a processing node."""
    name: str = Field(..., description="Node name")
    version: str = Field(..., description="Node version")
    node_type: NodeType = Field(..., description="Type of the node")
    description: str = Field(..., description="Human-readable description")
    input_schema: Dict[str, Any] = Field(..., description="JSON schema for input validation")
    output_schema: Dict[str, Any] = Field(..., description="JSON schema for output validation")
    config_schema: Dict[str, Any] = Field(..., description="JSON schema for configuration")
    dependencies: List[str] = Field(default_factory=list, description="Required dependencies")
    timeout: int = Field(300, description="Default timeout in seconds")
    retry_count: int = Field(3, description="Default retry count")
    memory_mb: int = Field(512, description="Expected memory usage in MB")
    tags: List[str] = Field(default_factory=list, description="Tags for categorization")


class JobManifest(BaseModel):
    """Manifest for job replay and debugging."""
    job_id: str = Field(..., description="Unique job identifier")
    status: str = Field(..., description="Overall job status")
    nodes: List[Dict[str, Any]] = Field(..., description="List of node configurations")
    input_files: List[str] = Field(..., description="Input file paths")
    output_files: List[str] = Field(..., description="Output file paths")
    created_at: str = Field(..., description="Job creation timestamp")
    completed_at: Optional[str] = Field(None, description="Job completion timestamp")
    node_versions: Dict[str, str] = Field(..., description="Node versions used")
    environment: Dict[str, str] = Field(..., description="Environment variables")
    replay_data: Dict[str, Any] = Field(default_factory=dict, description="Data for replay")
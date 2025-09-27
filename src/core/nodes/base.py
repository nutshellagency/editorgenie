"""
Base node implementation for the processing pipeline.
All nodes must inherit from this class to ensure contract compliance.
"""

import asyncio
import logging
import time
import uuid
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime

from ..schemas.base import (
    BaseNodeInput,
    BaseNodeOutput,
    NodeContract,
    NodeStatus,
    NodeState,
    JobManifest
)


@dataclass
class NodeExecutionContext:
    """Context for node execution."""
    job_id: str
    node_id: str
    base_dir: Path
    config: Dict[str, Any]
    logger: logging.Logger
    manifest: JobManifest


class BaseNode(ABC):
    """
    Abstract base class for all processing nodes.

    All nodes must implement the process method and define their contract.
    """

    def __init__(self, contract: NodeContract, context: NodeExecutionContext):
        self.contract = contract
        self.context = context
        self.logger = context.logger
        self._validate_contract()

        # State management
        self._state = NodeState.IDLE
        self._state_history: List[Dict[str, Any]] = []
        self._retry_count = 0
        self._max_retries = contract.retry_count or 3
        self._last_error: Optional[str] = None
        self._state_file: Optional[Path] = None
        self._initialize_state_file()

        # Load previous state if available
        self._load_state()

    @property
    @abstractmethod
    def node_type(self) -> str:
        """Return the node type."""
        pass

    @abstractmethod
    async def process(self, input_data: BaseNodeInput) -> BaseNodeOutput:
        """
        Process the input data and return the output.

        Args:
            input_data: The input data for this node

        Returns:
            BaseNodeOutput containing the results
        """
        pass

    def _validate_contract(self) -> None:
        """Validate that the node contract is properly defined."""
        if not self.contract.name:
            raise ValueError("Node contract must have a name")
        if not self.contract.version:
            raise ValueError("Node contract must have a version")
        if not self.contract.description:
            raise ValueError("Node contract must have a description")

    def _validate_input(self, input_data: BaseNodeInput) -> None:
        """Validate input data against the contract."""
        # Basic validation - can be extended with JSON schema validation
        if input_data.job_id != self.context.job_id:
            raise ValueError("Input job_id does not match context job_id")
        if input_data.node_id != self.context.node_id:
            raise ValueError("Input node_id does not match context node_id")

    def _create_output(
        self,
        status: NodeStatus,
        output_data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ) -> BaseNodeOutput:
        """Create a standardized output object."""
        return BaseNodeOutput(
            job_id=self.context.job_id,
            node_id=self.context.node_id,
            status=status,
            output_data=output_data,
            metadata=metadata or {},
            error_message=error_message,
            execution_time=0.0,  # Will be set by caller
            timestamp=datetime.now().isoformat()
        )

    async def execute(self, input_data: BaseNodeInput) -> BaseNodeOutput:
        """
        Execute the node with proper error handling, timing, and state management.

        Args:
            input_data: The input data for this node

        Returns:
            BaseNodeOutput containing the results
        """
        start_time = time.time()
        self.logger.info(f"Starting execution of node {self.context.node_id}")

        # Load previous state if available
        self._load_state()

        # Check if we can execute based on current state
        if self._state in [NodeState.COMPLETED, NodeState.CANCELLED]:
            self.logger.warning(f"Node {self.context.node_id} is in terminal state {self._state.value}")
            return self._create_error_output("Node is in terminal state", start_time)

        if self._state == NodeState.RUNNING:
            self.logger.warning(f"Node {self.context.node_id} is already running")
            return self._create_error_output("Node is already running", start_time)

        # Transition to running state
        if not self._transition_state(NodeState.RUNNING):
            return self._create_error_output("Failed to transition to running state", start_time)

        try:
            self._validate_input(input_data)

            # Execute the node-specific logic
            result = await self.process(input_data)

            # Calculate execution time and create new result with updated time
            execution_time = time.time() - start_time
            result = BaseNodeOutput(
                job_id=result.job_id,
                node_id=result.node_id,
                status=result.status,
                output_data=result.output_data,
                metadata=result.metadata,
                error_message=result.error_message,
                execution_time=execution_time,
                timestamp=result.timestamp
            )

            # Transition to completed state
            self._transition_state(NodeState.COMPLETED)

            self.logger.info(
                f"Node {self.context.node_id} completed successfully in {execution_time:.2f}s"
            )

            # Update manifest
            self._update_manifest(result)

            return result

        except Exception as e:
            execution_time = time.time() - start_time
            error_message = f"Node execution failed: {str(e)}"

            self.logger.error(error_message, exc_info=True)

            # Transition to failed state
            self._transition_state(NodeState.FAILED, error_message)

            # Create error output with execution time
            error_output = BaseNodeOutput(
                job_id=self.context.job_id,
                node_id=self.context.node_id,
                status=NodeStatus.FAILED,
                output_data={},
                metadata={"retry_count": self._retry_count},
                error_message=error_message,
                execution_time=execution_time,
                timestamp=datetime.now().isoformat()
            )

            # Update manifest with failure
            self._update_manifest(error_output)

            return error_output

    def _create_error_output(self, error_message: str, start_time: float) -> BaseNodeOutput:
        """Create an error output for state-related issues."""
        execution_time = time.time() - start_time
        return BaseNodeOutput(
            job_id=self.context.job_id,
            node_id=self.context.node_id,
            status=NodeStatus.FAILED,
            output_data={},
            metadata={"state": self._state.value},
            error_message=error_message,
            execution_time=execution_time,
            timestamp=datetime.now().isoformat()
        )

    def _update_manifest(self, output: BaseNodeOutput) -> None:
        """Update the job manifest with node execution results."""
        # This would typically update a persistent manifest store
        # For now, we'll just log the update
        self.logger.debug(f"Updating manifest for node {self.context.node_id}")

    def get_node_info(self) -> Dict[str, Any]:
        """Get information about this node."""
        return {
            "name": self.contract.name,
            "version": self.contract.version,
            "node_type": self.contract.node_type,
            "description": self.contract.description,
            "timeout": self.contract.timeout,
            "memory_mb": self.contract.memory_mb,
            "tags": self.contract.tags
        }

    # State management methods
    def _initialize_state_file(self) -> None:
        """Initialize the state persistence file."""
        state_dir = self.context.base_dir / "node_states"
        state_dir.mkdir(parents=True, exist_ok=True)
        self._state_file = state_dir / f"{self.context.node_id}_state.json"

    def _save_state(self) -> None:
        """Save current state to persistent storage."""
        if not self._state_file:
            return

        state_data = {
            "node_id": self.context.node_id,
            "job_id": self.context.job_id,
            "state": self._state.value,
            "retry_count": self._retry_count,
            "last_error": self._last_error,
            "timestamp": datetime.now().isoformat(),
            "state_history": self._state_history[-10:]  # Keep last 10 states
        }

        try:
            import json
            with open(self._state_file, 'w') as f:
                json.dump(state_data, f, indent=2)
        except Exception as e:
            self.logger.warning(f"Failed to save state: {e}")

    def _load_state(self) -> None:
        """Load state from persistent storage."""
        if not self._state_file or not self._state_file.exists():
            return

        try:
            import json
            with open(self._state_file, 'r') as f:
                state_data = json.load(f)

            self._state = NodeState(state_data.get("state", NodeState.IDLE.value))
            self._retry_count = state_data.get("retry_count", 0)
            self._last_error = state_data.get("last_error")
            self._state_history = state_data.get("state_history", [])
        except Exception as e:
            self.logger.warning(f"Failed to load state: {e}")

    def _transition_state(self, new_state: NodeState, error_message: Optional[str] = None) -> bool:
        """Transition to a new state with validation."""
        # Validate state transition
        valid_transitions = {
            NodeState.IDLE: [NodeState.INITIALIZING, NodeState.RUNNING],
            NodeState.INITIALIZING: [NodeState.RUNNING, NodeState.FAILED],
            NodeState.RUNNING: [NodeState.PAUSED, NodeState.COMPLETED, NodeState.FAILED, NodeState.RETRYING, NodeState.CANCELLED],
            NodeState.PAUSED: [NodeState.RUNNING, NodeState.CANCELLED],
            NodeState.RETRYING: [NodeState.RUNNING, NodeState.FAILED],
            NodeState.FAILED: [NodeState.RETRYING, NodeState.CANCELLED],
            NodeState.COMPLETED: [NodeState.CANCELLED],  # Allow cancellation of completed nodes
            NodeState.CANCELLED: []  # Terminal state
        }

        if new_state not in valid_transitions.get(self._state, []):
            self.logger.warning(f"Invalid state transition from {self._state.value} to {new_state.value}")
            return False

        old_state = self._state
        self._state = new_state

        if error_message:
            self._last_error = error_message

        # Record state transition
        transition_record = {
            "from_state": old_state.value,
            "to_state": new_state.value,
            "timestamp": datetime.now().isoformat(),
            "error_message": error_message
        }
        self._state_history.append(transition_record)

        self.logger.info(f"Node {self.context.node_id} transitioned from {old_state.value} to {new_state.value}")
        self._save_state()
        return True

    def get_state(self) -> NodeState:
        """Get current node state."""
        return self._state

    def get_state_history(self) -> List[Dict[str, Any]]:
        """Get state transition history."""
        return self._state_history.copy()

    def can_retry(self) -> bool:
        """Check if the node can be retried."""
        return self._retry_count < self._max_retries and self._state in [NodeState.FAILED, NodeState.RETRYING]

    def pause(self) -> bool:
        """Pause the node execution."""
        return self._transition_state(NodeState.PAUSED)

    def resume(self) -> bool:
        """Resume the node execution."""
        if self._state == NodeState.PAUSED:
            return self._transition_state(NodeState.RUNNING)
        return False

    def cancel(self) -> bool:
        """Cancel the node execution."""
        return self._transition_state(NodeState.CANCELLED)

    def reset(self) -> bool:
        """Reset the node to initial state."""
        self._retry_count = 0
        self._last_error = None
        self._state_history.clear()

        # Reset directly without validation since reset should work from any state
        old_state = self._state
        self._state = NodeState.IDLE

        # Record state transition
        transition_record = {
            "from_state": old_state.value,
            "to_state": NodeState.IDLE.value,
            "timestamp": datetime.now().isoformat(),
            "error_message": "Node reset"
        }
        self._state_history.append(transition_record)

        self.logger.info(f"Node {self.context.node_id} reset from {old_state.value} to {NodeState.IDLE.value}")
        self._save_state()
        return True

    def retry(self) -> bool:
        """Retry the node execution."""
        if not self.can_retry():
            return False

        self._retry_count += 1
        return self._transition_state(NodeState.RETRYING)


class NodeFactory:
    """Factory for creating and managing node instances."""

    def __init__(self):
        self._nodes: Dict[str, type] = {}
        self._contracts: Dict[str, NodeContract] = {}

    def register(self, node_class: type, contract: NodeContract) -> None:
        """
        Register a node class with its contract.

        Args:
            node_class: The node class to register
            contract: The contract for the node
        """
        node_type = contract.node_type.value
        self._nodes[node_type] = node_class
        self._contracts[node_type] = contract
        logging.getLogger(__name__).info(f"Registered node type: {node_type}")

    def get_node_class(self, node_type: str) -> Optional[type]:
        """Get a node class by type."""
        return self._nodes.get(node_type)

    def get_contract(self, node_type: str) -> Optional[NodeContract]:
        """Get a node contract by type."""
        return self._contracts.get(node_type)

    def list_nodes(self) -> List[Dict[str, Any]]:
        """List all registered nodes."""
        return [
            {
                "type": node_type,
                "contract": contract.model_dump()
            }
            for node_type, contract in self._contracts.items()
        ]

    def create_node(
        self,
        node_type: str,
        node_id: str,
        context: NodeExecutionContext,
        config: Optional[Dict[str, Any]] = None
    ) -> BaseNode:
        """
        Create a node instance dynamically.

        Args:
            node_type: Type of node to create
            node_id: Unique identifier for this node instance
            context: Execution context for the node
            config: Optional node-specific configuration

        Returns:
            BaseNode instance

        Raises:
            ValueError: If node type is not registered
        """
        node_class = self.get_node_class(node_type)
        if not node_class:
            raise ValueError(f"Node type '{node_type}' is not registered")

        contract = self.get_contract(node_type)
        if not contract:
            raise ValueError(f"No contract found for node type '{node_type}'")

        # Create a context-specific contract with the node_id
        node_contract = NodeContract(
            name=contract.name,
            version=contract.version,
            node_type=contract.node_type,
            description=contract.description,
            input_schema=contract.input_schema,
            output_schema=contract.output_schema,
            config_schema=contract.config_schema,
            dependencies=contract.dependencies,
            timeout=contract.timeout,
            retry_count=contract.retry_count,
            memory_mb=contract.memory_mb,
            tags=contract.tags
        )

        # Merge config if provided
        if config:
            node_contract.config_schema.update(config)

        return node_class(node_contract, context)

    def create_node_from_manifest(
        self,
        node_config: Dict[str, Any],
        context: NodeExecutionContext
    ) -> BaseNode:
        """
        Create a node from manifest configuration.

        Args:
            node_config: Node configuration from manifest
            context: Execution context for the node

        Returns:
            BaseNode instance
        """
        node_type = node_config.get("type")
        node_id = node_config.get("id", str(uuid.uuid4()))
        config = node_config.get("config", {})

        return self.create_node(node_type, node_id, context, config)

    def validate_node_config(self, node_type: str, config: Dict[str, Any]) -> bool:
        """
        Validate node configuration against its schema.

        Args:
            node_type: Type of node to validate
            config: Configuration to validate

        Returns:
            True if valid, False otherwise
        """
        contract = self.get_contract(node_type)
        if not contract:
            return False

        # Basic validation - in a real implementation, this would use
        # JSON Schema validation against contract.config_schema
        return isinstance(config, dict)


class DependencyContainer:
    """Dependency injection container for managing services and configurations."""

    def __init__(self):
        self._services: Dict[str, Any] = {}
        self._singletons: Dict[str, Any] = {}
        self._factories: Dict[str, callable] = {}

    def register_service(self, name: str, service: Any) -> None:
        """Register a service instance."""
        self._services[name] = service
        logging.getLogger(__name__).debug(f"Registered service: {name}")

    def register_singleton(self, name: str, service: Any) -> None:
        """Register a singleton service."""
        self._singletons[name] = service
        logging.getLogger(__name__).debug(f"Registered singleton: {name}")

    def register_factory(self, name: str, factory_func: callable) -> None:
        """Register a factory function."""
        self._factories[name] = factory_func
        logging.getLogger(__name__).debug(f"Registered factory: {name}")

    def get_service(self, name: str) -> Any:
        """Get a service by name."""
        if name in self._services:
            return self._services[name]
        elif name in self._singletons:
            return self._singletons[name]
        elif name in self._factories:
            return self._factories[name]()
        else:
            raise ValueError(f"Service '{name}' not found in container")

    def has_service(self, name: str) -> bool:
        """Check if a service is registered."""
        return name in self._services or name in self._singletons or name in self._factories

    def list_services(self) -> List[str]:
        """List all registered service names."""
        services = list(self._services.keys())
        services.extend(self._singletons.keys())
        services.extend(self._factories.keys())
        return services

    def clear_services(self) -> None:
        """Clear all registered services."""
        self._services.clear()
        self._singletons.clear()
        self._factories.clear()
        logging.getLogger(__name__).debug("Cleared all services from container")


class NodeRegistry:
    """Enhanced registry for managing node types, instances, and dependencies."""

    def __init__(self):
        self._nodes: Dict[str, type] = {}
        self._contracts: Dict[str, NodeContract] = {}
        self._container = DependencyContainer()
        self._node_dependencies: Dict[str, List[str]] = {}

    def register(self, node_class: type, contract: NodeContract, dependencies: Optional[List[str]] = None) -> None:
        """
        Register a node class with its contract and dependencies.

        Args:
            node_class: The node class to register
            contract: The contract for the node
            dependencies: List of service dependencies
        """
        node_type = contract.node_type.value
        self._nodes[node_type] = node_class
        self._contracts[node_type] = contract
        self._node_dependencies[node_type] = dependencies or []
        logging.getLogger(__name__).info(f"Registered node type: {node_type}")

    def get_node_class(self, node_type: str) -> Optional[type]:
        """Get a node class by type."""
        return self._nodes.get(node_type)

    def get_contract(self, node_type: str) -> Optional[NodeContract]:
        """Get a node contract by type."""
        return self._contracts.get(node_type)

    def get_dependencies(self, node_type: str) -> List[str]:
        """Get dependencies for a node type."""
        return self._node_dependencies.get(node_type, [])

    def list_nodes(self) -> List[Dict[str, Any]]:
        """List all registered nodes with their dependencies."""
        return [
            {
                "type": node_type,
                "contract": contract.model_dump(),
                "dependencies": self._node_dependencies.get(node_type, [])
            }
            for node_type, contract in self._contracts.items()
        ]

    def create_node(
        self,
        node_type: str,
        node_id: str,
        context: NodeExecutionContext,
        config: Optional[Dict[str, Any]] = None
    ) -> BaseNode:
        """
        Create a node instance with dependency injection.

        Args:
            node_type: Type of node to create
            node_id: Unique identifier for this node instance
            context: Execution context for the node
            config: Optional node-specific configuration

        Returns:
            BaseNode instance

        Raises:
            ValueError: If node type is not registered or dependencies are missing
        """
        node_class = self.get_node_class(node_type)
        if not node_class:
            raise ValueError(f"Node type '{node_type}' is not registered")

        contract = self.get_contract(node_type)
        if not contract:
            raise ValueError(f"No contract found for node type '{node_type}'")

        # Check dependencies
        dependencies = self.get_dependencies(node_type)
        for dep in dependencies:
            if not self._container.has_service(dep):
                raise ValueError(f"Dependency '{dep}' not found for node type '{node_type}'")

        # Create a context-specific contract with the node_id
        node_contract = NodeContract(
            name=contract.name,
            version=contract.version,
            node_type=contract.node_type,
            description=contract.description,
            input_schema=contract.input_schema,
            output_schema=contract.output_schema,
            config_schema=contract.config_schema,
            dependencies=contract.dependencies,
            timeout=contract.timeout,
            retry_count=contract.retry_count,
            memory_mb=contract.memory_mb,
            tags=contract.tags
        )

        # Merge config if provided
        if config:
            node_contract.config_schema.update(config)

        return node_class(node_contract, context)

    def create_node_from_manifest(
        self,
        node_config: Dict[str, Any],
        context: NodeExecutionContext
    ) -> BaseNode:
        """
        Create a node from manifest configuration with dependency injection.

        Args:
            node_config: Node configuration from manifest
            context: Execution context for the node

        Returns:
            BaseNode instance
        """
        node_type = node_config.get("type")
        node_id = node_config.get("id", str(uuid.uuid4()))
        config = node_config.get("config", {})

        return self.create_node(node_type, node_id, context, config)

    def validate_node_config(self, node_type: str, config: Dict[str, Any]) -> bool:
        """
        Validate node configuration against its schema.

        Args:
            node_type: Type of node to validate
            config: Configuration to validate

        Returns:
            True if valid, False otherwise
        """
        contract = self.get_contract(node_type)
        if not contract:
            return False

        # Basic validation - in a real implementation, this would use
        # JSON Schema validation against contract.config_schema
        return isinstance(config, dict)

    # Dependency injection methods
    def register_service(self, name: str, service: Any) -> None:
        """Register a service in the dependency container."""
        self._container.register_service(name, service)

    def register_singleton(self, name: str, service: Any) -> None:
        """Register a singleton service."""
        self._container.register_singleton(name, service)

    def register_factory(self, name: str, factory_func: callable) -> None:
        """Register a factory function."""
        self._container.register_factory(name, factory_func)

    def get_service(self, name: str) -> Any:
        """Get a service from the dependency container."""
        return self._container.get_service(name)

    def initialize_default_services(self) -> None:
        """Initialize commonly used services."""
        # Register default logger
        logger = logging.getLogger("node_system")
        self.register_singleton("logger", logger)

        # Register default configuration
        default_config = {
            "ffmpeg_path": "ffmpeg",
            "temp_directory": "/tmp",
            "max_concurrent_jobs": 5,
            "default_timeout": 300
        }
        self.register_singleton("config", default_config)

    def has_service(self, name: str) -> bool:
        """Check if a service is registered."""
        return self._container.has_service(name)

    def check_dependencies(self, dependencies: List[str]) -> bool:
        """Check if all dependencies are available."""
        return all(self._container.has_service(dep) for dep in dependencies)

    def list_services(self) -> List[str]:
        """List all registered service names."""
        return self._container.list_services()

    def clear_services(self) -> None:
        """Clear all registered services."""
        self._container.clear_services()
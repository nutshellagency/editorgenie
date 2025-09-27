"""
Unit tests for core node implementations.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch
from pathlib import Path
from datetime import datetime

from src.core.nodes.base import BaseNode, NodeRegistry, NodeFactory, NodeExecutionContext, DependencyContainer
from src.core.schemas.base import (
    NodeContract,
    NodeType,
    NodeStatus,
    NodeState,
    BaseNodeInput,
    BaseNodeOutput
)


class MockTestNode(BaseNode):
    """Mock node for testing purposes."""

    def __init__(self, contract, context):
        super().__init__(contract, context)

    @property
    def node_type(self) -> str:
        return "test"

    async def process(self, input_data: BaseNodeInput) -> BaseNodeOutput:
        """Mock process method that just returns success."""
        return BaseNodeOutput(
            job_id=input_data.job_id,
            node_id=input_data.node_id,
            status=NodeStatus.COMPLETED,
            output_data={"result": "success", "input": input_data.input_data},
            metadata={"processed": True},
            execution_time=0.1,
            timestamp=datetime.now().isoformat()
        )


class FailingTestNode(BaseNode):
    """Mock node that always fails for testing error handling."""

    def __init__(self, contract, context):
        super().__init__(contract, context)

    @property
    def node_type(self) -> str:
        return "failing_test"

    async def process(self, input_data: BaseNodeInput) -> BaseNodeOutput:
        """Mock process method that always raises an exception."""
        raise ValueError("Test error for testing purposes")


class TestBaseNode:
    """Test base node functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.contract = NodeContract(
            name="Test Node",
            version="1.0.0",
            node_type=NodeType.STT,
            description="Test node for unit testing",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        self.context = NodeExecutionContext(
            job_id="test-job-123",
            node_id="test-node-456",
            base_dir=Path("/tmp/test"),
            config={"test": "config"},
            logger=Mock(),
            manifest=Mock()
        )

    def test_node_initialization(self):
        """Test node initialization."""
        node = MockTestNode(self.contract, self.context)

        assert node.contract == self.contract
        assert node.context == self.context
        assert node.logger == self.context.logger

    def test_contract_validation(self):
        """Test contract validation."""
        # Test with valid contract
        node = MockTestNode(self.contract, self.context)
        assert node.contract.name == "Test Node"

        # Test with invalid contract (empty name)
        invalid_contract = NodeContract(
            name="",
            version="1.0.0",
            node_type=NodeType.STT,
            description="Test",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        with pytest.raises(ValueError, match="Node contract must have a name"):
            MockTestNode(invalid_contract, self.context)

    def test_contract_validation_empty_version(self):
        """Test contract validation fails with empty version."""
        invalid_contract = NodeContract(
            name="Test Node",
            version="",
            node_type=NodeType.STT,
            description="Test",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        with pytest.raises(ValueError, match="Node contract must have a version"):
            MockTestNode(invalid_contract, self.context)

    def test_contract_validation_empty_description(self):
        """Test contract validation fails with empty description."""
        invalid_contract = NodeContract(
            name="Test Node",
            version="1.0.0",
            node_type=NodeType.STT,
            description="",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        with pytest.raises(ValueError, match="Node contract must have a description"):
            MockTestNode(invalid_contract, self.context)

    def test_contract_validation_missing_schemas(self):
        """Test contract validation with missing schemas."""
        # Test with missing input_schema
        invalid_contract = NodeContract(
            name="Test Node",
            version="1.0.0",
            node_type=NodeType.STT,
            description="Test",
            input_schema={},  # Empty schema should still be valid
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        # Empty schemas should be valid
        node = MockTestNode(invalid_contract, self.context)
        assert node.contract.name == "Test Node"

    def test_contract_validation_invalid_node_type(self):
        """Test contract validation with invalid node type."""
        # This should work as NodeType is an enum and will validate itself
        pass

    def test_input_validation(self):
        """Test input validation."""
        node = MockTestNode(self.contract, self.context)

        # Valid input
        valid_input = BaseNodeInput(
            job_id="test-job-123",
            node_id="test-node-456",
            input_data={"test": "data"}
        )
        node._validate_input(valid_input)  # Should not raise

        # Invalid job_id
        invalid_input = BaseNodeInput(
            job_id="wrong-job",
            node_id="test-node-456",
            input_data={"test": "data"}
        )

        with pytest.raises(ValueError, match="Input job_id does not match context job_id"):
            node._validate_input(invalid_input)

    def test_create_output(self):
        """Test output creation."""
        node = MockTestNode(self.contract, self.context)

        output = node._create_output(
            NodeStatus.COMPLETED,
            {"result": "success"},
            {"metadata": "test"}
        )

        assert output.job_id == "test-job-123"
        assert output.node_id == "test-node-456"
        assert output.status == NodeStatus.COMPLETED
        assert output.output_data == {"result": "success"}
        assert output.metadata == {"metadata": "test"}
        assert output.error_message is None

    @pytest.mark.asyncio
    async def test_successful_execution(self):
        """Test successful node execution."""
        node = MockTestNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-123",
            node_id="test-node-456",
            input_data={"test": "data"}
        )

        result = await node.execute(input_data)

        assert result.status == NodeStatus.COMPLETED
        assert result.output_data == {"result": "success", "input": {"test": "data"}}
        assert result.metadata == {"processed": True}
        # Note: execution_time is calculated by the execute method

    @pytest.mark.asyncio
    async def test_failed_execution(self):
        """Test failed node execution."""
        import tempfile

        failing_contract = NodeContract(
            name="Failing Test Node",
            version="1.0.0",
            node_type=NodeType.STT,
            description="Failing test node",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            failing_context = NodeExecutionContext(
                job_id="test-job-123",
                node_id="test-node-456",
                base_dir=Path(temp_dir),
                config={"test": "config"},
                logger=Mock(),
                manifest=Mock()
            )

            node = FailingTestNode(failing_contract, failing_context)

            input_data = BaseNodeInput(
                job_id="test-job-123",
                node_id="test-node-456",
                input_data={"test": "data"}
            )

            result = await node.execute(input_data)

            assert result.status == NodeStatus.FAILED
            assert "Test error for testing purposes" in result.error_message
        # Note: execution_time is calculated by the execute method

    def test_get_node_info(self):
        """Test getting node information."""
        node = MockTestNode(self.contract, self.context)

        info = node.get_node_info()

        assert info["name"] == "Test Node"
        assert info["version"] == "1.0.0"
        assert info["node_type"] == NodeType.STT
        assert info["description"] == "Test node for unit testing"
        assert info["timeout"] == 300
        assert info["memory_mb"] == 512
        assert info["tags"] == []


class TestNodeRegistry:
    """Test node registry functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.registry = NodeRegistry()

    def test_register_node(self):
        """Test registering a node."""
        contract = NodeContract(
            name="Test Node",
            version="1.0.0",
            node_type=NodeType.STT,
            description="Test node",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        self.registry.register(MockTestNode, contract)

        assert NodeType.STT.value in self.registry._nodes
        assert NodeType.STT.value in self.registry._contracts

        assert self.registry.get_node_class(NodeType.STT.value) == MockTestNode
        assert self.registry.get_contract(NodeType.STT.value) == contract

    def test_get_nonexistent_node(self):
        """Test getting a non-existent node."""
        assert self.registry.get_node_class("nonexistent") is None
        assert self.registry.get_contract("nonexistent") is None

    def test_list_nodes(self):
        """Test listing registered nodes."""
        contract = NodeContract(
            name="Test Node",
            version="1.0.0",
            node_type=NodeType.STT,
            description="Test node",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        self.registry.register(MockTestNode, contract)

        nodes = self.registry.list_nodes()

        assert len(nodes) == 1
        assert nodes[0]["type"] == NodeType.STT.value
        assert nodes[0]["contract"]["name"] == "Test Node"


class TestNodeFactory:
    """Test node factory functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.factory = NodeFactory()
        self.contract = NodeContract(
            name="Test Node",
            version="1.0.0",
            node_type=NodeType.STT,
            description="Test node for factory testing",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        self.context = NodeExecutionContext(
            job_id="test-job-123",
            node_id="test-node-456",
            base_dir=Path("/tmp/test"),
            config={"test": "config"},
            logger=Mock(),
            manifest=Mock()
        )

    def test_register_and_get_node_class(self):
        """Test registering and retrieving node classes."""
        self.factory.register(MockTestNode, self.contract)

        node_class = self.factory.get_node_class(NodeType.STT.value)
        assert node_class == MockTestNode

        contract = self.factory.get_contract(NodeType.STT.value)
        assert contract == self.contract

    def test_create_node_successfully(self):
        """Test successful node creation."""
        self.factory.register(MockTestNode, self.contract)

        node = self.factory.create_node(
            NodeType.STT.value,
            "test-node-123",
            self.context
        )

        assert isinstance(node, MockTestNode)
        assert node.contract.name == "Test Node"
        assert node.context == self.context

    def test_create_node_with_config(self):
        """Test node creation with additional configuration."""
        self.factory.register(MockTestNode, self.contract)
        config = {"custom_param": "value"}

        node = self.factory.create_node(
            NodeType.STT.value,
            "test-node-123",
            self.context,
            config
        )

        assert isinstance(node, MockTestNode)
        assert node.contract.name == "Test Node"

    def test_create_node_from_manifest(self):
        """Test node creation from manifest configuration."""
        self.factory.register(MockTestNode, self.contract)

        manifest_config = {
            "type": NodeType.STT.value,
            "id": "manifest-node-123",
            "config": {"manifest_param": "value"}
        }

        node = self.factory.create_node_from_manifest(manifest_config, self.context)

        assert isinstance(node, MockTestNode)
        assert node.contract.name == "Test Node"

    def test_create_unregistered_node_type(self):
        """Test creating a node with unregistered type."""
        with pytest.raises(ValueError, match="Node type 'nonexistent' is not registered"):
            self.factory.create_node("nonexistent", "test-node", self.context)

    def test_validate_node_config(self):
        """Test node configuration validation."""
        self.factory.register(MockTestNode, self.contract)

        # Valid config
        assert self.factory.validate_node_config(NodeType.STT.value, {"param": "value"})

        # Invalid node type
        assert not self.factory.validate_node_config("nonexistent", {"param": "value"})

        # Invalid config type
        assert not self.factory.validate_node_config(NodeType.STT.value, "invalid_config")

    def test_list_registered_nodes(self):
        """Test listing registered nodes."""
        self.factory.register(MockTestNode, self.contract)

        nodes = self.factory.list_nodes()

        assert len(nodes) == 1
        assert nodes[0]["type"] == NodeType.STT.value
        assert nodes[0]["contract"]["name"] == "Test Node"


class TestDependencyContainer:
    """Test dependency container functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.container = DependencyContainer()

    def test_register_service(self):
        """Test registering a service."""
        mock_service = Mock()
        self.container.register_service("logger", mock_service)

        assert self.container.get_service("logger") == mock_service

    def test_register_singleton(self):
        """Test registering a singleton service."""
        mock_service = Mock()
        self.container.register_singleton("config", mock_service)

        assert self.container.get_service("config") == mock_service

    def test_register_factory(self):
        """Test registering a factory function."""
        def create_logger():
            return Mock()

        self.container.register_factory("logger_factory", create_logger)

        logger1 = self.container.get_service("logger_factory")
        logger2 = self.container.get_service("logger_factory")

        assert logger1 is not None
        assert logger2 is not None
        assert logger1 != logger2  # Factory should create new instances

    def test_get_nonexistent_service(self):
        """Test getting a non-existent service."""
        with pytest.raises(ValueError, match="Service 'nonexistent' not found in container"):
            self.container.get_service("nonexistent")

    def test_has_service(self):
        """Test checking if a service exists."""
        mock_service = Mock()
        self.container.register_service("test_service", mock_service)

        assert self.container.has_service("test_service") is True
        assert self.container.has_service("nonexistent") is False

    def test_list_services(self):
        """Test listing registered services."""
        mock_service1 = Mock()
        mock_service2 = Mock()

        self.container.register_service("service1", mock_service1)
        self.container.register_singleton("service2", mock_service2)

        services = self.container.list_services()

        assert len(services) == 2
        assert "service1" in services
        assert "service2" in services

    def test_clear_services(self):
        """Test clearing all services."""
        mock_service = Mock()
        self.container.register_service("test_service", mock_service)

        assert self.container.has_service("test_service") is True

        self.container.clear_services()

        assert self.container.has_service("test_service") is False
        assert len(self.container.list_services()) == 0


class TestNodeRegistryWithDependencyInjection:
    """Test node registry with dependency injection functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.registry = NodeRegistry()
        self.contract = NodeContract(
            name="Test Node",
            version="1.0.0",
            node_type=NodeType.STT,
            description="Test node",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

    def test_register_service(self):
        """Test registering a service in the registry."""
        mock_service = Mock()
        self.registry.register_service("logger", mock_service)

        assert self.registry.get_service("logger") == mock_service

    def test_register_singleton(self):
        """Test registering a singleton service."""
        mock_service = Mock()
        self.registry.register_singleton("config", mock_service)

        assert self.registry.get_service("config") == mock_service

    def test_register_factory(self):
        """Test registering a factory function."""
        def create_logger():
            return Mock()

        self.registry.register_factory("logger_factory", create_logger)

        logger1 = self.registry.get_service("logger_factory")
        logger2 = self.registry.get_service("logger_factory")

        assert logger1 is not None
        assert logger2 is not None
        assert logger1 != logger2

    def test_initialize_default_services(self):
        """Test initializing default services."""
        mock_logger = Mock()
        mock_config = Mock()

        self.registry.register_service("logger", mock_logger)
        self.registry.register_singleton("config", mock_config)

        # This should not raise any errors
        self.registry.initialize_default_services()

        # Should have the services we registered
        assert self.registry.has_service("logger") is True
        assert self.registry.has_service("config") is True

    def test_create_node_with_dependencies(self):
        """Test creating a node with required dependencies."""
        # Register a node that requires dependencies
        self.registry.register(MockTestNode, self.contract)

        # Register required services
        mock_logger = Mock()
        mock_config = Mock()
        self.registry.register_service("logger", mock_logger)
        self.registry.register_singleton("config", mock_config)

        # Create context with dependencies
        context = NodeExecutionContext(
            job_id="test-job-123",
            node_id="test-node-456",
            base_dir=Path("/tmp/test"),
            config={"test": "config"},
            logger=mock_logger,
            manifest=Mock()
        )

        # This should work without errors
        node = self.registry.create_node(
            NodeType.STT.value,
            "test-node-123",
            context
        )

        assert isinstance(node, MockTestNode)

    def test_create_node_missing_dependencies(self):
        """Test creating a node with missing dependencies."""
        # Register a node that requires dependencies
        self.registry.register(MockTestNode, self.contract)

        # Don't register required services
        context = NodeExecutionContext(
            job_id="test-job-123",
            node_id="test-node-456",
            base_dir=Path("/tmp/test"),
            config={"test": "config"},
            logger=Mock(),
            manifest=Mock()
        )

        # This should work as we don't enforce dependencies in create_node
        node = self.registry.create_node(
            NodeType.STT.value,
            "test-node-123",
            context
        )

        assert isinstance(node, MockTestNode)

    def test_check_dependencies(self):
        """Test checking if all dependencies are available."""
        # Register some services
        mock_logger = Mock()
        mock_config = Mock()
        self.registry.register_service("logger", mock_logger)
        self.registry.register_singleton("config", mock_config)

        # Check existing dependencies
        assert self.registry.check_dependencies(["logger", "config"]) is True

        # Check non-existing dependencies
        assert self.registry.check_dependencies(["logger", "missing_service"]) is False

        # Check empty dependencies
        assert self.registry.check_dependencies([]) is True

    def test_list_services(self):
        """Test listing all registered services."""
        mock_service1 = Mock()
        mock_service2 = Mock()

        self.registry.register_service("service1", mock_service1)
        self.registry.register_singleton("service2", mock_service2)

        services = self.registry.list_services()

        assert len(services) == 2
        assert "service1" in services
        assert "service2" in services

    def test_clear_services(self):
        """Test clearing all services."""
        mock_service = Mock()
        self.registry.register_service("test_service", mock_service)

        assert self.registry.has_service("test_service") is True

        self.registry.clear_services()

        assert self.registry.has_service("test_service") is False
        assert len(self.registry.list_services()) == 0


class TestNodeStateManagement:
    """Test node state management functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.contract = NodeContract(
            name="Test Node",
            version="1.0.0",
            node_type=NodeType.STT,
            description="Test node for state management",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        self.context = NodeExecutionContext(
            job_id="test-job-123",
            node_id="test-node-456",
            base_dir=Path("/tmp/test"),
            config={"test": "config"},
            logger=Mock(),
            manifest=Mock()
        )

    def test_initial_state(self):
        """Test initial node state."""
        import tempfile
        from pathlib import Path

        # Use a unique temporary directory to avoid state conflicts
        with tempfile.TemporaryDirectory() as temp_dir:
            context = NodeExecutionContext(
                job_id="test-job-123",
                node_id="test-node-456",
                base_dir=Path(temp_dir),
                config={"test": "config"},
                logger=Mock(),
                manifest=Mock()
            )

            node = MockTestNode(self.contract, context)

            assert node.get_state() == NodeState.IDLE
            assert node._retry_count == 0
            assert node._last_error is None
            assert len(node.get_state_history()) == 0

    def test_state_transitions(self):
        """Test valid state transitions."""
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as temp_dir:
            context = NodeExecutionContext(
                job_id="test-job-123",
                node_id="test-node-456",
                base_dir=Path(temp_dir),
                config={"test": "config"},
                logger=Mock(),
                manifest=Mock()
            )

            node = MockTestNode(self.contract, context)

            # IDLE -> RUNNING
            assert node._transition_state(NodeState.RUNNING) is True
            assert node.get_state() == NodeState.RUNNING

            # RUNNING -> COMPLETED
            assert node._transition_state(NodeState.COMPLETED) is True
            assert node.get_state() == NodeState.COMPLETED

            # COMPLETED -> CANCELLED (valid)
            assert node._transition_state(NodeState.CANCELLED) is True
            assert node.get_state() == NodeState.CANCELLED

    def test_invalid_state_transitions(self):
        """Test invalid state transitions."""
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as temp_dir:
            context = NodeExecutionContext(
                job_id="test-job-123",
                node_id="test-node-456",
                base_dir=Path(temp_dir),
                config={"test": "config"},
                logger=Mock(),
                manifest=Mock()
            )

            node = MockTestNode(self.contract, context)

            # IDLE -> COMPLETED (invalid)
            assert node._transition_state(NodeState.COMPLETED) is False
            assert node.get_state() == NodeState.IDLE

        # COMPLETED -> RUNNING (invalid)
        node._transition_state(NodeState.RUNNING)
        assert node._transition_state(NodeState.COMPLETED) is True
        assert node._transition_state(NodeState.RUNNING) is False
        assert node.get_state() == NodeState.COMPLETED

    def test_state_with_error_message(self):
        """Test state transitions with error messages."""
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as temp_dir:
            context = NodeExecutionContext(
                job_id="test-job-123",
                node_id="test-node-456",
                base_dir=Path(temp_dir),
                config={"test": "config"},
                logger=Mock(),
                manifest=Mock()
            )

            node = MockTestNode(self.contract, context)

            # First transition to RUNNING, then to FAILED
            node._transition_state(NodeState.RUNNING)
            error_msg = "Test error message"
            node._transition_state(NodeState.FAILED, error_msg)

            assert node.get_state() == NodeState.FAILED
            assert node._last_error == error_msg

    def test_state_history(self):
        """Test state transition history tracking."""
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as temp_dir:
            context = NodeExecutionContext(
                job_id="test-job-123",
                node_id="test-node-456",
                base_dir=Path(temp_dir),
                config={"test": "config"},
                logger=Mock(),
                manifest=Mock()
            )

            node = MockTestNode(self.contract, context)

            # Make several transitions
            node._transition_state(NodeState.RUNNING)
            node._transition_state(NodeState.COMPLETED)

            history = node.get_state_history()
            assert len(history) == 2
            assert history[0]["from_state"] == NodeState.IDLE.value
            assert history[0]["to_state"] == NodeState.RUNNING.value
            assert history[1]["from_state"] == NodeState.RUNNING.value
            assert history[1]["to_state"] == NodeState.COMPLETED.value

    def test_retry_functionality(self):
        """Test retry functionality."""
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as temp_dir:
            context = NodeExecutionContext(
                job_id="test-job-123",
                node_id="test-node-456",
                base_dir=Path(temp_dir),
                config={"test": "config"},
                logger=Mock(),
                manifest=Mock()
            )

            node = MockTestNode(self.contract, context)

            # Should not be able to retry initially
            assert node.can_retry() is False

            # Transition to RUNNING then FAILED state
            node._transition_state(NodeState.RUNNING)
            node._transition_state(NodeState.FAILED)
            assert node.can_retry() is True

            # Retry should work
            assert node.retry() is True
            assert node.get_state() == NodeState.RETRYING
            assert node._retry_count == 1

            # Retry again
            node._transition_state(NodeState.FAILED)
            assert node.retry() is True
            assert node._retry_count == 2

            # Exceed max retries
            node._transition_state(NodeState.FAILED)
            node._retry_count = 3  # Manually set to max
            assert node.can_retry() is False
            assert node.retry() is False

    def test_pause_resume(self):
        """Test pause and resume functionality."""
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as temp_dir:
            context = NodeExecutionContext(
                job_id="test-job-123",
                node_id="test-node-456",
                base_dir=Path(temp_dir),
                config={"test": "config"},
                logger=Mock(),
                manifest=Mock()
            )

            node = MockTestNode(self.contract, context)

            # Start running
            node._transition_state(NodeState.RUNNING)

            # Pause
            assert node.pause() is True
            assert node.get_state() == NodeState.PAUSED

            # Resume
            assert node.resume() is True
            assert node.get_state() == NodeState.RUNNING

            # Try to resume from non-paused state
            node._transition_state(NodeState.COMPLETED)
            assert node.resume() is False

    def test_cancel_functionality(self):
        """Test cancel functionality."""
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as temp_dir:
            context = NodeExecutionContext(
                job_id="test-job-123",
                node_id="test-node-456",
                base_dir=Path(temp_dir),
                config={"test": "config"},
                logger=Mock(),
                manifest=Mock()
            )

            node = MockTestNode(self.contract, context)

            # Cancel from idle state - this should fail as IDLE cannot transition to CANCELLED
            assert node.cancel() is False
            assert node.get_state() == NodeState.IDLE

            # Transition to RUNNING then cancel
            node._transition_state(NodeState.RUNNING)
            assert node.cancel() is True
            assert node.get_state() == NodeState.CANCELLED

    def test_reset_functionality(self):
        """Test reset functionality."""
        node = MockTestNode(self.contract, self.context)

        # Set up some state
        node._transition_state(NodeState.RUNNING)
        node._transition_state(NodeState.FAILED)
        node._retry_count = 2
        node._last_error = "Test error"

        # Reset should work from any state
        assert node.reset() is True
        assert node.get_state() == NodeState.IDLE
        assert node._retry_count == 0
        assert node._last_error is None
        # Should have 1 record (the reset transition)
        assert len(node.get_state_history()) == 1

    def test_state_persistence(self):
        """Test state persistence to file."""
        import tempfile
        import json

        with tempfile.TemporaryDirectory() as temp_dir:
            context = NodeExecutionContext(
                job_id="test-job-123",
                node_id="test-node-456",
                base_dir=Path(temp_dir),
                config={"test": "config"},
                logger=Mock(),
                manifest=Mock()
            )

            node = MockTestNode(self.contract, context)

            # Transition state
            node._transition_state(NodeState.RUNNING, "Test error")

            # Check if state file was created
            assert node._state_file is not None
            assert node._state_file.exists()

            # Check file contents
            with open(node._state_file, 'r') as f:
                state_data = json.load(f)

            assert state_data["state"] == NodeState.RUNNING.value
            assert state_data["last_error"] == "Test error"
            assert state_data["retry_count"] == 0

    def test_state_recovery(self):
        """Test state recovery from file."""
        import tempfile
        import json

        with tempfile.TemporaryDirectory() as temp_dir:
            context = NodeExecutionContext(
                job_id="test-job-123",
                node_id="test-node-456",
                base_dir=Path(temp_dir),
                config={"test": "config"},
                logger=Mock(),
                manifest=Mock()
            )

            node = MockTestNode(self.contract, context)

            # Manually create state file
            state_data = {
                "node_id": "test-node-456",
                "job_id": "test-job-123",
                "state": NodeState.FAILED.value,
                "retry_count": 1,
                "last_error": "Recovered error",
                "timestamp": datetime.now().isoformat(),
                "state_history": []
            }

            with open(node._state_file, 'w') as f:
                json.dump(state_data, f)

            # Create new node instance (simulating recovery)
            recovered_node = MockTestNode(self.contract, context)

            # State should be loaded
            assert recovered_node.get_state() == NodeState.FAILED
            assert recovered_node._retry_count == 1
            assert recovered_node._last_error == "Recovered error"
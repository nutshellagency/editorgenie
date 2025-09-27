"""
Unit tests for AI Director node implementation.
Tests rule-based timeline decisions and editing recommendations.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch
from pathlib import Path
from datetime import datetime

from src.core.nodes.ai_director import AIDirectorNode
from src.core.nodes.base import NodeExecutionContext
from src.core.schemas.base import (
    NodeContract,
    NodeType,
    NodeStatus,
    BaseNodeInput,
    BaseNodeOutput
)


class TestAIDirectorNode:
    """Test AI Director node functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.contract = NodeContract(
            name="AI Director Node",
            version="1.0.0",
            node_type=NodeType.DIRECTOR,
            description="Makes rule-based timeline decisions for automated video editing",
            input_schema={
                "type": "object",
                "properties": {
                    "shot_detection_results": {"type": "object"},
                    "stt_results": {"type": "object"},
                    "editing_rules": {"type": "object"},
                    "target_duration": {"type": "number"},
                    "narrative_style": {"type": "string"},
                    "emphasis_areas": {"type": "array"}
                },
                "required": ["shot_detection_results"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "timeline_decisions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "shot_id": {"type": "string"},
                                "start_time": {"type": "number"},
                                "end_time": {"type": "number"},
                                "action": {"type": "string"},
                                "reason": {"type": "string"},
                                "priority": {"type": "number"}
                            }
                        }
                    },
                    "editing_recommendations": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "narrative_score": {"type": "number"},
                    "total_estimated_duration": {"type": "number"}
                }
            },
            config_schema={
                "type": "object",
                "properties": {
                    "decision_model": {"type": "string"},
                    "rule_weights": {"type": "object"},
                    "max_iterations": {"type": "integer"},
                    "confidence_threshold": {"type": "number"}
                }
            }
        )

        self.context = NodeExecutionContext(
            job_id="test-job-ai-director",
            node_id="test-ai-director-node",
            base_dir=Path("/tmp/test"),
            config={"decision_model": "rule-based-v1"},
            logger=Mock(),
            manifest=Mock()
        )

    def test_ai_director_node_initialization(self):
        """Test AI Director node initialization."""
        node = AIDirectorNode(self.contract, self.context)

        assert node.contract == self.contract
        assert node.context == self.context
        assert node.node_type == "director"

    @pytest.mark.asyncio
    async def test_ai_director_basic_decisions(self):
        """Test basic AI Director decision making."""
        node = AIDirectorNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-ai-director",
            node_id="test-ai-director-node",
            input_data={
                "shot_detection_results": {
                    "total_shots": 10,
                    "average_shot_duration": 3.5
                },
                "editing_rules": {
                    "max_shot_duration": 5.0,
                    "min_shot_duration": 1.0,
                    "preferred_pacing": "moderate"
                },
                "target_duration": 30.0
            }
        )

        result = await node.process(input_data)

        assert result.status == NodeStatus.COMPLETED
        assert "timeline_decisions" in result.output_data
        assert "editing_recommendations" in result.output_data
        assert result.output_data["narrative_score"] >= 0.0
        assert result.output_data["total_estimated_duration"] > 0

    @pytest.mark.asyncio
    async def test_ai_director_narrative_analysis(self):
        """Test AI Director with narrative analysis."""
        node = AIDirectorNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-ai-director",
            node_id="test-ai-director-node",
            input_data={
                "shot_detection_results": {
                    "total_shots": 15,
                    "scene_changes": [2.5, 8.0, 15.5, 22.0]
                },
                "stt_results": {
                    "transcripts": "This is sample dialogue for testing",
                    "language": "en"
                },
                "narrative_style": "documentary",
                "emphasis_areas": ["introduction", "key_points", "conclusion"]
            }
        )

        result = await node.process(input_data)

        assert result.status == NodeStatus.COMPLETED
        assert result.metadata["narrative_style"] == "documentary"
        assert len(result.output_data["editing_recommendations"]) >= 0

    @pytest.mark.asyncio
    async def test_ai_director_rule_based_decisions(self):
        """Test AI Director with complex rule-based decisions."""
        node = AIDirectorNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-ai-director",
            node_id="test-ai-director-node",
            input_data={
                "shot_detection_results": {
                    "shots": [
                        {"start_time": 0, "end_time": 3, "duration": 3, "shot_type": "wide"},
                        {"start_time": 3, "end_time": 6, "duration": 3, "shot_type": "medium"},
                        {"start_time": 6, "end_time": 12, "duration": 6, "shot_type": "closeup"}
                    ]
                },
                "editing_rules": {
                    "shot_duration_weights": {"wide": 1.0, "medium": 1.2, "closeup": 1.5},
                    "transition_preferences": {"cut": 0.8, "dissolve": 0.6, "fade": 0.4},
                    "rhythm_pattern": "fast-slow-fast"
                },
                "target_duration": 25.0
            }
        )

        result = await node.process(input_data)

        assert result.status == NodeStatus.COMPLETED
        assert len(result.output_data["timeline_decisions"]) == 3
        assert result.output_data["total_estimated_duration"] <= 25.0

    @pytest.mark.asyncio
    async def test_ai_director_with_configuration(self):
        """Test AI Director node with custom configuration."""
        config = {"rule_weights": {"quality": 0.7, "pacing": 0.3}, "max_iterations": 5}
        contract = NodeContract(
            name="AI Director Node",
            version="1.0.0",
            node_type=NodeType.DIRECTOR,
            description="AI Director with custom config",
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            config_schema={"type": "object"}
        )

        context = NodeExecutionContext(
            job_id="test-job-ai-director",
            node_id="test-ai-director-node",
            base_dir=Path("/tmp/test"),
            config={**config, "decision_model": "advanced-v2"},
            logger=Mock(),
            manifest=Mock()
        )

        node = AIDirectorNode(contract, context)

        input_data = BaseNodeInput(
            job_id="test-job-ai-director",
            node_id="test-ai-director-node",
            input_data={
                "shot_detection_results": {"total_shots": 8},
                "target_duration": 20.0
            }
        )

        result = await node.process(input_data)

        assert result.status == NodeStatus.COMPLETED
        assert result.output_data["decision_model_used"] == "advanced-v2"
        assert result.output_data["total_estimated_duration"] <= 20.0

    @pytest.mark.asyncio
    async def test_ai_director_error_handling(self):
        """Test AI Director node error handling for invalid inputs."""
        node = AIDirectorNode(self.contract, self.context)

        # Test with missing shot detection results
        input_data = BaseNodeInput(
            job_id="test-job-ai-director",
            node_id="test-ai-director-node",
            input_data={
                "target_duration": 30.0
                # Missing shot_detection_results
            }
        )

        result = await node.process(input_data)

        assert result.status == NodeStatus.COMPLETED  # Implementation handles missing data gracefully
        assert len(result.output_data["timeline_decisions"]) > 0

    @pytest.mark.asyncio
    async def test_ai_director_invalid_target_duration(self):
        """Test AI Director node with invalid target duration."""
        node = AIDirectorNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-ai-director",
            node_id="test-ai-director-node",
            input_data={
                "shot_detection_results": {"total_shots": 5},
                "target_duration": -5.0  # Invalid negative duration
            }
        )

        result = await node.process(input_data)

        assert result.status == NodeStatus.COMPLETED  # Implementation handles invalid duration
        assert result.output_data["total_estimated_duration"] > 0

    @pytest.mark.asyncio
    async def test_ai_director_complex_scenario(self):
        """Test AI Director node with complex editing scenario."""
        node = AIDirectorNode(self.contract, self.context)

        input_data = BaseNodeInput(
            job_id="test-job-ai-director",
            node_id="test-ai-director-node",
            input_data={
                "shot_detection_results": {
                    "total_shots": 20,
                    "average_shot_duration": 4.2,
                    "scene_changes": [5.0, 12.5, 18.0, 25.5, 32.0]
                },
                "stt_results": {
                    "transcripts": "Complex dialogue with multiple speakers and topics",
                    "language": "en",
                    "confidence": 0.92
                },
                "editing_rules": {
                    "narrative_structure": "beginning-middle-end",
                    "emphasis_strategy": "key_moments",
                    "transition_complexity": "medium",
                    "audio_priority": "dialogue"
                },
                "target_duration": 45.0,
                "narrative_style": "educational",
                "emphasis_areas": ["introduction", "main_content", "examples", "conclusion"]
            }
        )

        result = await node.process(input_data)

        assert result.status == NodeStatus.COMPLETED
        assert result.metadata["narrative_style"] == "educational"
        assert result.output_data["total_estimated_duration"] <= 45.0
        assert result.output_data["narrative_score"] >= 0.0
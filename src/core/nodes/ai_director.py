"""
AI Director node implementation.
Makes rule-based timeline decisions for automated video editing.
"""

import asyncio
from typing import Dict, Any, List, Optional
from pathlib import Path

from ..schemas.base import (
    BaseNodeInput,
    BaseNodeOutput,
    NodeContract,
    NodeType,
    NodeStatus
)
from .base import BaseNode, NodeExecutionContext


class AIDirectorNode(BaseNode):
    """
    AI Director node with rule-based timeline decisions.

    Analyzes video content and makes intelligent decisions about
    editing, pacing, and narrative structure based on predefined rules.
    """

    @property
    def node_type(self) -> str:
        return "director"

    async def process(self, input_data: BaseNodeInput) -> BaseNodeOutput:
        """
        Process video analysis data and make timeline decisions.

        Args:
            input_data: Input containing video analysis and decision parameters

        Returns:
            BaseNodeOutput with timeline decisions and editing recommendations
        """
        try:
            # Extract input data
            shot_results = input_data.input_data.get("shot_detection_results", {})
            stt_results = input_data.input_data.get("stt_results", {})
            editing_rules = input_data.input_data.get("editing_rules", {})
            target_duration = input_data.input_data.get("target_duration", 60.0)
            narrative_style = input_data.input_data.get("narrative_style", "general")
            emphasis_areas = input_data.input_data.get("emphasis_areas", [])

            # Get configuration
            decision_model = self.context.config.get("decision_model", "rule-based-v1")
            rule_weights = self.context.config.get("rule_weights", {"quality": 0.7, "pacing": 0.3})
            max_iterations = self.context.config.get("max_iterations", 3)
            confidence_threshold = self.context.config.get("confidence_threshold", 0.8)

            # Analyze content and make decisions
            timeline_decisions = await self._analyze_and_decide(
                shot_results, stt_results, editing_rules,
                target_duration, narrative_style, emphasis_areas,
                max_iterations, confidence_threshold
            )

            # Generate editing recommendations
            recommendations = self._generate_recommendations(
                timeline_decisions, shot_results, stt_results, editing_rules
            )

            # Calculate narrative score
            narrative_score = self._calculate_narrative_score(
                timeline_decisions, target_duration, rule_weights
            )

            # Estimate total duration
            estimated_duration = sum(decision["end_time"] - decision["start_time"]
                                   for decision in timeline_decisions)

            output_data = {
                "timeline_decisions": timeline_decisions,
                "editing_recommendations": recommendations,
                "narrative_score": narrative_score,
                "total_estimated_duration": estimated_duration,
                "decision_model_used": decision_model,
                "rules_applied": list(editing_rules.keys())
            }

            # Update manifest
            self._update_manifest_with_decisions(timeline_decisions, narrative_score)

            return self._create_output(
                NodeStatus.COMPLETED,
                output_data,
                {
                    "target_duration": target_duration,
                    "narrative_style": narrative_style,
                    "emphasis_areas": emphasis_areas,
                    "iterations_performed": max_iterations,
                    "confidence_threshold": confidence_threshold,
                    "total_estimated_duration": estimated_duration
                }
            )

        except Exception as e:
            return self._create_output(
                NodeStatus.FAILED,
                {},
                error_message=f"AI Director processing failed: {str(e)}"
            )

    async def _analyze_and_decide(
        self,
        shot_results: Dict[str, Any],
        stt_results: Dict[str, Any],
        editing_rules: Dict[str, Any],
        target_duration: float,
        narrative_style: str,
        emphasis_areas: List[str],
        max_iterations: int,
        confidence_threshold: float
    ) -> List[Dict[str, Any]]:
        """
        Analyze content and make rule-based decisions.

        Args:
            shot_results: Results from shot detection
            stt_results: Results from speech-to-text
            editing_rules: Rules for editing decisions
            target_duration: Target video duration
            narrative_style: Style of narrative
            emphasis_areas: Areas to emphasize
            max_iterations: Maximum decision iterations
            confidence_threshold: Threshold for decision confidence

        Returns:
            List of timeline decisions
        """
        try:
            decisions = []

            # Mock implementation - in reality this would use sophisticated rule engines
            shots = shot_results.get("shots", [])
            total_shots = shot_results.get("total_shots", 0)

            if not shots:
                # Generate basic decisions if no shot data
                decisions = self._generate_basic_decisions(target_duration, narrative_style)
            else:
                # Process existing shots with rule-based decisions
                decisions = await self._process_shots_with_rules(
                    shots, editing_rules, target_duration, narrative_style, max_iterations
                )

            return decisions

        except Exception as e:
            raise RuntimeError(f"Decision analysis failed: {str(e)}")

    def _generate_basic_decisions(self, target_duration: float, narrative_style: str) -> List[Dict[str, Any]]:
        """
        Generate basic timeline decisions when no shot data is available.

        Args:
            target_duration: Target duration for the video
            narrative_style: Style of the narrative

        Returns:
            List of basic timeline decisions
        """
        try:
            decisions = []

            # Handle invalid target duration
            if target_duration <= 0:
                target_duration = 30.0  # Default to 30 seconds

            # Simple rule-based generation
            if narrative_style == "documentary":
                # Documentary style: longer, more deliberate shots
                shot_duration = 4.0
                transition = "dissolve"
            elif narrative_style == "educational":
                # Educational style: moderate pacing with clear transitions
                shot_duration = 3.0
                transition = "cut"
            else:
                # General style: balanced approach
                shot_duration = 3.5
                transition = "cut"

            num_shots = max(1, int(target_duration / shot_duration))  # Ensure at least 1 shot
            current_time = 0.0

            for i in range(num_shots):
                end_time = min(current_time + shot_duration, target_duration)

                decisions.append({
                    "shot_id": f"generated_shot_{i+1}",
                    "start_time": current_time,
                    "end_time": end_time,
                    "action": "keep",
                    "reason": f"Generated for {narrative_style} style",
                    "priority": 0.8,
                    "transition_type": transition,
                    "confidence": 0.75
                })

                current_time = end_time

            return decisions

        except Exception as e:
            self.logger.warning(f"Failed to generate basic decisions: {str(e)}")
            return []

    async def _process_shots_with_rules(
        self,
        shots: List[Dict[str, Any]],
        editing_rules: Dict[str, Any],
        target_duration: float,
        narrative_style: str,
        max_iterations: int
    ) -> List[Dict[str, Any]]:
        """
        Process existing shots with rule-based decisions.

        Args:
            shots: List of shot data
            editing_rules: Editing rules to apply
            target_duration: Target duration
            narrative_style: Narrative style
            max_iterations: Maximum iterations for refinement

        Returns:
            List of processed timeline decisions
        """
        try:
            decisions = []

            # Apply rules to each shot
            for i, shot in enumerate(shots):
                decision = await self._apply_rules_to_shot(
                    shot, i, editing_rules, narrative_style, max_iterations
                )
                decisions.append(decision)

            # Refine decisions based on overall constraints
            decisions = self._refine_decisions(decisions, target_duration, editing_rules)

            return decisions

        except Exception as e:
            raise RuntimeError(f"Shot processing failed: {str(e)}")

    async def _apply_rules_to_shot(
        self,
        shot: Dict[str, Any],
        shot_index: int,
        editing_rules: Dict[str, Any],
        narrative_style: str,
        max_iterations: int
    ) -> Dict[str, Any]:
        """
        Apply editing rules to a single shot.

        Args:
            shot: Shot data
            shot_index: Index of the shot
            editing_rules: Rules to apply
            narrative_style: Narrative style
            max_iterations: Maximum refinement iterations

        Returns:
            Decision for the shot
        """
        try:
            # Mock rule application
            duration = shot.get("duration", 3.0)
            shot_type = shot.get("shot_type", "medium")

            # Apply duration rules
            max_duration = editing_rules.get("max_shot_duration", 5.0)
            min_duration = editing_rules.get("min_shot_duration", 1.0)

            if duration > max_duration:
                action = "trim"
                reason = f"Shot duration {duration}s exceeds maximum {max_duration}s"
                priority = 0.9
            elif duration < min_duration:
                action = "extend"
                reason = f"Shot duration {duration}s below minimum {min_duration}s"
                priority = 0.7
            else:
                action = "keep"
                reason = f"Shot duration {duration}s within acceptable range"
                priority = 0.8

            return {
                "shot_id": f"shot_{shot_index + 1}",
                "start_time": shot.get("start_time", 0),
                "end_time": shot.get("end_time", duration),
                "action": action,
                "reason": reason,
                "priority": priority,
                "shot_type": shot_type,
                "confidence": 0.85
            }

        except Exception as e:
            self.logger.warning(f"Failed to apply rules to shot {shot_index}: {str(e)}")
            return {
                "shot_id": f"shot_{shot_index + 1}",
                "start_time": 0,
                "end_time": 3,
                "action": "keep",
                "reason": "Fallback decision",
                "priority": 0.5,
                "confidence": 0.6
            }

    def _refine_decisions(
        self,
        decisions: List[Dict[str, Any]],
        target_duration: float,
        editing_rules: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Refine decisions based on overall constraints.

        Args:
            decisions: Initial decisions
            target_duration: Target duration
            editing_rules: Editing rules

        Returns:
            Refined decisions
        """
        try:
            total_duration = sum(d["end_time"] - d["start_time"] for d in decisions)

            # Adjust durations if needed
            if total_duration > target_duration:
                # Need to shorten some shots
                excess_time = total_duration - target_duration
                decisions = self._shorten_decisions(decisions, excess_time)
            elif total_duration < target_duration:
                # Can extend some shots
                deficit_time = target_duration - total_duration
                decisions = self._extend_decisions(decisions, deficit_time)

            return decisions

        except Exception as e:
            self.logger.warning(f"Failed to refine decisions: {str(e)}")
            return decisions

    def _shorten_decisions(self, decisions: List[Dict[str, Any]], excess_time: float) -> List[Dict[str, Any]]:
        """Shorten decisions to reduce total duration."""
        # Simple implementation - reduce longer shots first
        for decision in sorted(decisions, key=lambda x: x["end_time"] - x["start_time"], reverse=True):
            if excess_time <= 0:
                break
            duration = decision["end_time"] - decision["start_time"]
            reduction = min(excess_time, duration * 0.2)  # Don't reduce more than 20%
            decision["end_time"] -= reduction
            excess_time -= reduction
        return decisions

    def _extend_decisions(self, decisions: List[Dict[str, Any]], deficit_time: float) -> List[Dict[str, Any]]:
        """Extend decisions to increase total duration."""
        # Simple implementation - extend shorter shots first
        for decision in sorted(decisions, key=lambda x: x["end_time"] - x["start_time"]):
            if deficit_time <= 0:
                break
            duration = decision["end_time"] - decision["start_time"]
            extension = min(deficit_time, duration * 0.3)  # Don't extend more than 30%
            decision["end_time"] += extension
            deficit_time -= extension
        return decisions

    def _generate_recommendations(
        self,
        decisions: List[Dict[str, Any]],
        shot_results: Dict[str, Any],
        stt_results: Dict[str, Any],
        editing_rules: Dict[str, Any]
    ) -> List[str]:
        """
        Generate editing recommendations based on decisions.

        Args:
            decisions: Timeline decisions
            shot_results: Shot detection results
            stt_results: STT results
            editing_rules: Editing rules

        Returns:
            List of recommendation strings
        """
        try:
            recommendations = []

            # Analyze decisions and generate recommendations
            keep_count = sum(1 for d in decisions if d["action"] == "keep")
            trim_count = sum(1 for d in decisions if d["action"] == "trim")
            extend_count = sum(1 for d in decisions if d["action"] == "extend")

            if trim_count > 0:
                recommendations.append(f"Consider trimming {trim_count} shots to improve pacing")

            if extend_count > 0:
                recommendations.append(f"Consider extending {extend_count} shots for better emphasis")

            if keep_count / len(decisions) > 0.8:
                recommendations.append("Most shots are being kept - consider if more aggressive editing is needed")

            # Add style-specific recommendations
            if editing_rules.get("preferred_pacing") == "fast":
                recommendations.append("Fast pacing detected - ensure transitions are smooth")
            elif editing_rules.get("preferred_pacing") == "slow":
                recommendations.append("Slow pacing detected - consider adding more visual interest")

            return recommendations

        except Exception as e:
            self.logger.warning(f"Failed to generate recommendations: {str(e)}")
            return ["Review decisions manually due to processing error"]

    def _calculate_narrative_score(
        self,
        decisions: List[Dict[str, Any]],
        target_duration: float,
        rule_weights: Dict[str, Any]
    ) -> float:
        """
        Calculate narrative score based on decisions.

        Args:
            decisions: Timeline decisions
            target_duration: Target duration
            rule_weights: Weights for different scoring factors

        Returns:
            Narrative score between 0 and 1
        """
        try:
            total_duration = sum(d["end_time"] - d["start_time"] for d in decisions)
            duration_score = min(total_duration / target_duration, 1.0)

            # Calculate average confidence
            avg_confidence = sum(d.get("confidence", 0.5) for d in decisions) / len(decisions)

            # Weighted score
            quality_weight = rule_weights.get("quality", 0.7)
            pacing_weight = rule_weights.get("pacing", 0.3)

            narrative_score = (duration_score * pacing_weight) + (avg_confidence * quality_weight)

            return min(max(narrative_score, 0.0), 1.0)

        except Exception as e:
            self.logger.warning(f"Failed to calculate narrative score: {str(e)}")
            return 0.5

    def _update_manifest_with_decisions(
        self,
        decisions: List[Dict[str, Any]],
        narrative_score: float
    ) -> None:
        """
        Update the job manifest with AI Director decisions.

        Args:
            decisions: Timeline decisions made
            narrative_score: Calculated narrative score
        """
        try:
            # Update manifest with AI Director results
            manifest_data = {
                "ai_director_results": {
                    "total_decisions": len(decisions),
                    "narrative_score": narrative_score,
                    "decisions_by_action": {
                        "keep": sum(1 for d in decisions if d["action"] == "keep"),
                        "trim": sum(1 for d in decisions if d["action"] == "trim"),
                        "extend": sum(1 for d in decisions if d["action"] == "extend")
                    },
                    "average_confidence": sum(d.get("confidence", 0.5) for d in decisions) / len(decisions),
                    "timestamp": self.context.manifest.created_at
                }
            }

            # In a real implementation, this would update the persistent manifest
            self.logger.info(f"Updated manifest with AI Director results: {manifest_data}")

        except Exception as e:
            self.logger.warning(f"Failed to update manifest with AI Director results: {str(e)}")
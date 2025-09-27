"""Edit controls manager for timeline editing operations."""

from typing import List, Optional, Dict, Any, Set
from uuid import UUID
import logging

from .models import TimelineSegment, TimelineTrack
from .state import TimelineStateManager
from .edit_operations import EditOperations

logger = logging.getLogger(__name__)


class EditControlsManager:
    """Manager for timeline edit controls and operations."""

    def __init__(self, state_manager: TimelineStateManager):
        self.state_manager = state_manager
        self.edit_operations = EditOperations(state_manager)
        self.selected_segments: Set[UUID] = set()
        self.selected_tracks: Set[UUID] = set()

    def select_segment(self, segment_id: UUID) -> None:
        """Select a single segment."""
        self.selected_segments.clear()
        self.selected_tracks.clear()
        self.selected_segments.add(segment_id)
        self.state_manager.select_segment(segment_id)
        logger.info(f"Selected segment {segment_id}")

    def select_track(self, track_id: UUID) -> None:
        """Select a track and all its segments."""
        self.selected_tracks.clear()
        self.selected_segments.clear()
        self.selected_tracks.add(track_id)
        self.state_manager.select_track(track_id)
        logger.info(f"Selected track {track_id}")

    def select_time_range(self, start_time: float, end_time: float) -> None:
        """Select all segments in a time range."""
        self.selected_segments.clear()
        self.selected_tracks.clear()
        # Implementation would find segments in time range
        self.state_manager.selection_state.selection_start_time = start_time
        self.state_manager.selection_state.selection_end_time = end_time
        logger.info(f"Selected time range {start_time}-{end_time}")

    def clear_selection(self) -> None:
        """Clear all selections."""
        self.selected_segments.clear()
        self.selected_tracks.clear()
        self.state_manager.clear_selection()
        logger.info("Cleared all selections")

    def cut_at_time(self, cut_time: float) -> List[TimelineSegment]:
        """Cut selected segments at the specified time."""
        if not self.selected_segments:
            logger.warning("No segments selected for cutting")
            return []

        new_segments = self.edit_operations.cut_segments(
            list(self.selected_segments),
            cut_time
        )

        # Update selection to new segments
        self.selected_segments.clear()
        self.selected_segments.update(s.id for s in new_segments)

        return new_segments

    def copy_selection(self) -> List[TimelineSegment]:
        """Copy selected segments to clipboard."""
        if not self.selected_segments:
            logger.warning("No segments selected for copying")
            return []

        return self.edit_operations.copy_segments(list(self.selected_segments))

    def paste_at_time(self, paste_time: float, target_track_id: Optional[UUID] = None) -> List[TimelineSegment]:
        """Paste segments from clipboard at specified time."""
        return self.edit_operations.paste_segments(paste_time, target_track_id)

    def delete_selection(self) -> bool:
        """Delete selected segments."""
        if not self.selected_segments:
            logger.warning("No segments selected for deletion")
            return False

        success = self.edit_operations.delete_segments(list(self.selected_segments))
        if success:
            self.selected_segments.clear()

        return success

    def trim_selection(self, trim_start: bool = True, trim_end: bool = False,
                      trim_time: float = 0.0) -> Optional[TimelineSegment]:
        """Trim selected segment."""
        if len(self.selected_segments) != 1:
            logger.warning("Can only trim single segment selection")
            return None

        segment_id = list(self.selected_segments)[0]
        return self.edit_operations.trim_segment(segment_id, trim_start, trim_end, trim_time)

    def split_selection(self, split_time: float) -> Optional[tuple]:
        """Split selected segment at specified time."""
        if len(self.selected_segments) != 1:
            logger.warning("Can only split single segment selection")
            return None

        segment_id = list(self.selected_segments)[0]
        return self.edit_operations.split_segment(segment_id, split_time)

    def undo_last_operation(self) -> bool:
        """Undo the last edit operation."""
        if not self.state_manager.can_undo():
            logger.warning("No operations to undo")
            return False

        state_data = self.state_manager.undo()
        if state_data:
            logger.info("Undid last operation")
            return True

        return False

    def redo_last_operation(self) -> bool:
        """Redo the last undone operation."""
        if not self.state_manager.can_redo():
            logger.warning("No operations to redo")
            return False

        state_data = self.state_manager.redo()
        if state_data:
            logger.info("Redid last operation")
            return True

        return False

    def get_clipboard_info(self) -> Dict[str, Any]:
        """Get information about clipboard contents."""
        return {
            "segment_count": len(self.edit_operations.clipboard),
            "total_duration": sum(
                s.end_time - s.start_time
                for s in self.edit_operations.clipboard
            ),
            "segments": [
                {
                    "id": str(s.id),
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "track_id": str(s.track_id)
                }
                for s in self.edit_operations.clipboard
            ]
        }

    def get_selection_info(self) -> Dict[str, Any]:
        """Get information about current selection."""
        return {
            "selected_segments": list(self.selected_segments),
            "selected_tracks": list(self.selected_tracks),
            "segment_count": len(self.selected_segments),
            "track_count": len(self.selected_tracks)
        }

    def validate_operation(self, operation: str, **kwargs) -> Dict[str, Any]:
        """Validate an edit operation before execution."""
        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": []
        }

        if operation == "cut":
            cut_time = kwargs.get("cut_time", 0.0)
            if cut_time < 0:
                validation_result["valid"] = False
                validation_result["errors"].append("Cut time must be non-negative")

        elif operation == "paste":
            paste_time = kwargs.get("paste_time", 0.0)
            if paste_time < 0:
                validation_result["valid"] = False
                validation_result["errors"].append("Paste time must be non-negative")

        elif operation == "trim":
            trim_time = kwargs.get("trim_time", 0.0)
            if trim_time < 0:
                validation_result["valid"] = False
                validation_result["errors"].append("Trim time must be non-negative")

        return validation_result

    def get_operation_history(self) -> List[Dict[str, Any]]:
        """Get history of edit operations."""
        # This would return the actual operation history
        # For now, return empty list as placeholder
        return []
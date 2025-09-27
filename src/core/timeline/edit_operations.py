"""Core edit operations for timeline segments."""

from typing import List, Optional, Set, Tuple, Dict, Any
from uuid import UUID
import logging

from .models import TimelineSegment, TimelineTrack, TimelineState
from .state import TimelineStateManager
from ..schemas.base import NodeContract

logger = logging.getLogger(__name__)


class EditOperations:
    """Core edit operations for timeline segments."""

    def __init__(self, state_manager: TimelineStateManager):
        self.state_manager = state_manager
        self.clipboard: List[TimelineSegment] = []

    def cut_segments(self, segment_ids: List[UUID], cut_time: float) -> List[TimelineSegment]:
        """
        Cut segments at the specified time point.

        Args:
            segment_ids: IDs of segments to cut
            cut_time: Time point to cut at

        Returns:
            List of newly created segments after cutting
        """
        new_segments = []

        for segment_id in segment_ids:
            segment = self._find_segment_by_id(segment_id)
            if not segment:
                continue

            if cut_time <= segment.start_time or cut_time >= segment.end_time:
                logger.warning(f"Cut time {cut_time} is outside segment {segment_id} bounds")
                continue

            # Create two new segments from the cut
            first_segment = TimelineSegment(
                id=UUID(),  # Generate new ID
                start_time=segment.start_time,
                end_time=cut_time,
                source_start_time=segment.source_start_time,
                source_end_time=segment.source_start_time + (cut_time - segment.start_time),
                track_id=segment.track_id,
                metadata=segment.metadata.copy()
            )

            second_segment = TimelineSegment(
                id=UUID(),  # Generate new ID
                start_time=cut_time,
                end_time=segment.end_time,
                source_start_time=segment.source_start_time + (cut_time - segment.start_time),
                source_end_time=segment.source_end_time,
                track_id=segment.track_id,
                metadata=segment.metadata.copy()
            )

            new_segments.extend([first_segment, second_segment])

            # Remove original segment and add new ones
            self._replace_segment(segment_id, [first_segment, second_segment])

            logger.info(f"Cut segment {segment_id} at time {cut_time}")

        # Push to undo stack
        self.state_manager.push_undo_state({
            "operation": "cut",
            "original_segments": segment_ids,
            "new_segments": [s.id for s in new_segments],
            "cut_time": cut_time
        })

        return new_segments

    def copy_segments(self, segment_ids: List[UUID]) -> List[TimelineSegment]:
        """
        Copy segments to clipboard.

        Args:
            segment_ids: IDs of segments to copy

        Returns:
            List of copied segments
        """
        copied_segments = []

        for segment_id in segment_ids:
            segment = self._find_segment_by_id(segment_id)
            if segment:
                # Create a copy with new ID
                copied_segment = TimelineSegment(
                    id=UUID(),
                    start_time=segment.start_time,
                    end_time=segment.end_time,
                    source_start_time=segment.source_start_time,
                    source_end_time=segment.source_end_time,
                    track_id=segment.track_id,
                    metadata=segment.metadata.copy()
                )
                copied_segments.append(copied_segment)

        self.clipboard = copied_segments
        logger.info(f"Copied {len(copied_segments)} segments to clipboard")

        return copied_segments

    def paste_segments(self, paste_time: float, target_track_id: Optional[UUID] = None) -> List[TimelineSegment]:
        """
        Paste segments from clipboard at specified time.

        Args:
            paste_time: Time to paste at
            target_track_id: Target track ID (optional)

        Returns:
            List of pasted segments
        """
        if not self.clipboard:
            logger.warning("No segments in clipboard to paste")
            return []

        pasted_segments = []
        current_time = paste_time

        for segment in self.clipboard:
            duration = segment.end_time - segment.start_time

            # Create pasted segment
            pasted_segment = TimelineSegment(
                id=UUID(),
                start_time=current_time,
                end_time=current_time + duration,
                source_start_time=segment.source_start_time,
                source_end_time=segment.source_end_time,
                track_id=target_track_id or segment.track_id,
                metadata=segment.metadata.copy()
            )

            # Check for overlaps and resolve
            if self._check_overlap(pasted_segment):
                logger.warning(f"Overlap detected for pasted segment at {current_time}")
                # For now, just log the warning - more sophisticated overlap resolution
                # could be implemented here

            pasted_segments.append(pasted_segment)
            current_time += duration + 0.1  # Small gap between pasted segments

        # Add pasted segments to timeline
        for segment in pasted_segments:
            self._add_segment_to_track(segment)

        logger.info(f"Pasted {len(pasted_segments)} segments at time {paste_time}")

        # Push to undo stack
        self.state_manager.push_undo_state({
            "operation": "paste",
            "pasted_segments": [s.id for s in pasted_segments],
            "paste_time": paste_time
        })

        return pasted_segments

    def delete_segments(self, segment_ids: List[UUID]) -> bool:
        """
        Delete segments from timeline.

        Args:
            segment_ids: IDs of segments to delete

        Returns:
            True if deletion was successful
        """
        deleted_segments = []

        for segment_id in segment_ids:
            segment = self._find_segment_by_id(segment_id)
            if segment:
                self._remove_segment(segment_id)
                deleted_segments.append(segment)

        if deleted_segments:
            logger.info(f"Deleted {len(deleted_segments)} segments")

            # Push to undo stack
            self.state_manager.push_undo_state({
                "operation": "delete",
                "deleted_segments": deleted_segments,
                "original_positions": {s.id: (s.start_time, s.end_time) for s in deleted_segments}
            })

            return True

        return False

    def trim_segment(self, segment_id: UUID, trim_start: bool = True, trim_end: bool = False,
                    trim_time: float = 0.0) -> Optional[TimelineSegment]:
        """
        Trim a segment from start, end, or both ends.

        Args:
            segment_id: ID of segment to trim
            trim_start: Whether to trim from start
            trim_end: Whether to trim from end
            trim_time: Time to trim to/from

        Returns:
            Trimmed segment or None if invalid
        """
        segment = self._find_segment_by_id(segment_id)
        if not segment:
            return None

        if trim_start and trim_end:
            # Trim both ends - set new start and end times
            if trim_time >= segment.end_time:
                logger.error("Trim time must be before segment end time")
                return None

            trimmed_segment = TimelineSegment(
                id=segment.id,
                start_time=trim_time,
                end_time=segment.end_time,
                source_start_time=segment.source_start_time + (trim_time - segment.start_time),
                source_end_time=segment.source_end_time,
                track_id=segment.track_id,
                metadata=segment.metadata.copy()
            )

        elif trim_start:
            # Trim from start
            if trim_time <= segment.start_time or trim_time >= segment.end_time:
                logger.error("Invalid trim time for start trim")
                return None

            trimmed_segment = TimelineSegment(
                id=segment.id,
                start_time=trim_time,
                end_time=segment.end_time,
                source_start_time=segment.source_start_time + (trim_time - segment.start_time),
                source_end_time=segment.source_end_time,
                track_id=segment.track_id,
                metadata=segment.metadata.copy()
            )

        elif trim_end:
            # Trim from end
            if trim_time <= segment.start_time or trim_time >= segment.end_time:
                logger.error("Invalid trim time for end trim")
                return None

            trimmed_segment = TimelineSegment(
                id=segment.id,
                start_time=segment.start_time,
                end_time=trim_time,
                source_start_time=segment.source_start_time,
                source_end_time=segment.source_start_time + (trim_time - segment.start_time),
                track_id=segment.track_id,
                metadata=segment.metadata.copy()
            )

        else:
            logger.error("Must specify either trim_start or trim_end")
            return None

        # Replace the original segment
        self._replace_segment(segment_id, [trimmed_segment])

        logger.info(f"Trimmed segment {segment_id}")

        # Push to undo stack
        self.state_manager.push_undo_state({
            "operation": "trim",
            "segment_id": segment_id,
            "original_segment": segment,
            "trimmed_segment": trimmed_segment
        })

        return trimmed_segment

    def split_segment(self, segment_id: UUID, split_time: float) -> Optional[Tuple[TimelineSegment, TimelineSegment]]:
        """
        Split a segment at the specified time point.

        Args:
            segment_id: ID of segment to split
            split_time: Time point to split at

        Returns:
            Tuple of (first_segment, second_segment) or None if invalid
        """
        segment = self._find_segment_by_id(segment_id)
        if not segment:
            return None

        if split_time <= segment.start_time or split_time >= segment.end_time:
            logger.error("Split time must be within segment bounds")
            return None

        # Create two segments from the split
        first_segment = TimelineSegment(
            id=UUID(),
            start_time=segment.start_time,
            end_time=split_time,
            source_start_time=segment.source_start_time,
            source_end_time=segment.source_start_time + (split_time - segment.start_time),
            track_id=segment.track_id,
            metadata=segment.metadata.copy()
        )

        second_segment = TimelineSegment(
            id=UUID(),
            start_time=split_time,
            end_time=segment.end_time,
            source_start_time=segment.source_start_time + (split_time - segment.start_time),
            source_end_time=segment.source_end_time,
            track_id=segment.track_id,
            metadata=segment.metadata.copy()
        )

        # Replace original segment with split segments
        self._replace_segment(segment_id, [first_segment, second_segment])

        logger.info(f"Split segment {segment_id} at time {split_time}")

        # Push to undo stack
        self.state_manager.push_undo_state({
            "operation": "split",
            "original_segment": segment_id,
            "split_segments": [first_segment.id, second_segment.id],
            "split_time": split_time
        })

        return (first_segment, second_segment)

    def _find_segment_by_id(self, segment_id: UUID) -> Optional[TimelineSegment]:
        """Find a segment by its ID."""
        # This would need to be implemented with actual timeline data access
        # For now, return None as placeholder
        return None

    def _replace_segment(self, segment_id: UUID, new_segments: List[TimelineSegment]) -> None:
        """Replace a segment with new segments."""
        # This would need to be implemented with actual timeline data access
        pass

    def _add_segment_to_track(self, segment: TimelineSegment) -> None:
        """Add a segment to a track."""
        # This would need to be implemented with actual timeline data access
        pass

    def _remove_segment(self, segment_id: UUID) -> None:
        """Remove a segment from the timeline."""
        # This would need to be implemented with actual timeline data access
        pass

    def _check_overlap(self, segment: TimelineSegment) -> bool:
        """Check if a segment overlaps with existing segments."""
        # This would need to be implemented with actual timeline data access
        return False
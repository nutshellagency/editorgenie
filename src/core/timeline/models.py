"""
Timeline Data Models

Pydantic models for timeline segments, tracks, and state management.
These models define the core data structures used throughout the timeline system.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
import uuid


class TimelineSegment(BaseModel):
    """Represents a segment in the timeline (video clip, audio clip, etc.)"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    start_time: float = Field(..., ge=0, description="Start time in seconds")
    end_time: float = Field(..., gt=0, description="End time in seconds")
    track_id: str = Field(..., description="ID of the track this segment belongs to")
    type: str = Field(..., description="Type of segment: 'video', 'audio', 'text', etc.")
    source: str = Field(..., description="Source file path or URL")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    # UI properties
    selected: bool = Field(default=False, description="Whether segment is selected")
    color: Optional[str] = Field(default=None, description="Display color for the segment")

    # Content properties
    title: Optional[str] = Field(default=None, description="Display title")
    thumbnail: Optional[str] = Field(default=None, description="Thumbnail image URL")

    # Processing state
    processing_status: str = Field(default="ready", description="Processing status")
    error_message: Optional[str] = Field(default=None, description="Error message if processing failed")

    @validator('end_time')
    def end_after_start(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('end_time must be greater than start_time')
        return v

    def duration(self) -> float:
        """Get segment duration in seconds"""
        return self.end_time - self.start_time

    def overlaps_with(self, other: 'TimelineSegment') -> bool:
        """Check if this segment overlaps with another segment"""
        return not (self.end_time <= other.start_time or self.start_time >= other.end_time)

    def contains_time(self, time: float) -> bool:
        """Check if segment contains the given time"""
        return self.start_time <= time <= self.end_time


class TimelineTrack(BaseModel):
    """Represents a track in the timeline (video track, audio track, etc.)"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., description="Track name")
    type: str = Field(..., description="Track type: 'video', 'audio', 'text', etc.")
    segments: List[TimelineSegment] = Field(default_factory=list, description="Segments in this track")

    # UI properties
    visible: bool = Field(default=True, description="Whether track is visible")
    locked: bool = Field(default=False, description="Whether track is locked for editing")
    muted: bool = Field(default=False, description="Whether track is muted")
    volume: float = Field(default=1.0, ge=0, le=2, description="Track volume (0-2)")

    # Display properties
    color: str = Field(default="#4A90E2", description="Track color")
    height: int = Field(default=60, description="Track height in pixels")

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional track metadata")

    def add_segment(self, segment: TimelineSegment) -> None:
        """Add a segment to this track"""
        # Validate segment belongs to this track
        if segment.track_id != self.id:
            raise ValueError(f"Segment {segment.id} does not belong to track {self.id}")

        self.segments.append(segment)
        self.sort_segments()

    def remove_segment(self, segment_id: str) -> Optional[TimelineSegment]:
        """Remove a segment from this track"""
        for i, segment in enumerate(self.segments):
            if segment.id == segment_id:
                return self.segments.pop(i)
        return None

    def sort_segments(self) -> None:
        """Sort segments by start time"""
        self.segments.sort(key=lambda s: s.start_time)

    def get_segments_in_range(self, start_time: float, end_time: float) -> List[TimelineSegment]:
        """Get all segments that overlap with the given time range"""
        return [
            segment for segment in self.segments
            if segment.start_time < end_time and segment.end_time > start_time
        ]

    def validate_no_overlaps(self) -> None:
        """Validate that no segments overlap in this track"""
        for i, segment1 in enumerate(self.segments):
            for segment2 in self.segments[i+1:]:
                if segment1.overlaps_with(segment2):
                    raise ValueError(f"Overlapping segments: {segment1.id} and {segment2.id}")


class TimelineState(BaseModel):
    """Complete timeline state"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(default="Untitled Timeline", description="Timeline name")
    tracks: List[TimelineTrack] = Field(default_factory=list, description="All tracks in timeline")

    # Playback state
    current_time: float = Field(default=0.0, ge=0, description="Current playback time")
    duration: float = Field(default=0.0, ge=0, description="Total timeline duration")
    playback_speed: float = Field(default=1.0, description="Playback speed multiplier")

    # Selection state
    selected_segment_ids: List[str] = Field(default_factory=list, description="Selected segment IDs")

    # Viewport state
    zoom_level: float = Field(default=1.0, gt=0, description="Timeline zoom level")
    scroll_position: float = Field(default=0.0, description="Horizontal scroll position")

    # Metadata
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    modified_at: datetime = Field(default_factory=datetime.now, description="Last modification timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    def add_track(self, track: TimelineTrack) -> None:
        """Add a track to the timeline"""
        self.tracks.append(track)
        self.update_duration()
        self.modified_at = datetime.now()

    def remove_track(self, track_id: str) -> Optional[TimelineTrack]:
        """Remove a track from the timeline"""
        for i, track in enumerate(self.tracks):
            if track.id == track_id:
                removed_track = self.tracks.pop(i)
                self.update_duration()
                self.modified_at = datetime.now()
                return removed_track
        return None

    def get_track(self, track_id: str) -> Optional[TimelineTrack]:
        """Get a track by ID"""
        return next((track for track in self.tracks if track.id == track_id), None)

    def get_segment(self, segment_id: str) -> Optional[TimelineSegment]:
        """Get a segment by ID across all tracks"""
        for track in self.tracks:
            for segment in track.segments:
                if segment.id == segment_id:
                    return segment
        return None

    def update_duration(self) -> None:
        """Update total timeline duration based on tracks"""
        if not self.tracks:
            self.duration = 0.0
            return

        max_end_time = 0.0
        for track in self.tracks:
            for segment in track.segments:
                max_end_time = max(max_end_time, segment.end_time)

        self.duration = max_end_time

    def validate_consistency(self) -> None:
        """Validate timeline consistency"""
        # Check that all segments reference valid tracks
        for track in self.tracks:
            for segment in track.segments:
                if segment.track_id != track.id:
                    raise ValueError(f"Segment {segment.id} references invalid track {segment.track_id}")

            # Validate no overlaps within tracks
            track.validate_no_overlaps()

    def get_segments_in_time_range(self, start_time: float, end_time: float) -> List[TimelineSegment]:
        """Get all segments that overlap with the given time range"""
        segments = []
        for track in self.tracks:
            segments.extend(track.get_segments_in_range(start_time, end_time))
        return segments

    def select_segment(self, segment_id: str) -> None:
        """Select a segment"""
        if segment_id not in self.selected_segment_ids:
            self.selected_segment_ids.append(segment_id)
            self.modified_at = datetime.now()

    def deselect_segment(self, segment_id: str) -> None:
        """Deselect a segment"""
        if segment_id in self.selected_segment_ids:
            self.selected_segment_ids.remove(segment_id)
            self.modified_at = datetime.now()

    def clear_selection(self) -> None:
        """Clear all selections"""
        self.selected_segment_ids.clear()
        self.modified_at = datetime.now()


# Type aliases for convenience
TimelineSegmentDict = Dict[str, Any]
TimelineTrackDict = Dict[str, Any]
TimelineStateDict = Dict[str, Any]
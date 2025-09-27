"""Timeline state management."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Set, Any
from uuid import UUID

from pydantic import BaseModel, Field

from .models import TimelineTrack, TimelineSegment, PlaybackState, TrackType


class SelectionState(BaseModel):
    """State for segment selection."""
    selected_segments: Set[UUID] = Field(default_factory=set, description="IDs of selected segments")
    selected_tracks: Set[UUID] = Field(default_factory=set, description="IDs of selected tracks")
    selection_start_time: Optional[float] = Field(default=None, description="Start time of selection range")
    selection_end_time: Optional[float] = Field(default=None, description="End time of selection range")

    def is_segment_selected(self, segment_id: UUID) -> bool:
        """Check if a segment is selected."""
        return segment_id in self.selected_segments

    def is_track_selected(self, track_id: UUID) -> bool:
        """Check if a track is selected."""
        return track_id in self.selected_tracks

    def clear_selection(self) -> None:
        """Clear all selections."""
        self.selected_segments.clear()
        self.selected_tracks.clear()
        self.selection_start_time = None
        self.selection_end_time = None

    def select_segment(self, segment_id: UUID) -> None:
        """Select a single segment."""
        self.selected_segments.clear()
        self.selected_tracks.clear()
        self.selected_segments.add(segment_id)

    def select_track(self, track_id: UUID) -> None:
        """Select a track and all its segments."""
        self.selected_tracks.clear()
        self.selected_segments.clear()
        self.selected_tracks.add(track_id)

    def select_time_range(self, start_time: float, end_time: float) -> None:
        """Select all segments in a time range."""
        self.selected_segments.clear()
        self.selected_tracks.clear()
        self.selection_start_time = start_time
        self.selection_end_time = end_time


class PlaybackStateModel(BaseModel):
    """State for video playback."""
    state: PlaybackState = Field(default=PlaybackState.STOPPED, description="Current playback state")
    current_time: float = Field(default=0.0, ge=0, description="Current playback time in seconds")
    playback_rate: float = Field(default=1.0, ge=0.1, le=4.0, description="Playback speed multiplier")
    loop_enabled: bool = Field(default=False, description="Whether playback loops")
    in_point: Optional[float] = Field(default=None, ge=0, description="Playback start point")
    out_point: Optional[float] = Field(default=None, ge=0, description="Playback end point")

    def play(self) -> None:
        """Set state to playing."""
        self.state = PlaybackState.PLAYING

    def pause(self) -> None:
        """Set state to paused."""
        self.state = PlaybackState.PAUSED

    def stop(self) -> None:
        """Set state to stopped and reset current time."""
        self.state = PlaybackState.STOPPED
        self.current_time = 0.0

    def scrub_to(self, time: float) -> None:
        """Scrub to a specific time."""
        self.state = PlaybackState.SCRUBBING
        self.current_time = max(0, time)

    def set_in_point(self, time: float) -> None:
        """Set the in point for playback."""
        self.in_point = time
        if self.out_point and time >= self.out_point:
            raise ValueError("In point must be before out point")

    def set_out_point(self, time: float) -> None:
        """Set the out point for playback."""
        self.out_point = time
        if self.in_point and time <= self.in_point:
            raise ValueError("Out point must be after in point")


class ViewportState(BaseModel):
    """State for timeline viewport."""
    zoom_level: float = Field(default=1.0, gt=0.1, le=10.0, description="Timeline zoom level")
    scroll_position: float = Field(default=0.0, ge=0, description="Horizontal scroll position")
    track_heights: Dict[UUID, int] = Field(default_factory=dict, description="Custom track heights")
    collapsed_tracks: Set[UUID] = Field(default_factory=set, description="IDs of collapsed tracks")
    show_waveforms: bool = Field(default=True, description="Whether to show audio waveforms")
    show_grid: bool = Field(default=True, description="Whether to show timeline grid")
    snap_to_grid: bool = Field(default=True, description="Whether to snap to grid")
    grid_size: float = Field(default=0.1, gt=0, description="Grid size in seconds")

    def zoom_in(self, factor: float = 1.2) -> None:
        """Zoom in the timeline."""
        self.zoom_level = min(self.zoom_level * factor, 10.0)

    def zoom_out(self, factor: float = 1.2) -> None:
        """Zoom out the timeline."""
        self.zoom_level = max(self.zoom_level / factor, 0.1)

    def scroll_to_time(self, time: float) -> None:
        """Scroll to show the given time."""
        self.scroll_position = time

    def toggle_track_collapsed(self, track_id: UUID) -> None:
        """Toggle track collapsed state."""
        if track_id in self.collapsed_tracks:
            self.collapsed_tracks.remove(track_id)
        else:
            self.collapsed_tracks.add(track_id)

    def is_track_collapsed(self, track_id: UUID) -> bool:
        """Check if a track is collapsed."""
        return track_id in self.collapsed_tracks


class UndoRedoState(BaseModel):
    """State for undo/redo functionality."""
    can_undo: bool = Field(default=False, description="Whether undo is available")
    can_redo: bool = Field(default=False, description="Whether redo is available")
    undo_stack: List[Dict[str, Any]] = Field(default_factory=list, description="Undo stack")
    redo_stack: List[Dict[str, Any]] = Field(default_factory=list, description="Redo stack")
    max_history_size: int = Field(default=50, description="Maximum history size")

    def push_state(self, state_data: Dict[str, Any]) -> None:
        """Push a new state to the undo stack."""
        self.undo_stack.append(state_data)
        self.redo_stack.clear()  # Clear redo stack when new action is performed

        # Limit history size
        if len(self.undo_stack) > self.max_history_size:
            self.undo_stack.pop(0)

        self.can_undo = True
        self.can_redo = False

    def undo(self) -> Optional[Dict[str, Any]]:
        """Undo the last action."""
        if not self.undo_stack:
            return None

        state_data = self.undo_stack.pop()
        self.redo_stack.append(state_data)

        self.can_undo = len(self.undo_stack) > 0
        self.can_redo = True

        return state_data

    def redo(self) -> Optional[Dict[str, Any]]:
        """Redo the last undone action."""
        if not self.redo_stack:
            return None

        state_data = self.redo_stack.pop()
        self.undo_stack.append(state_data)

        self.can_undo = True
        self.can_redo = len(self.redo_stack) > 0

        return state_data




@dataclass
class TimelineEvent:
    """Event for timeline state changes."""
    event_type: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    user_id: Optional[str] = None
    data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary."""
        return {
            "event_type": self.event_type,
            "timestamp": self.timestamp.isoformat(),
            "user_id": self.user_id,
            "data": self.data,
        }


class TimelineEventBus:
    """Event bus for timeline state changes."""

    def __init__(self):
        self.listeners: Dict[str, List[callable]] = {}

    def subscribe(self, event_type: str, listener: callable) -> None:
        """Subscribe to an event type."""
        if event_type not in self.listeners:
            self.listeners[event_type] = []
        self.listeners[event_type].append(listener)

    def unsubscribe(self, event_type: str, listener: callable) -> None:
        """Unsubscribe from an event type."""
        if event_type in self.listeners:
            try:
                self.listeners[event_type].remove(listener)
            except ValueError:
                pass

    def emit(self, event: TimelineEvent) -> None:
        """Emit an event to all listeners."""
        if event.event_type in self.listeners:
            for listener in self.listeners[event.event_type]:
                try:
                    listener(event)
                except Exception as e:
                    # Log error but don't break other listeners
                    print(f"Error in event listener: {e}")


# Global event bus instance
timeline_event_bus = TimelineEventBus()


class TimelineStateManager:
    """Manager for timeline state coordination."""

    def __init__(self):
        self.selection_state = SelectionState()
        self.playback_state = PlaybackStateModel()
        self.viewport_state = ViewportState()
        self.undo_redo_state = UndoRedoState()
        self.event_bus = timeline_event_bus

    def get_current_time(self) -> float:
        """Get the current playback time."""
        return self.playback_state.current_time

    def set_current_time(self, time: float) -> None:
        """Set the current playback time."""
        self.playback_state.scrub_to(time)
        self.event_bus.emit(TimelineEvent(
            event_type="time_changed",
            data={"time": time}
        ))

    def select_segment(self, segment_id: UUID) -> None:
        """Select a segment."""
        self.selection_state.select_segment(segment_id)
        self.event_bus.emit(TimelineEvent(
            event_type="segment_selected",
            data={"segment_id": str(segment_id)}
        ))

    def select_track(self, track_id: UUID) -> None:
        """Select a track."""
        self.selection_state.select_track(track_id)
        self.event_bus.emit(TimelineEvent(
            event_type="track_selected",
            data={"track_id": str(track_id)}
        ))

    def clear_selection(self) -> None:
        """Clear all selections."""
        self.selection_state.clear_selection()
        self.event_bus.emit(TimelineEvent(event_type="selection_cleared"))

    def play(self) -> None:
        """Start playback."""
        self.playback_state.play()
        self.event_bus.emit(TimelineEvent(event_type="playback_started"))

    def pause(self) -> None:
        """Pause playback."""
        self.playback_state.pause()
        self.event_bus.emit(TimelineEvent(event_type="playback_paused"))

    def stop(self) -> None:
        """Stop playback."""
        self.playback_state.stop()
        self.event_bus.emit(TimelineEvent(event_type="playback_stopped"))

    def zoom_in(self, factor: float = 1.2) -> None:
        """Zoom in the timeline."""
        self.viewport_state.zoom_in(factor)
        self.event_bus.emit(TimelineEvent(
            event_type="viewport_changed",
            data={"zoom_level": self.viewport_state.zoom_level}
        ))

    def zoom_out(self, factor: float = 1.2) -> None:
        """Zoom out the timeline."""
        self.viewport_state.zoom_out(factor)
        self.event_bus.emit(TimelineEvent(
            event_type="viewport_changed",
            data={"zoom_level": self.viewport_state.zoom_level}
        ))

    def can_undo(self) -> bool:
        """Check if undo is available."""
        return self.undo_redo_state.can_undo

    def can_redo(self) -> bool:
        """Check if redo is available."""
        return self.undo_redo_state.can_redo

    def undo(self) -> Optional[Dict[str, Any]]:
        """Undo the last action."""
        state_data = self.undo_redo_state.undo()
        if state_data:
            self.event_bus.emit(TimelineEvent(
                event_type="state_undone",
                data=state_data
            ))
        return state_data

    def redo(self) -> Optional[Dict[str, Any]]:
        """Redo the last undone action."""
        state_data = self.undo_redo_state.redo()
        if state_data:
            self.event_bus.emit(TimelineEvent(
                event_type="state_redone",
                data=state_data
            ))
        return state_data

    def push_undo_state(self, state_data: Dict[str, Any]) -> None:
        """Push a new state to the undo stack."""
        self.undo_redo_state.push_state(state_data)
        self.event_bus.emit(TimelineEvent(
            event_type="state_pushed",
            data={"undo_available": True}
        ))

    def get_state_snapshot(self) -> Dict[str, Any]:
        """Get a snapshot of the current state."""
        return {
            "selection": self.selection_state.dict(),
            "playback": self.playback_state.dict(),
            "viewport": self.viewport_state.dict(),
            "undo_redo": self.undo_redo_state.dict(),
            "timestamp": datetime.utcnow().isoformat()
        }

    def restore_state(self, state_data: Dict[str, Any]) -> None:
        """Restore state from a snapshot."""
        # This would restore the state from the snapshot
        # Implementation depends on the specific state structure
        self.event_bus.emit(TimelineEvent(
            event_type="state_restored",
            data=state_data
        ))
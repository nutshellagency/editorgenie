"""Timeline module for video editing functionality."""

from .models import TimelineSegment, TimelineTrack, TimelineState, TrackType, SegmentType, PlaybackState
from .state import TimelineEventBus, TimelineEvent, TimelineStateManager
from .proxy import ProxyGenerationService
from .edit_operations import EditOperations
from .edit_controls_manager import EditControlsManager

__all__ = [
    "TimelineSegment",
    "TimelineTrack",
    "TimelineState",
    "TrackType",
    "SegmentType",
    "PlaybackState",
    "TimelineEventBus",
    "TimelineEvent",
    "TimelineStateManager",
    "ProxyGenerationService",
    "EditOperations",
    "EditControlsManager",
]
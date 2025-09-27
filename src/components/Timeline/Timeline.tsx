import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './Timeline.css';
import { timelinePerformanceOptimizer } from '../../services/performance/timelinePerformanceOptimizer';
import { TimelineState, TimelineSegment as CoreTimelineSegment, TimelineTrack as CoreTimelineTrack } from '../../core/timeline/models';

export interface TimelineSegment {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  type: 'video' | 'audio' | 'text' | 'image';
  data: any;
  zIndex?: number;
  locked?: boolean;
  muted?: boolean;
  visible?: boolean;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'composite';
  segments: TimelineSegment[];
  muted?: boolean;
  locked?: boolean;
  volume?: number;
  height?: number;
  collapsed?: boolean;
}

export interface TimelineData {
  id: string;
  name: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  tracks: TimelineTrack[];
  metadata?: Record<string, any>;
}

interface TimelineProps {
  timeline: TimelineData;
  currentTime: number;
  playbackRate: number;
  isPlaying: boolean;
  zoom: number;
  scrollLeft: number;
  selectedSegments: string[];
  selectedTracks: string[];
  onTimeChange: (time: number) => void;
  onSegmentSelect: (segmentId: string, multiSelect?: boolean) => void;
  onTrackSelect: (trackId: string, multiSelect?: boolean) => void;
  onSegmentMove: (segmentId: string, newStartTime: number, newTrackId?: string) => void;
  onSegmentResize: (segmentId: string, newStartTime: number, newDuration: number) => void;
  onZoomChange: (zoom: number) => void;
  onScrollChange: (scrollLeft: number) => void;
  className?: string;
}

const Timeline: React.FC<TimelineProps> = ({
  timeline,
  currentTime,
  playbackRate,
  isPlaying,
  zoom,
  scrollLeft,
  selectedSegments,
  selectedTracks,
  onTimeChange,
  onSegmentSelect,
  onTrackSelect,
  onSegmentMove,
  onSegmentResize,
  onZoomChange,
  onScrollChange,
  className = '',
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'scrub' | 'segment' | 'resize' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [draggedSegment, setDraggedSegment] = useState<string | null>(null);

  // Constants
  const TRACK_HEIGHT = 60;
  const RULER_HEIGHT = 30;
  const PIXELS_PER_SECOND = 100 * zoom;

  // Calculate timeline dimensions
  const timelineWidth = timeline.duration * PIXELS_PER_SECOND;
  const totalHeight = RULER_HEIGHT + (timeline.tracks.length * TRACK_HEIGHT);

  // Generate time markers for ruler
  const timeMarkers = useMemo(() => {
    const markers = [];
    const majorInterval = Math.max(1, Math.floor(10 / zoom)); // Major markers every 10 seconds at 1x zoom
    const minorInterval = majorInterval / 5; // Minor markers every 2 seconds

    for (let time = 0; time <= timeline.duration; time += minorInterval) {
      const isMajor = time % majorInterval === 0;
      markers.push({
        time,
        position: time * PIXELS_PER_SECOND,
        isMajor,
        label: isMajor ? `${time}s` : '',
      });
    }
    return markers;
  }, [timeline.duration, PIXELS_PER_SECOND, zoom]);

  // Handle mouse/touch events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left + scrollLeft;
    const time = x / PIXELS_PER_SECOND;

    // Check if clicking on scrubber
    const scrubberPosition = currentTime * PIXELS_PER_SECOND;
    if (Math.abs(x - scrubberPosition) < 10) {
      setIsDragging(true);
      setDragType('scrub');
      setDragStartX(e.clientX);
      setDragStartTime(currentTime);
      return;
    }

    // Check if clicking on segments
    const trackElements = tracksRef.current?.children;
    if (trackElements) {
      for (let i = 0; i < trackElements.length; i++) {
        const trackElement = trackElements[i] as HTMLElement;
        const segmentElements = trackElement.querySelectorAll('.timeline-segment');

        for (let j = 0; j < segmentElements.length; j++) {
          const segmentElement = segmentElements[j] as HTMLElement;
          const segmentRect = segmentElement.getBoundingClientRect();
          const segmentTimeRect = {
            left: segmentRect.left - rect.left + scrollLeft,
            right: segmentRect.right - rect.left + scrollLeft,
          };

          if (x >= segmentTimeRect.left && x <= segmentTimeRect.right) {
            const segmentId = segmentElement.dataset.segmentId;
            if (segmentId) {
              setIsDragging(true);
              setDragType('segment');
              setDragStartX(e.clientX);
              setDragStartTime(time);
              setDraggedSegment(segmentId);

              // Check if clicking on resize handle
              const handleWidth = 8;
              if (x >= segmentTimeRect.right - handleWidth) {
                setDragType('resize');
              }

              onSegmentSelect(segmentId, e.ctrlKey || e.metaKey);
              return;
            }
          }
        }
      }
    }

    // Click on empty space - scrub to time
    onTimeChange(Math.max(0, Math.min(time, timeline.duration)));
  }, [currentTime, scrollLeft, PIXELS_PER_SECOND, onTimeChange, onSegmentSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;

    const deltaX = e.clientX - dragStartX;
    const deltaTime = deltaX / PIXELS_PER_SECOND;

    if (dragType === 'scrub') {
      const newTime = Math.max(0, Math.min(dragStartTime + deltaTime, timeline.duration));
      onTimeChange(newTime);
    } else if (dragType === 'segment' && draggedSegment) {
      const newTime = Math.max(0, dragStartTime + deltaTime);
      onSegmentMove(draggedSegment, newTime);
    } else if (dragType === 'resize' && draggedSegment) {
      const newDuration = Math.max(0.1, dragStartTime + deltaTime);
      // Find the segment to get its current start time
      for (const track of timeline.tracks) {
        const segment = track.segments.find(s => s.id === draggedSegment);
        if (segment) {
          onSegmentResize(draggedSegment, segment.startTime, newDuration);
          break;
        }
      }
    }
  }, [isDragging, dragStartX, dragStartTime, dragType, draggedSegment, PIXELS_PER_SECOND, onTimeChange, onSegmentMove, onSegmentResize, timeline]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
    setDraggedSegment(null);
  }, []);

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(zoom * zoomFactor, 5.0));
    onZoomChange(newZoom);
  }, [zoom, onZoomChange]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          // Toggle play/pause (implement via props)
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onTimeChange(Math.max(0, currentTime - (e.shiftKey ? 1 : 0.1)));
          break;
        case 'ArrowRight':
          e.preventDefault();
          onTimeChange(Math.min(timeline.duration, currentTime + (e.shiftKey ? 1 : 0.1)));
          break;
        case 'Home':
          e.preventDefault();
          onTimeChange(0);
          break;
        case 'End':
          e.preventDefault();
          onTimeChange(timeline.duration);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, timeline.duration, onTimeChange]);

  return (
    <div
      ref={timelineRef}
      className={`timeline ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{
        cursor: isDragging ? (dragType === 'scrub' ? 'col-resize' : 'move') : 'default',
      }}
    >
      {/* Timeline Ruler */}
      <div
        ref={rulerRef}
        className="timeline-ruler"
        style={{
          height: RULER_HEIGHT,
          width: timelineWidth,
          transform: `translateX(-${scrollLeft}px)`,
        }}
      >
        {timeMarkers.map((marker, index) => (
          <div
            key={index}
            className={`timeline-marker ${marker.isMajor ? 'major' : 'minor'}`}
            style={{
              left: marker.position,
            }}
          >
            {marker.isMajor && (
              <div className="timeline-marker-label">
                {marker.label}
              </div>
            )}
            <div className="timeline-marker-line" />
          </div>
        ))}
      </div>

      {/* Timeline Tracks */}
      <div
        ref={tracksRef}
        className="timeline-tracks"
        style={{
          height: timeline.tracks.length * TRACK_HEIGHT,
          transform: `translateX(-${scrollLeft}px)`,
        }}
      >
        {timeline.tracks.map((track, trackIndex) => (
          <div
            key={track.id}
            className={`timeline-track ${selectedTracks.includes(track.id) ? 'selected' : ''} ${track.locked ? 'locked' : ''}`}
            style={{
              height: TRACK_HEIGHT,
              top: trackIndex * TRACK_HEIGHT,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onTrackSelect(track.id, e.ctrlKey || e.metaKey);
            }}
          >
            {/* Track Header */}
            <div className="timeline-track-header">
              <div className="timeline-track-name">{track.name}</div>
              <div className="timeline-track-controls">
                {track.muted && <span className="track-muted">🔇</span>}
                {track.locked && <span className="track-locked">🔒</span>}
              </div>
            </div>

            {/* Track Segments */}
            <div className="timeline-track-content">
              {track.segments.map((segment) => (
                <div
                  key={segment.id}
                  data-segment-id={segment.id}
                  className={`timeline-segment ${selectedSegments.includes(segment.id) ? 'selected' : ''} ${segment.locked ? 'locked' : ''}`}
                  style={{
                    left: segment.startTime * PIXELS_PER_SECOND,
                    width: segment.duration * PIXELS_PER_SECOND,
                    height: TRACK_HEIGHT - 4,
                    zIndex: segment.zIndex || 1,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSegmentSelect(segment.id, e.ctrlKey || e.metaKey);
                  }}
                >
                  {/* Segment Content */}
                  <div className="timeline-segment-content">
                    {segment.type === 'video' && (
                      <div className="segment-video">
                        <div className="segment-thumbnail" />
                        <div className="segment-info">
                          <div className="segment-duration">{segment.duration.toFixed(1)}s</div>
                        </div>
                      </div>
                    )}

                    {segment.type === 'audio' && (
                      <div className="segment-audio">
                        <div className="segment-waveform" />
                        <div className="segment-info">
                          <div className="segment-duration">{segment.duration.toFixed(1)}s</div>
                        </div>
                      </div>
                    )}

                    {segment.type === 'text' && (
                      <div className="segment-text">
                        <div className="segment-text-content">Text</div>
                        <div className="segment-info">
                          <div className="segment-duration">{segment.duration.toFixed(1)}s</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resize Handles */}
                  <div className="segment-resize-handle left" />
                  <div className="segment-resize-handle right" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline Scrubber */}
      <div
        ref={scrubberRef}
        className="timeline-scrubber"
        style={{
          left: currentTime * PIXELS_PER_SECOND - scrollLeft,
        }}
      >
        <div className="timeline-scrubber-line" />
        <div className="timeline-scrubber-head" />
      </div>

      {/* Playback Indicator */}
      {isPlaying && (
        <div
          className="timeline-playback-indicator"
          style={{
            left: currentTime * PIXELS_PER_SECOND - scrollLeft,
          }}
        >
          <div className="playback-indicator-dot" />
        </div>
      )}

      {/* Selection Range */}
      {selectedSegments.length > 0 && (
        <div className="timeline-selection-range" />
      )}
    </div>
  );
};

export default Timeline;
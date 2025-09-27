/**
 * Audio waveform visualization component for timeline editing.
 *
 * This component provides interactive audio waveform display with features like:
 * - Real-time waveform rendering from audio data
 * - Zoom and pan interactions
 * - Selection capabilities
 * - Multi-track support
 * - Accessibility features
 * - Performance optimization
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import './AudioWaveform.css';

export interface WaveformData {
  /** Audio sample data normalized to 0-1 range */
  samples: Float32Array;
  /** Sample rate of the audio */
  sampleRate: number;
  /** Duration of the audio in seconds */
  duration: number;
  /** Number of channels */
  channels: number;
  /** Peak values for each channel */
  peaks: number[];
}

export interface WaveformSelection {
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Track ID if multi-track */
  trackId?: string;
}

export interface AudioWaveformProps {
  /** Waveform data to display */
  waveformData: WaveformData | null;
  /** Current playback time in seconds */
  currentTime?: number;
  /** Current selection */
  selection?: WaveformSelection | null;
  /** Zoom level (1.0 = normal) */
  zoom?: number;
  /** Height of the waveform in pixels */
  height?: number;
  /** Color scheme for the waveform */
  colors?: {
    /** Primary waveform color */
    primary: string;
    /** Progress/playback color */
    progress: string;
    /** Selection color */
    selection: string;
    /** Background color */
    background: string;
  };
  /** Whether the waveform is disabled */
  disabled?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (selection: WaveformSelection | null) => void;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** Callback when user clicks on waveform */
  onTimeClick?: (time: number) => void;
  /** Additional CSS class name */
  className?: string;
  /** Whether to show RMS line */
  showRMS?: boolean;
  /** Whether to enable multi-track mode */
  multiTrack?: boolean;
  /** Track information for multi-track mode */
  tracks?: Array<{
    id: string;
    name: string;
    color: string;
    waveformData: WaveformData;
  }>;
}

const DEFAULT_COLORS = {
  primary: '#3b82f6',
  progress: '#ef4444',
  selection: 'rgba(59, 130, 246, 0.3)',
  background: 'transparent'
};

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  waveformData,
  currentTime = 0,
  selection = null,
  zoom = 1.0,
  height = 80,
  colors = DEFAULT_COLORS,
  disabled = false,
  onSelectionChange,
  onZoomChange,
  onTimeClick,
  className = '',
  showRMS = true,
  multiTrack = false,
  tracks = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [localSelection, setLocalSelection] = useState<WaveformSelection | null>(null);

  // Use local selection if no external selection provided
  const activeSelection = selection || localSelection;

  // Calculate visible time range based on zoom
  const visibleDuration = useMemo(() => {
    if (!waveformData) return 0;
    return waveformData.duration / zoom;
  }, [waveformData, zoom]);

  // Convert time to pixel position
  const timeToPixel = useCallback((time: number): number => {
    if (!waveformData || !containerRef.current) return 0;
    const containerWidth = containerRef.current.clientWidth;
    return (time / waveformData.duration) * containerWidth;
  }, [waveformData]);

  // Convert pixel position to time
  const pixelToTime = useCallback((pixel: number): number => {
    if (!waveformData || !containerRef.current) return 0;
    const containerWidth = containerRef.current.clientWidth;
    return (pixel / containerWidth) * waveformData.duration;
  }, [waveformData]);

  // Generate waveform path for rendering
  const generateWaveformPath = useCallback((
    samples: Float32Array,
    width: number,
    height: number,
    channelIndex: number = 0
  ): Path2D => {
    const path = new Path2D();
    const samplesPerPixel = Math.max(1, Math.floor(samples.length / width));

    for (let x = 0; x < width; x++) {
      const sampleIndex = x * samplesPerPixel;
      const endSample = Math.min(sampleIndex + samplesPerPixel, samples.length);

      // Find peak in this range
      let peak = 0;
      for (let i = sampleIndex; i < endSample; i++) {
        peak = Math.max(peak, Math.abs(samples[i]));
      }

      const y = (peak * height) / 2;
      const centerY = height / 2;

      if (x === 0) {
        path.moveTo(x, centerY - y);
      } else {
        path.lineTo(x, centerY - y);
      }

      path.lineTo(x, centerY + y);
    }

    return path;
  }, []);

  // Render waveform on canvas
  const renderWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const displayHeight = multiTrack && tracks.length > 0 ? height / tracks.length : height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (multiTrack && tracks.length > 0) {
      // Multi-track rendering
      tracks.forEach((track, index) => {
        const trackY = index * displayHeight;
        const trackHeight = displayHeight;

        // Draw track background
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, trackY, width, trackHeight);

        // Draw waveform
        ctx.strokeStyle = track.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;

        const path = generateWaveformPath(
          track.waveformData.samples,
          width,
          trackHeight,
          0
        );

        ctx.stroke(path);
        ctx.globalAlpha = 1;
      });
    } else {
      // Single track rendering
      ctx.fillStyle = colors.background;
      ctx.fillRect(0, 0, width, height);

      // Draw waveform
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.8;

      const path = generateWaveformPath(waveformData.samples, width, height);
      ctx.stroke(path);

      // Draw RMS line if enabled
      if (showRMS) {
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;

        const rmsPath = new Path2D();
        const rmsSamples = calculateRMS(waveformData.samples, width);

        rmsSamples.forEach((rms, x) => {
          const y = (rms * height) / 2;
          const centerY = height / 2;

          if (x === 0) {
            rmsPath.moveTo(x, centerY - y);
          } else {
            rmsPath.lineTo(x, centerY - y);
          }

          rmsPath.lineTo(x, centerY + y);
        });

        ctx.stroke(rmsPath);
        ctx.globalAlpha = 1;
      }
    }

    // Draw progress line
    if (currentTime > 0) {
      const progressX = timeToPixel(currentTime);
      ctx.strokeStyle = colors.progress;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();
    }

    // Draw selection
    if (activeSelection) {
      const startX = timeToPixel(activeSelection.startTime);
      const endX = timeToPixel(activeSelection.endTime);

      ctx.fillStyle = colors.selection;
      ctx.fillRect(startX, 0, endX - startX, height);

      // Draw selection borders
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, 0, endX - startX, height);
    }
  }, [
    waveformData,
    currentTime,
    activeSelection,
    height,
    colors,
    showRMS,
    multiTrack,
    tracks,
    timeToPixel,
    generateWaveformPath
  ]);

  // Calculate RMS values for visualization
  const calculateRMS = (samples: Float32Array, targetSamples: number): Float32Array => {
    const rms = new Float32Array(targetSamples);
    const samplesPerBin = Math.max(1, Math.floor(samples.length / targetSamples));

    for (let i = 0; i < targetSamples; i++) {
      const start = i * samplesPerBin;
      const end = Math.min(start + samplesPerBin, samples.length);

      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += samples[j] * samples[j];
      }

      rms[i] = Math.sqrt(sum / (end - start));
    }

    return rms;
  };

  // Handle mouse down for selection
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (disabled || !waveformData) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const time = pixelToTime(x);

    setIsDragging(true);
    setDragStart(time);
    setLocalSelection({ startTime: time, endTime: time });
  }, [disabled, waveformData, pixelToTime]);

  // Handle mouse move for selection
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging || dragStart === null || !waveformData) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const time = pixelToTime(x);

    const startTime = Math.min(dragStart, time);
    const endTime = Math.max(dragStart, time);

    setLocalSelection({ startTime, endTime });
  }, [isDragging, dragStart, waveformData, pixelToTime]);

  // Handle mouse up for selection
  const handleMouseUp = useCallback(() => {
    if (isDragging && localSelection) {
      onSelectionChange?.(localSelection);
    }

    setIsDragging(false);
    setDragStart(null);
  }, [isDragging, localSelection, onSelectionChange]);

  // Handle click for time seeking
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!waveformData) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const time = pixelToTime(x);

    onTimeClick?.(time);
  }, [waveformData, pixelToTime, onTimeClick]);

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10.0, zoom * zoomFactor));

    onZoomChange?.(newZoom);
  }, [zoom, onZoomChange]);

  // Set up canvas resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }

      renderWaveform();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [height, renderWaveform]);

  // Render waveform when dependencies change
  useEffect(() => {
    renderWaveform();
  }, [renderWaveform]);

  if (!waveformData && !multiTrack) {
    return (
      <div
        ref={containerRef}
        className={`audio-waveform-loading ${className}`}
        style={{ height }}
      >
        <div className="audio-waveform-placeholder">
          No audio data available
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`audio-waveform-container ${disabled ? 'disabled' : ''} ${className}`}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className="audio-waveform-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        style={{
          cursor: isDragging ? 'crosshair' : disabled ? 'not-allowed' : 'pointer'
        }}
      />

      {/* Time markers */}
      <div className="audio-waveform-markers">
        {waveformData && (
          <>
            <div
              className="audio-waveform-marker progress-marker"
              style={{ left: `${(currentTime / waveformData.duration) * 100}%` }}
            />
            {activeSelection && (
              <>
                <div
                  className="audio-waveform-marker selection-start-marker"
                  style={{ left: `${(activeSelection.startTime / waveformData.duration) * 100}%` }}
                />
                <div
                  className="audio-waveform-marker selection-end-marker"
                  style={{ left: `${(activeSelection.endTime / waveformData.duration) * 100}%` }}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Zoom indicator */}
      <div className="audio-waveform-zoom-indicator">
        Zoom: {zoom.toFixed(1)}x
      </div>
    </div>
  );
};

export default AudioWaveform;

// Ensure this is treated as a module
export {};
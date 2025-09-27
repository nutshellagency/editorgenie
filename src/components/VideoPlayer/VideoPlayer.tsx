import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './VideoPlayer.css';

export interface VideoSource {
  src: string;
  type: string;
  quality?: string;
  label?: string;
}

export interface VideoPlayerProps {
  sources: VideoSource[];
  poster?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  width?: number | string;
  height?: number | string;
  currentTime?: number;
  volume?: number;
  playbackRate?: number;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onVolumeChange?: (volume: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
  onLoadStart?: () => void;
  onLoadedData?: () => void;
  onCanPlay?: () => void;
  className?: string;
  hlsConfig?: any;
  enableHLS?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  sources,
  poster,
  autoplay = false,
  muted = false,
  loop = false,
  controls = true,
  width = '100%',
  height = 'auto',
  currentTime = 0,
  volume = 1,
  playbackRate = 1,
  onTimeUpdate,
  onDurationChange,
  onVolumeChange,
  onPlay,
  onPause,
  onEnded,
  onError,
  onLoadStart,
  onLoadedData,
  onCanPlay,
  className = '',
  hlsConfig,
  enableHLS = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isControlsVisible, setIsControlsVisible] = useState(true);

  // Initialize HLS player if enabled
  useEffect(() => {
    if (enableHLS && typeof window !== 'undefined') {
      // Dynamic import for HLS.js
      const loadHLS = async () => {
        try {
          const HlsModule = await import('hls.js');
          const Hls = HlsModule.default;

          if (Hls.isSupported() && videoRef.current && sources.length > 0) {
            const hls = new Hls(hlsConfig);
            hlsRef.current = hls;

            // Find HLS source
            const hlsSource = sources.find(source =>
              source.type === 'application/x-mpegURL' || source.src.includes('.m3u8')
            );

            if (hlsSource) {
              hls.loadSource(hlsSource.src);
              hls.attachMedia(videoRef.current);

              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setIsLoading(false);
                onLoadedData?.();
              });

              hls.on(Hls.Events.ERROR, (event: any, data: any) => {
                setError(`HLS Error: ${data.type} - ${data.details}`);
                onError?.(`HLS Error: ${data.type} - ${data.details}`);
              });
            }
          }
        } catch (err) {
          console.error('Failed to load HLS.js:', err);
          setError('Failed to load HLS player');
        }
      };

      loadHLS();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [enableHLS, sources, hlsConfig, onError, onLoadedData]);

  // Update video current time
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.1) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Update video volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // Update playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Video event handlers
  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setError(null);
    onLoadStart?.();
  }, [onLoadStart]);

  const handleLoadedData = useCallback(() => {
    setIsLoading(false);
    onLoadedData?.();
  }, [onLoadedData]);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
    onCanPlay?.();
  }, [onCanPlay]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setDuration(videoRef.current.duration || 0);
      setBuffered(videoRef.current.buffered.length > 0 ?
        videoRef.current.buffered.end(videoRef.current.buffered.length - 1) : 0);

      onTimeUpdate?.(time);
    }
  }, [onTimeUpdate]);

  const handleDurationChange = useCallback(() => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      setDuration(duration);
      onDurationChange?.(duration);
    }
  }, [onDurationChange]);

  const handleVolumeChange = useCallback(() => {
    if (videoRef.current) {
      onVolumeChange?.(videoRef.current.volume);
    }
  }, [onVolumeChange]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    onPlay?.();
  }, [onPlay]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    onPause?.();
  }, [onPause]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    onEnded?.();
  }, [onEnded]);

  const handleError = useCallback(() => {
    if (videoRef.current?.error) {
      const errorMsg = `Video Error: ${videoRef.current.error.code} - ${videoRef.current.error.message}`;
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [onError]);

  // Control functions
  const play = useCallback(async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.play();
      } catch (err) {
        console.error('Play failed:', err);
        setError('Failed to play video');
      }
    }
  }, []);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
    }
  }, [duration]);

  const setVolume = useCallback((vol: number) => {
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, vol));
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement && containerRef.current) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Fullscreen failed:', err);
      }
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-hide controls
  useEffect(() => {
    if (!showControls) return;

    const hideControls = () => setIsControlsVisible(false);
    const showControlsOnMove = () => setIsControlsVisible(true);

    const timeout = setTimeout(hideControls, 3000);

    const handleMouseMove = () => {
      setIsControlsVisible(true);
      clearTimeout(timeout);
      setTimeout(hideControls, 3000);
    };

    if (containerRef.current) {
      containerRef.current.addEventListener('mousemove', handleMouseMove);
      containerRef.current.addEventListener('mouseleave', hideControls);
      containerRef.current.addEventListener('mouseenter', showControlsOnMove);
    }

    return () => {
      clearTimeout(timeout);
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousemove', handleMouseMove);
        containerRef.current.removeEventListener('mouseleave', hideControls);
        containerRef.current.removeEventListener('mouseenter', showControlsOnMove);
      }
    };
  }, [showControls]);

  // Format time display
  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Calculate progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercentage = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`video-player ${isFullscreen ? 'fullscreen' : ''} ${className}`}
      style={{ width, height }}
    >
      <video
        ref={videoRef}
        className="video-player-element"
        poster={poster}
        autoPlay={autoplay}
        muted={muted}
        loop={loop}
        onLoadStart={handleLoadStart}
        onLoadedData={handleLoadedData}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onVolumeChange={handleVolumeChange}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        style={{ width: '100%', height: '100%' }}
      >
        {sources.map((source, index) => (
          <source key={index} src={source.src} type={source.type} />
        ))}
        Your browser does not support the video tag.
      </video>

      {/* Loading indicator */}
      {isLoading && (
        <div className="video-player-loading">
          <div className="loading-spinner" />
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="video-player-error">
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* Custom Controls */}
      {controls && isControlsVisible && (
        <div className="video-player-controls">
          {/* Progress Bar */}
          <div className="progress-container">
            <div
              className="progress-bar"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                seekTo(pos * duration);
              }}
            >
              <div
                className="progress-buffered"
                style={{ width: `${bufferedPercentage}%` }}
              />
              <div
                className="progress-played"
                style={{ width: `${progressPercentage}%` }}
              />
              <div
                className="progress-handle"
                style={{ left: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="controls-row">
            <div className="controls-left">
              <button
                className="control-button play-pause"
                onClick={togglePlayPause}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              <button
                className="control-button"
                onClick={() => seekTo(Math.max(0, currentTime - 10))}
                title="Rewind 10s"
              >
                ⏪
              </button>

              <button
                className="control-button"
                onClick={() => seekTo(Math.min(duration, currentTime + 10))}
                title="Forward 10s"
              >
                ⏩
              </button>

              <button
                className="control-button"
                onClick={toggleMute}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? '🔇' : '🔊'}
              </button>

              <div className="volume-control">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="volume-slider"
                />
              </div>
            </div>

            <div className="controls-center">
              <span className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="controls-right">
              <div className="playback-rate-control">
                <select
                  value={playbackRate}
                  onChange={(e) => {/* implement playback rate change */}}
                  className="rate-selector"
                >
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>

              <button
                className="control-button"
                onClick={toggleFullscreen}
                title="Toggle Fullscreen"
              >
                {isFullscreen ? '🪟' : '⛶'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click overlay for play/pause */}
      <div
        className="video-player-overlay"
        onClick={togglePlayPause}
        onDoubleClick={toggleFullscreen}
      >
        {!isPlaying && !isLoading && !error && (
          <div className="play-overlay">
            <div className="play-button-large">▶</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
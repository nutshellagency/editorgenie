/**
 * Timeline Performance Optimization Service
 *
 * Provides performance optimizations for timeline rendering and interactions:
 * - Virtualization for large timelines
 * - Memoization of expensive calculations
 * - Debounced updates and interactions
 * - Memory management and cleanup
 * - Canvas rendering optimizations
 */

import { TimelineState, TimelineSegment, TimelineTrack } from '../../core/timeline/models';

export interface VirtualizationConfig {
  enabled: boolean;
  viewportBuffer: number; // Extra segments to render outside viewport
  segmentHeight: number;
  containerHeight: number;
}

export interface PerformanceMetrics {
  renderTime: number;
  updateTime: number;
  memoryUsage: number;
  visibleSegments: number;
  totalSegments: number;
}

export interface TimelineViewport {
  startTime: number;
  endTime: number;
  startY: number;
  endY: number;
}

export class TimelinePerformanceOptimizer {
  private cache = new Map<string, any>();
  private renderCache = new Map<string, any>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private virtualizationConfig: VirtualizationConfig;
  private metrics: PerformanceMetrics;
  private observers: ResizeObserver[] = [];

  constructor(config: Partial<VirtualizationConfig> = {}) {
    this.virtualizationConfig = {
      enabled: true,
      viewportBuffer: 50,
      segmentHeight: 60,
      containerHeight: 600,
      ...config
    };

    this.metrics = {
      renderTime: 0,
      updateTime: 0,
      memoryUsage: 0,
      visibleSegments: 0,
      totalSegments: 0
    };
  }

  /**
   * Get visible segments within viewport for virtualization
   */
  getVisibleSegments(
    timelineState: TimelineState,
    viewport: TimelineViewport,
    tracks: TimelineTrack[]
  ): TimelineSegment[] {
    const cacheKey = `visible-${viewport.startTime}-${viewport.endTime}-${tracks.length}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const visibleSegments: TimelineSegment[] = [];

    for (const track of tracks) {
      for (const segment of track.segments) {
        // Check if segment overlaps with viewport time range
        const segmentStart = segment.startTime;
        const segmentEnd = segment.endTime;
        const viewportStart = viewport.startTime;
        const viewportEnd = viewport.endTime;

        if (segmentEnd > viewportStart && segmentStart < viewportEnd) {
          visibleSegments.push(segment);
        }
      }
    }

    // Cache result for 100ms
    this.cache.set(cacheKey, visibleSegments);
    setTimeout(() => this.cache.delete(cacheKey), 100);

    this.metrics.visibleSegments = visibleSegments.length;
    this.metrics.totalSegments = tracks.reduce((sum, track) => sum + track.segments.length, 0);

    return visibleSegments;
  }

  /**
   * Memoized calculation of segment positions
   */
  calculateSegmentPositions(segments: TimelineSegment[], trackHeight: number) {
    const cacheKey = `positions-${segments.length}-${trackHeight}`;

    if (this.renderCache.has(cacheKey)) {
      return this.renderCache.get(cacheKey);
    }

    const positions = segments.map((segment, index) => ({
      id: segment.id,
      x: segment.startTime,
      y: index * trackHeight,
      width: segment.endTime - segment.startTime,
      height: trackHeight - 2,
      segment
    }));

    // Cache for longer duration (500ms)
    this.renderCache.set(cacheKey, positions);
    setTimeout(() => this.renderCache.delete(cacheKey), 500);

    return positions;
  }

  /**
   * Debounced timeline update
   */
  debouncedUpdate(key: string, callback: () => void, delay: number = 100) {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      const startTime = performance.now();
      callback();
      this.metrics.updateTime = performance.now() - startTime;
      this.debounceTimers.delete(key);
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Optimized canvas rendering with caching
   */
  renderCanvas(
    ctx: CanvasRenderingContext2D,
    segments: TimelineSegment[],
    width: number,
    height: number,
    pixelRatio: number = window.devicePixelRatio
  ): void {
    const startTime = performance.now();

    // Set up high DPI rendering
    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, width / pixelRatio, height / pixelRatio);

    // Render segments in batches for better performance
    const batchSize = 100;
    for (let i = 0; i < segments.length; i += batchSize) {
      const batch = segments.slice(i, i + batchSize);
      this.renderSegmentBatch(ctx, batch, width / pixelRatio, height / pixelRatio);
    }

    ctx.restore();

    this.metrics.renderTime = performance.now() - startTime;
  }

  /**
   * Render a batch of segments efficiently
   */
  private renderSegmentBatch(
    ctx: CanvasRenderingContext2D,
    segments: TimelineSegment[],
    width: number,
    height: number
  ): void {
    segments.forEach(segment => {
      const x = (segment.startTime / 100) * width; // Assuming 100px per second
      const segmentWidth = ((segment.endTime - segment.startTime) / 100) * width;
      const y = 0; // Will be calculated based on track position

      // Use Path2D for efficient rendering
      const path = new Path2D();
      path.rect(x, y, segmentWidth, 30);

      // Fill with segment color
      ctx.fillStyle = segment.selected ? '#4A90E2' : '#E1E5E9';
      ctx.fill(path);

      // Stroke
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke(path);
    });
  }

  /**
   * Memory management - clean up caches and resources
   */
  cleanup(): void {
    // Clear all caches
    this.cache.clear();
    this.renderCache.clear();

    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    // Disconnect observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    // Update memory usage estimate
    this.metrics.memoryUsage = this.estimateMemoryUsage();

    return { ...this.metrics };
  }

  /**
   * Estimate memory usage of caches and data structures
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    // Estimate cache sizes
    this.cache.forEach((value, key) => {
      totalSize += key.length * 2 + JSON.stringify(value).length * 2;
    });

    this.renderCache.forEach((value, key) => {
      totalSize += key.length * 2 + JSON.stringify(value).length * 2;
    });

    return totalSize;
  }

  /**
   * Set up performance monitoring for a container
   */
  setupPerformanceMonitoring(container: HTMLElement): void {
    // Monitor container size changes
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.handleContainerResize(width, height);
      }
    });

    resizeObserver.observe(container);
    this.observers.push(resizeObserver);

    // Monitor performance
    this.startPerformanceMonitoring();
  }

  /**
   * Handle container resize events
   */
  private handleContainerResize(width: number, height: number): void {
    this.virtualizationConfig.containerHeight = height;

    // Trigger debounced layout update
    this.debouncedUpdate('resize', () => {
      // Layout update logic would go here
      console.log(`Container resized to ${width}x${height}`);
    }, 150);
  }

  /**
   * Start continuous performance monitoring
   */
  private startPerformanceMonitoring(): void {
    const monitorInterval = setInterval(() => {
      const metrics = this.getMetrics();

      // Log performance warnings
      if (metrics.renderTime > 16) { // More than one frame at 60fps
        console.warn(`Slow render time: ${metrics.renderTime.toFixed(2)}ms`);
      }

      if (metrics.memoryUsage > 50 * 1024 * 1024) { // More than 50MB
        console.warn(`High memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
        this.cleanup();
      }
    }, 5000);

    // Store interval for cleanup
    (this as any).monitorInterval = monitorInterval;
  }

  /**
   * Stop performance monitoring
   */
  stopPerformanceMonitoring(): void {
    if ((this as any).monitorInterval) {
      clearInterval((this as any).monitorInterval);
      (this as any).monitorInterval = null;
    }
  }

  /**
   * Preload and cache timeline data for smooth scrolling
   */
  preloadTimelineData(
    timelineState: TimelineState,
    centerTime: number,
    preloadRange: number = 30
  ): void {
    const startTime = centerTime - preloadRange;
    const endTime = centerTime + preloadRange;

    // Pre-calculate positions for segments in range
    for (const track of timelineState.tracks) {
      const segmentsInRange = track.segments.filter(
        segment => segment.startTime < endTime && segment.endTime > startTime
      );

      if (segmentsInRange.length > 0) {
        this.calculateSegmentPositions(segmentsInRange, this.virtualizationConfig.segmentHeight);
      }
    }
  }

  /**
   * Optimize segment updates using spatial indexing
   */
  createSpatialIndex(segments: TimelineSegment[]): Map<number, TimelineSegment[]> {
    const index = new Map<number, TimelineSegment[]>();
    const bucketSize = 10; // 10 second buckets

    segments.forEach(segment => {
      const bucket = Math.floor(segment.startTime / bucketSize) * bucketSize;

      if (!index.has(bucket)) {
        index.set(bucket, []);
      }

      index.get(bucket)!.push(segment);
    });

    return index;
  }

  /**
   * Update virtualization configuration
   */
  updateVirtualizationConfig(config: Partial<VirtualizationConfig>): void {
    this.virtualizationConfig = { ...this.virtualizationConfig, ...config };
  }
}

// Singleton instance
export const timelinePerformanceOptimizer = new TimelinePerformanceOptimizer();
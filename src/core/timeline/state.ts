/**
 * Timeline state management system.
 *
 * This module provides comprehensive state management for timeline functionality
 * including playback, selection, viewport, and undo/redo operations.
 */

import { TimelineState, TimelineSegment, TimelineTrack } from './models';

export interface TimelineStateUpdate {
  type: 'segment' | 'track' | 'playback' | 'selection' | 'viewport';
  operation: 'add' | 'update' | 'delete' | 'move' | 'resize';
  targetId: string;
  data?: any;
  timestamp: number;
}

export interface TimelineEvent {
  type: string;
  payload: any;
  timestamp: number;
}

export class TimelineStateManager {
  private currentState: TimelineState;
  private history: TimelineState[] = [];
  private historyIndex: number = -1;
  private maxHistorySize: number = 50;
  private eventListeners: Map<string, Function[]> = new Map();
  private isUpdating: boolean = false;

  constructor(initialState: TimelineState) {
    this.currentState = JSON.parse(JSON.stringify(initialState));
    this.saveToHistory();
  }

  /**
   * Get the current timeline state.
   */
  getState(): TimelineState {
    return JSON.parse(JSON.stringify(this.currentState));
  }

  /**
   * Update the timeline state with validation.
   */
  async updateState(newState: TimelineState): Promise<void> {
    if (this.isUpdating) {
      throw new Error('State update already in progress');
    }

    this.isUpdating = true;

    try {
      // Validate state
      this.validateState(newState);

      // Store current state for undo
      const previousState = JSON.parse(JSON.stringify(this.currentState));

      // Update state
      this.currentState = JSON.parse(JSON.stringify(newState));

      // Save to history
      this.saveToHistory();

      // Emit state change event
      this.emitEvent('stateChanged', {
        previousState,
        newState: this.currentState,
        timestamp: Date.now()
      });

    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Add a segment to a track.
   */
  async addSegment(trackId: string, segment: TimelineSegment): Promise<void> {
    const newState = JSON.parse(JSON.stringify(this.currentState));

    const track = newState.tracks.find(t => t.id === trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }

    // Validate segment doesn't overlap with existing segments
    this.validateSegmentOverlap(track.segments, segment);

    // Add segment
    track.segments.push(segment);

    // Sort segments by start time
    track.segments.sort((a, b) => a.startTime - b.startTime);

    await this.updateState(newState);
  }

  /**
   * Update a segment.
   */
  async updateSegment(segmentId: string, updates: Partial<TimelineSegment>): Promise<void> {
    const newState = JSON.parse(JSON.stringify(this.currentState));

    let updated = false;
    for (const track of newState.tracks) {
      const segmentIndex = track.segments.findIndex(s => s.id === segmentId);
      if (segmentIndex !== -1) {
        // Validate update doesn't create overlaps
        const updatedSegment = { ...track.segments[segmentIndex], ...updates };
        const otherSegments = track.segments.filter(s => s.id !== segmentId);
        this.validateSegmentOverlap(otherSegments, updatedSegment);

        // Apply updates
        track.segments[segmentIndex] = updatedSegment;
        updated = true;
        break;
      }
    }

    if (!updated) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    await this.updateState(newState);
  }

  /**
   * Delete a segment.
   */
  async deleteSegment(segmentId: string): Promise<void> {
    const newState = JSON.parse(JSON.stringify(this.currentState));

    let deleted = false;
    for (const track of newState.tracks) {
      const segmentIndex = track.segments.findIndex(s => s.id === segmentId);
      if (segmentIndex !== -1) {
        track.segments.splice(segmentIndex, 1);
        deleted = true;
        break;
      }
    }

    if (!deleted) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    await this.updateState(newState);
  }

  /**
   * Move segments to a new time position.
   */
  async moveSegments(segmentIds: string[], newStartTime: number): Promise<void> {
    const newState = JSON.parse(JSON.stringify(this.currentState));

    // Calculate time offset
    const segments = this.getSegmentsByIds(segmentIds);
    if (segments.length === 0) {
      throw new Error('No segments found for move operation');
    }

    const minStartTime = Math.min(...segments.map(s => s.startTime));
    const timeOffset = newStartTime - minStartTime;

    // Update all segments
    for (const track of newState.tracks) {
      track.segments.forEach(segment => {
        if (segmentIds.includes(segment.id)) {
          segment.startTime += timeOffset;
          segment.endTime += timeOffset;
        }
      });
    }

    await this.updateState(newState);
  }

  /**
   * Resize a segment.
   */
  async resizeSegment(segmentId: string, newStartTime?: number, newEndTime?: number): Promise<void> {
    const updates: Partial<TimelineSegment> = {};

    if (newStartTime !== undefined) {
      updates.startTime = newStartTime;
    }

    if (newEndTime !== undefined) {
      updates.endTime = newEndTime;
      updates.duration = newEndTime - (updates.startTime ?? this.getSegmentById(segmentId)?.startTime ?? 0);
    }

    await this.updateSegment(segmentId, updates);
  }

  /**
   * Select segments.
   */
  async selectSegments(segmentIds: string[]): Promise<void> {
    const newState = JSON.parse(JSON.stringify(this.currentState));

    // Clear all selections first
    for (const track of newState.tracks) {
      track.segments.forEach(segment => {
        segment.selected = false;
      });
    }

    // Select specified segments
    for (const track of newState.tracks) {
      track.segments.forEach(segment => {
        if (segmentIds.includes(segment.id)) {
          segment.selected = true;
        }
      });
    }

    await this.updateState(newState);
  }

  /**
   * Update playback state.
   */
  async updatePlayback(isPlaying: boolean, currentTime?: number): Promise<void> {
    const newState = JSON.parse(JSON.stringify(this.currentState));

    newState.isPlaying = isPlaying;
    if (currentTime !== undefined) {
      newState.currentTime = currentTime;
    }

    await this.updateState(newState);
  }

  /**
   * Update viewport settings.
   */
  async updateViewport(startTime: number, endTime: number, zoom?: number): Promise<void> {
    const newState = JSON.parse(JSON.stringify(this.currentState));

    newState.viewportStart = startTime;
    newState.viewportEnd = endTime;
    if (zoom !== undefined) {
      newState.zoom = zoom;
    }

    await this.updateState(newState);
  }

  /**
   * Undo the last operation.
   */
  async undo(): Promise<TimelineState> {
    if (!this.canUndo()) {
      throw new Error('No operations to undo');
    }

    this.historyIndex--;
    this.currentState = JSON.parse(JSON.stringify(this.history[this.historyIndex]));

    this.emitEvent('stateChanged', {
      previousState: this.historyIndex > 0 ? this.history[this.historyIndex - 1] : null,
      newState: this.currentState,
      timestamp: Date.now(),
      operation: 'undo'
    });

    return this.currentState;
  }

  /**
   * Redo the last undone operation.
   */
  async redo(): Promise<TimelineState> {
    if (!this.canRedo()) {
      throw new Error('No operations to redo');
    }

    this.historyIndex++;
    this.currentState = JSON.parse(JSON.stringify(this.history[this.historyIndex]));

    this.emitEvent('stateChanged', {
      previousState: this.history[this.historyIndex - 1],
      newState: this.currentState,
      timestamp: Date.now(),
      operation: 'redo'
    });

    return this.currentState;
  }

  /**
   * Check if undo is available.
   */
  canUndo(): boolean {
    return this.historyIndex > 0;
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Add an event listener.
   */
  addEventListener(eventType: string, listener: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * Remove an event listener.
   */
  removeEventListener(eventType: string, listener: Function): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get a segment by ID.
   */
  private getSegmentById(segmentId: string): TimelineSegment | null {
    for (const track of this.currentState.tracks) {
      const segment = track.segments.find(s => s.id === segmentId);
      if (segment) {
        return segment;
      }
    }
    return null;
  }

  /**
   * Get segments by IDs.
   */
  private getSegmentsByIds(segmentIds: string[]): TimelineSegment[] {
    const segments: TimelineSegment[] = [];
    for (const track of this.currentState.tracks) {
      track.segments.forEach(segment => {
        if (segmentIds.includes(segment.id)) {
          segments.push(segment);
        }
      });
    }
    return segments;
  }

  /**
   * Validate timeline state.
   */
  private validateState(state: TimelineState): void {
    if (!state.tracks || !Array.isArray(state.tracks)) {
      throw new Error('Invalid timeline state: tracks must be an array');
    }

    // Validate each track
    state.tracks.forEach(track => {
      if (!track.id || !track.segments) {
        throw new Error('Invalid track: missing id or segments');
      }

      // Validate segments
      track.segments.forEach(segment => {
        if (segment.startTime >= segment.endTime) {
          throw new Error(`Invalid segment ${segment.id}: start time must be before end time`);
        }
      });

      // Check for overlaps within track
      for (let i = 0; i < track.segments.length; i++) {
        for (let j = i + 1; j < track.segments.length; j++) {
          const seg1 = track.segments[i];
          const seg2 = track.segments[j];
          if (seg1.startTime < seg2.endTime && seg2.startTime < seg1.endTime) {
            throw new Error(`Overlapping segments detected: ${seg1.id} and ${seg2.id}`);
          }
        }
      }
    });
  }

  /**
   * Validate segment doesn't overlap with existing segments.
   */
  private validateSegmentOverlap(existingSegments: TimelineSegment[], newSegment: TimelineSegment): void {
    existingSegments.forEach(segment => {
      if (segment.id !== newSegment.id &&
          segment.startTime < newSegment.endTime &&
          newSegment.startTime < segment.endTime) {
        throw new Error(`Segment overlap detected: ${segment.id} and ${newSegment.id}`);
      }
    });
  }

  /**
   * Save current state to history.
   */
  private saveToHistory(): void {
    // Remove any states after current index (when new operation after undo)
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add current state
    this.history.push(JSON.parse(JSON.stringify(this.currentState)));
    this.historyIndex++;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
      this.historyIndex = Math.min(this.historyIndex, this.maxHistorySize - 1);
    }
  }

  /**
   * Emit an event to all listeners.
   */
  private emitEvent(eventType: string, payload: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }
}

export default TimelineStateManager;
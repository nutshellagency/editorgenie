/**
 * EditControlsManager handles all timeline editing operations.
 *
 * This class provides comprehensive edit functionality including cut, copy, paste,
 * delete, trim, and split operations with full validation and state management.
 */

import { TimelineSegment, TimelineTrack, TimelineState } from '../../core/timeline/models';
import { TimelineStateManager } from '../../core/timeline/state';

export interface EditOperation {
  type: 'cut' | 'copy' | 'paste' | 'delete' | 'trim_start' | 'trim_end' | 'split';
  segments: TimelineSegment[];
  timestamp: number;
  previousState?: TimelineState;
  newState?: TimelineState;
}

export class EditControlsManager {
  private stateManager: TimelineStateManager;
  private currentState: TimelineState;
  private history: EditOperation[] = [];
  private historyIndex: number = -1;
  private maxHistorySize: number = 50;

  constructor(stateManager: TimelineStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Initialize the edit controls manager with the current timeline state.
   */
  initialize(state: TimelineState): void {
    this.currentState = JSON.parse(JSON.stringify(state)); // Deep copy
  }

  /**
   * Cut selected segments and add to clipboard.
   */
  async cutSegments(segments: TimelineSegment[]): Promise<TimelineSegment[]> {
    if (segments.length === 0) {
      throw new Error('No segments provided for cut operation');
    }

    // Validate segments exist in timeline
    this.validateSegments(segments);

    // Store current state for undo
    const previousState = JSON.parse(JSON.stringify(this.currentState));

    // Create copies of segments for clipboard
    const cutSegments = segments.map(segment => ({
      ...segment,
      id: `cut_${segment.id}_${Date.now()}`,
      selected: false
    }));

    // Remove segments from timeline
    this.currentState.tracks.forEach(track => {
      track.segments = track.segments.filter(segment =>
        !segments.some(s => s.id === segment.id)
      );
    });

    // Create and store operation
    const operation: EditOperation = {
      type: 'cut',
      segments: cutSegments,
      timestamp: Date.now(),
      previousState,
      newState: JSON.parse(JSON.stringify(this.currentState))
    };

    this.addToHistory(operation);

    // Update state manager
    await this.stateManager.updateState(this.currentState);

    return cutSegments;
  }

  /**
   * Copy selected segments to clipboard.
   */
  async copySegments(segments: TimelineSegment[]): Promise<TimelineSegment[]> {
    if (segments.length === 0) {
      throw new Error('No segments provided for copy operation');
    }

    // Validate segments exist in timeline
    this.validateSegments(segments);

    // Create copies of segments for clipboard
    const copiedSegments = segments.map(segment => ({
      ...segment,
      id: `copy_${segment.id}_${Date.now()}`,
      selected: false
    }));

    return copiedSegments;
  }

  /**
   * Paste segments from clipboard at specified time.
   */
  async pasteSegments(segments: TimelineSegment[], targetTime: number): Promise<TimelineSegment[]> {
    if (segments.length === 0) {
      throw new Error('No segments provided for paste operation');
    }

    if (targetTime < 0) {
      throw new Error('Invalid target time for paste operation');
    }

    // Store current state for undo
    const previousState = JSON.parse(JSON.stringify(this.currentState));

    // Calculate time offset for paste
    const timeOffset = targetTime - Math.min(...segments.map(s => s.startTime));

    // Create new segments with updated timing
    const pastedSegments = segments.map(segment => ({
      ...segment,
      id: `pasted_${segment.id}_${Date.now()}`,
      startTime: segment.startTime + timeOffset,
      endTime: segment.endTime + timeOffset,
      selected: false
    }));

    // Validate no overlaps with existing segments
    this.validateNoOverlaps(pastedSegments);

    // Add segments to appropriate tracks
    pastedSegments.forEach(segment => {
      const targetTrack = this.findOrCreateTrackForSegment(segment);
      targetTrack.segments.push(segment);
    });

    // Sort segments in each track
    this.currentState.tracks.forEach(track => {
      track.segments.sort((a, b) => a.startTime - b.startTime);
    });

    // Create and store operation
    const operation: EditOperation = {
      type: 'paste',
      segments: pastedSegments,
      timestamp: Date.now(),
      previousState,
      newState: JSON.parse(JSON.stringify(this.currentState))
    };

    this.addToHistory(operation);

    // Update state manager
    await this.stateManager.updateState(this.currentState);

    return pastedSegments;
  }

  /**
   * Delete selected segments.
   */
  async deleteSegments(segments: TimelineSegment[]): Promise<void> {
    if (segments.length === 0) {
      throw new Error('No segments provided for delete operation');
    }

    // Validate segments exist in timeline
    this.validateSegments(segments);

    // Store current state for undo
    const previousState = JSON.parse(JSON.stringify(this.currentState));

    // Remove segments from timeline
    this.currentState.tracks.forEach(track => {
      track.segments = track.segments.filter(segment =>
        !segments.some(s => s.id === segment.id)
      );
    });

    // Create and store operation
    const operation: EditOperation = {
      type: 'delete',
      segments: [...segments],
      timestamp: Date.now(),
      previousState,
      newState: JSON.parse(JSON.stringify(this.currentState))
    };

    this.addToHistory(operation);

    // Update state manager
    await this.stateManager.updateState(this.currentState);
  }

  /**
   * Trim start of a segment.
   */
  async trimStart(segment: TimelineSegment, trimTime: number): Promise<TimelineSegment> {
    if (trimTime <= segment.startTime || trimTime >= segment.endTime) {
      throw new Error('Invalid trim time for start trim operation');
    }

    // Store current state for undo
    const previousState = JSON.parse(JSON.stringify(this.currentState));

    // Find and update the segment
    let trimmedSegment: TimelineSegment | null = null;

    this.currentState.tracks.forEach(track => {
      const index = track.segments.findIndex(s => s.id === segment.id);
      if (index !== -1) {
        const originalSegment = track.segments[index];
        trimmedSegment = {
          ...originalSegment,
          id: `trimmed_${originalSegment.id}_${Date.now()}`,
          startTime: trimTime,
          duration: originalSegment.endTime - trimTime
        };

        // Replace the segment
        track.segments[index] = trimmedSegment;
      }
    });

    if (!trimmedSegment) {
      throw new Error('Segment not found for trim operation');
    }

    // Create and store operation
    const operation: EditOperation = {
      type: 'trim_start',
      segments: [trimmedSegment],
      timestamp: Date.now(),
      previousState,
      newState: JSON.parse(JSON.stringify(this.currentState))
    };

    this.addToHistory(operation);

    // Update state manager
    await this.stateManager.updateState(this.currentState);

    return trimmedSegment;
  }

  /**
   * Trim end of a segment.
   */
  async trimEnd(segment: TimelineSegment, trimTime: number): Promise<TimelineSegment> {
    if (trimTime <= segment.startTime || trimTime >= segment.endTime) {
      throw new Error('Invalid trim time for end trim operation');
    }

    // Store current state for undo
    const previousState = JSON.parse(JSON.stringify(this.currentState));

    // Find and update the segment
    let trimmedSegment: TimelineSegment | null = null;

    this.currentState.tracks.forEach(track => {
      const index = track.segments.findIndex(s => s.id === segment.id);
      if (index !== -1) {
        const originalSegment = track.segments[index];
        trimmedSegment = {
          ...originalSegment,
          id: `trimmed_${originalSegment.id}_${Date.now()}`,
          endTime: trimTime,
          duration: trimTime - originalSegment.startTime
        };

        // Replace the segment
        track.segments[index] = trimmedSegment;
      }
    });

    if (!trimmedSegment) {
      throw new Error('Segment not found for trim operation');
    }

    // Create and store operation
    const operation: EditOperation = {
      type: 'trim_end',
      segments: [trimmedSegment],
      timestamp: Date.now(),
      previousState,
      newState: JSON.parse(JSON.stringify(this.currentState))
    };

    this.addToHistory(operation);

    // Update state manager
    await this.stateManager.updateState(this.currentState);

    return trimmedSegment;
  }

  /**
   * Split a segment at specified time.
   */
  async splitSegment(segment: TimelineSegment, splitTime: number): Promise<TimelineSegment[]> {
    if (splitTime <= segment.startTime || splitTime >= segment.endTime) {
      throw new Error('Invalid split time for split operation');
    }

    // Store current state for undo
    const previousState = JSON.parse(JSON.stringify(this.currentState));

    // Find the segment and split it
    const splitSegments: TimelineSegment[] = [];

    this.currentState.tracks.forEach(track => {
      const index = track.segments.findIndex(s => s.id === segment.id);
      if (index !== -1) {
        const originalSegment = track.segments[index];

        // Create first segment
        const firstSegment: TimelineSegment = {
          ...originalSegment,
          id: `split1_${originalSegment.id}_${Date.now()}`,
          endTime: splitTime,
          duration: splitTime - originalSegment.startTime
        };

        // Create second segment
        const secondSegment: TimelineSegment = {
          ...originalSegment,
          id: `split2_${originalSegment.id}_${Date.now()}`,
          startTime: splitTime,
          duration: originalSegment.endTime - splitTime
        };

        // Replace original with split segments
        track.segments.splice(index, 1, firstSegment, secondSegment);
        splitSegments.push(firstSegment, secondSegment);
      }
    });

    if (splitSegments.length === 0) {
      throw new Error('Segment not found for split operation');
    }

    // Create and store operation
    const operation: EditOperation = {
      type: 'split',
      segments: splitSegments,
      timestamp: Date.now(),
      previousState,
      newState: JSON.parse(JSON.stringify(this.currentState))
    };

    this.addToHistory(operation);

    // Update state manager
    await this.stateManager.updateState(this.currentState);

    return splitSegments;
  }

  /**
   * Undo the last operation.
   */
  async undo(): Promise<TimelineSegment[]> {
    if (!this.canUndo()) {
      throw new Error('No operations to undo');
    }

    const operation = this.history[this.historyIndex];
    this.historyIndex--;

    if (operation.previousState) {
      this.currentState = JSON.parse(JSON.stringify(operation.previousState));
      await this.stateManager.updateState(this.currentState);
    }

    return operation.segments;
  }

  /**
   * Redo the last undone operation.
   */
  async redo(): Promise<TimelineSegment[]> {
    if (!this.canRedo()) {
      throw new Error('No operations to redo');
    }

    this.historyIndex++;
    const operation = this.history[this.historyIndex];

    if (operation.newState) {
      this.currentState = JSON.parse(JSON.stringify(operation.newState));
      await this.stateManager.updateState(this.currentState);
    }

    return operation.segments;
  }

  /**
   * Check if undo is available.
   */
  canUndo(): boolean {
    return this.historyIndex >= 0;
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Get current state.
   */
  getCurrentState(): TimelineState {
    return JSON.parse(JSON.stringify(this.currentState));
  }

  /**
   * Validate that segments exist in timeline.
   */
  private validateSegments(segments: TimelineSegment[]): void {
    segments.forEach(segment => {
      const exists = this.currentState.tracks.some(track =>
        track.segments.some(s => s.id === segment.id)
      );

      if (!exists) {
        throw new Error(`Segment ${segment.id} not found in timeline`);
      }
    });
  }

  /**
   * Validate no overlaps with new segments.
   */
  private validateNoOverlaps(newSegments: TimelineSegment[]): void {
    this.currentState.tracks.forEach(track => {
      track.segments.forEach(existingSegment => {
        newSegments.forEach(newSegment => {
          if (this.segmentsOverlap(existingSegment, newSegment)) {
            throw new Error(`Segment overlap detected between ${existingSegment.id} and ${newSegment.id}`);
          }
        });
      });
    });
  }

  /**
   * Check if two segments overlap.
   */
  private segmentsOverlap(segment1: TimelineSegment, segment2: TimelineSegment): boolean {
    return segment1.startTime < segment2.endTime && segment2.startTime < segment1.endTime;
  }

  /**
   * Find or create appropriate track for a segment.
   */
  private findOrCreateTrackForSegment(segment: TimelineSegment): TimelineTrack {
    // For now, find the first available track or create a new one
    let targetTrack = this.currentState.tracks.find(track =>
      track.type === 'video' || track.type === 'audio'
    );

    if (!targetTrack) {
      targetTrack = {
        id: `track_${Date.now()}`,
        name: `Track ${this.currentState.tracks.length + 1}`,
        type: 'video',
        segments: [],
        muted: false,
        volume: 1.0,
        visible: true
      };
      this.currentState.tracks.push(targetTrack);
    }

    return targetTrack;
  }

  /**
   * Add operation to history.
   */
  private addToHistory(operation: EditOperation): void {
    // Remove any operations after current index (when new operation after undo)
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add new operation
    this.history.push(operation);
    this.historyIndex++;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
      this.historyIndex = Math.min(this.historyIndex, this.maxHistorySize - 1);
    }
  }
}

export default EditControlsManager;
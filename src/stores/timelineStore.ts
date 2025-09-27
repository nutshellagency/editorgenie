/**
 * Timeline store for managing timeline state and operations.
 *
 * This store provides centralized state management for timeline functionality
 * including segments, tracks, playback, and edit operations.
 */

import { create } from 'zustand';
import { TimelineState, TimelineSegment, TimelineTrack } from '../core/timeline/models';
import { TimelineStateManager } from '../core/timeline/state';

interface TimelineStore {
  // State
  timelineState: TimelineState | null;
  selectedSegments: TimelineSegment[];
  clipboard: TimelineSegment[];
  isEditing: boolean;
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setTimelineState: (state: TimelineState) => void;
  updateSelectedSegments: (segments: TimelineSegment[]) => void;
  setClipboard: (segments: TimelineSegment[]) => void;
  setIsEditing: (editing: boolean) => void;
  setCanUndo: (canUndo: boolean) => void;
  setCanRedo: (canRedo: boolean) => void;

  // Complex actions
  selectSegment: (segment: TimelineSegment) => void;
  selectSegments: (segments: TimelineSegment[]) => void;
  clearSelection: () => void;
  cutSegments: (segments: TimelineSegment[]) => Promise<void>;
  copySegments: (segments: TimelineSegment[]) => Promise<void>;
  pasteSegments: (targetTime: number) => Promise<void>;
  deleteSegments: (segments: TimelineSegment[]) => Promise<void>;
  trimSegment: (segment: TimelineSegment, startTime?: number, endTime?: number) => Promise<void>;
  splitSegment: (segment: TimelineSegment, splitTime: number) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export const useTimelineStore = create<TimelineStore>((set, get) => ({
  // Initial state
  timelineState: null,
  selectedSegments: [],
  clipboard: [],
  isEditing: false,
  canUndo: false,
  canRedo: false,

  // Basic setters
  setTimelineState: (state) => set({ timelineState: state }),
  updateSelectedSegments: (segments) => set({ selectedSegments: segments }),
  setClipboard: (segments) => set({ clipboard: segments }),
  setIsEditing: (editing) => set({ isEditing: editing }),
  setCanUndo: (canUndo) => set({ canUndo }),
  setCanRedo: (canRedo) => set({ canRedo }),

  // Complex actions
  selectSegment: (segment) => {
    const { timelineState } = get();
    if (!timelineState) return;

    // Clear previous selections
    timelineState.tracks.forEach(track => {
      track.segments.forEach(s => {
        s.selected = s.id === segment.id;
      });
    });

    set({
      timelineState: { ...timelineState },
      selectedSegments: [segment]
    });
  },

  selectSegments: (segments) => {
    const { timelineState } = get();
    if (!timelineState) return;

    // Clear previous selections
    timelineState.tracks.forEach(track => {
      track.segments.forEach(s => {
        s.selected = segments.some(selected => selected.id === s.id);
      });
    });

    set({
      timelineState: { ...timelineState },
      selectedSegments: segments
    });
  },

  clearSelection: () => {
    const { timelineState } = get();
    if (!timelineState) return;

    timelineState.tracks.forEach(track => {
      track.segments.forEach(s => {
        s.selected = false;
      });
    });

    set({
      timelineState: { ...timelineState },
      selectedSegments: []
    });
  },

  cutSegments: async (segments) => {
    const { timelineState } = get();
    if (!timelineState) return;

    set({ isEditing: true });

    try {
      // Create copies for clipboard
      const cutSegments = segments.map(segment => ({
        ...segment,
        id: `cut_${segment.id}_${Date.now()}`,
        selected: false
      }));

      // Remove from timeline
      timelineState.tracks.forEach(track => {
        track.segments = track.segments.filter(s =>
          !segments.some(segment => segment.id === s.id)
        );
      });

      set({
        timelineState: { ...timelineState },
        clipboard: cutSegments,
        selectedSegments: []
      });
    } finally {
      set({ isEditing: false });
    }
  },

  copySegments: async (segments) => {
    const copiedSegments = segments.map(segment => ({
      ...segment,
      id: `copy_${segment.id}_${Date.now()}`,
      selected: false
    }));

    set({ clipboard: copiedSegments });
  },

  pasteSegments: async (targetTime) => {
    const { timelineState, clipboard } = get();
    if (!timelineState || clipboard.length === 0) return;

    set({ isEditing: true });

    try {
      const timeOffset = targetTime - Math.min(...clipboard.map(s => s.startTime));

      const pastedSegments = clipboard.map(segment => ({
        ...segment,
        id: `pasted_${segment.id}_${Date.now()}`,
        startTime: segment.startTime + timeOffset,
        endTime: segment.endTime + timeOffset,
        selected: false
      }));

      // Add to appropriate tracks
      pastedSegments.forEach(segment => {
        let targetTrack = timelineState.tracks.find(track =>
          track.type === 'video' || track.type === 'audio'
        );

        if (!targetTrack) {
          targetTrack = {
            id: `track_${Date.now()}`,
            name: `Track ${timelineState.tracks.length + 1}`,
            type: 'video',
            segments: [],
            muted: false,
            volume: 1.0,
            visible: true
          };
          timelineState.tracks.push(targetTrack);
        }

        targetTrack.segments.push(segment);
      });

      // Sort segments
      timelineState.tracks.forEach(track => {
        track.segments.sort((a, b) => a.startTime - b.startTime);
      });

      set({ timelineState: { ...timelineState } });
    } finally {
      set({ isEditing: false });
    }
  },

  deleteSegments: async (segments) => {
    const { timelineState } = get();
    if (!timelineState) return;

    set({ isEditing: true });

    try {
      timelineState.tracks.forEach(track => {
        track.segments = track.segments.filter(s =>
          !segments.some(segment => segment.id === s.id)
        );
      });

      set({
        timelineState: { ...timelineState },
        selectedSegments: []
      });
    } finally {
      set({ isEditing: false });
    }
  },

  trimSegment: async (segment, startTime, endTime) => {
    const { timelineState } = get();
    if (!timelineState) return;

    set({ isEditing: true });

    try {
      let trimmedSegment: TimelineSegment | null = null;

      timelineState.tracks.forEach(track => {
        const index = track.segments.findIndex(s => s.id === segment.id);
        if (index !== -1) {
          const originalSegment = track.segments[index];

          if (startTime !== undefined) {
            trimmedSegment = {
              ...originalSegment,
              id: `trimmed_${originalSegment.id}_${Date.now()}`,
              startTime,
              duration: originalSegment.endTime - startTime
            };
          } else if (endTime !== undefined) {
            trimmedSegment = {
              ...originalSegment,
              id: `trimmed_${originalSegment.id}_${Date.now()}`,
              endTime,
              duration: endTime - originalSegment.startTime
            };
          }

          if (trimmedSegment) {
            track.segments[index] = trimmedSegment;
          }
        }
      });

      if (trimmedSegment) {
        set({
          timelineState: { ...timelineState },
          selectedSegments: [trimmedSegment]
        });
      }
    } finally {
      set({ isEditing: false });
    }
  },

  splitSegment: async (segment, splitTime) => {
    const { timelineState } = get();
    if (!timelineState) return;

    set({ isEditing: true });

    try {
      const splitSegments: TimelineSegment[] = [];

      timelineState.tracks.forEach(track => {
        const index = track.segments.findIndex(s => s.id === segment.id);
        if (index !== -1) {
          const originalSegment = track.segments[index];

          const firstSegment: TimelineSegment = {
            ...originalSegment,
            id: `split1_${originalSegment.id}_${Date.now()}`,
            endTime: splitTime,
            duration: splitTime - originalSegment.startTime
          };

          const secondSegment: TimelineSegment = {
            ...originalSegment,
            id: `split2_${originalSegment.id}_${Date.now()}`,
            startTime: splitTime,
            duration: originalSegment.endTime - splitTime
          };

          track.segments.splice(index, 1, firstSegment, secondSegment);
          splitSegments.push(firstSegment, secondSegment);
        }
      });

      set({
        timelineState: { ...timelineState },
        selectedSegments: splitSegments
      });
    } finally {
      set({ isEditing: false });
    }
  },

  undo: async () => {
    // Implementation would depend on history management
    // For now, this is a placeholder
    console.log('Undo operation');
  },

  redo: async () => {
    // Implementation would depend on history management
    // For now, this is a placeholder
    console.log('Redo operation');
  },
}));

export default useTimelineStore;
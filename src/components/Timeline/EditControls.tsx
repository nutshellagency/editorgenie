/**
 * EditControls component providing comprehensive timeline editing functionality.
 *
 * This component manages all edit operations including cut, copy, paste, delete,
 * trim, and split operations with full validation, error handling, and state management.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { TimelineSegment, TimelineTrack, TimelineState } from '../../core/timeline/models';
import { TimelineStateManager } from '../../core/timeline/state';
import { EditControlsManager } from './EditControlsManager';
import { useTimelineStore } from '../../stores/timelineStore';
import './EditControls.css';

interface EditControlsProps {
  timelineState: TimelineState;
  stateManager: TimelineStateManager;
  onEditOperation: (operation: string, segments: TimelineSegment[]) => void;
  onError: (error: string) => void;
}

export const EditControls: React.FC<EditControlsProps> = ({
  timelineState,
  stateManager,
  onEditOperation,
  onError,
}) => {
  const [editManager] = useState(() => new EditControlsManager(stateManager));
  const [selectedSegments, setSelectedSegments] = useState<TimelineSegment[]>([]);
  const [clipboard, setClipboard] = useState<TimelineSegment[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Initialize edit manager with current state
  useEffect(() => {
    editManager.initialize(timelineState);
  }, [timelineState, editManager]);

  // Update selected segments when timeline selection changes
  useEffect(() => {
    const selected = timelineState.tracks.flatMap(track =>
      track.segments.filter(segment => segment.selected)
    );
    setSelectedSegments(selected);
  }, [timelineState]);

  const handleCut = useCallback(async () => {
    if (selectedSegments.length === 0) {
      onError('No segments selected for cut operation');
      return;
    }

    setIsEditing(true);
    try {
      const cutSegments = await editManager.cutSegments(selectedSegments);
      setClipboard(cutSegments);
      onEditOperation('cut', cutSegments);
    } catch (error) {
      onError(`Cut operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEditing(false);
    }
  }, [selectedSegments, editManager, onEditOperation, onError]);

  const handleCopy = useCallback(async () => {
    if (selectedSegments.length === 0) {
      onError('No segments selected for copy operation');
      return;
    }

    try {
      const copiedSegments = await editManager.copySegments(selectedSegments);
      setClipboard(copiedSegments);
      onEditOperation('copy', copiedSegments);
    } catch (error) {
      onError(`Copy operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [selectedSegments, editManager, onEditOperation, onError]);

  const handlePaste = useCallback(async (targetTime: number) => {
    if (clipboard.length === 0) {
      onError('No segments in clipboard for paste operation');
      return;
    }

    setIsEditing(true);
    try {
      const pastedSegments = await editManager.pasteSegments(clipboard, targetTime);
      onEditOperation('paste', pastedSegments);
    } catch (error) {
      onError(`Paste operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEditing(false);
    }
  }, [clipboard, editManager, onEditOperation, onError]);

  const handleDelete = useCallback(async () => {
    if (selectedSegments.length === 0) {
      onError('No segments selected for delete operation');
      return;
    }

    setIsEditing(true);
    try {
      await editManager.deleteSegments(selectedSegments);
      onEditOperation('delete', selectedSegments);
    } catch (error) {
      onError(`Delete operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEditing(false);
    }
  }, [selectedSegments, editManager, onEditOperation, onError]);

  const handleTrimStart = useCallback(async (trimTime: number) => {
    if (selectedSegments.length !== 1) {
      onError('Trim start operation requires exactly one segment selected');
      return;
    }

    setIsEditing(true);
    try {
      const trimmedSegment = await editManager.trimStart(selectedSegments[0], trimTime);
      onEditOperation('trim_start', [trimmedSegment]);
    } catch (error) {
      onError(`Trim start operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEditing(false);
    }
  }, [selectedSegments, editManager, onEditOperation, onError]);

  const handleTrimEnd = useCallback(async (trimTime: number) => {
    if (selectedSegments.length !== 1) {
      onError('Trim end operation requires exactly one segment selected');
      return;
    }

    setIsEditing(true);
    try {
      const trimmedSegment = await editManager.trimEnd(selectedSegments[0], trimTime);
      onEditOperation('trim_end', [trimmedSegment]);
    } catch (error) {
      onError(`Trim end operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEditing(false);
    }
  }, [selectedSegments, editManager, onEditOperation, onError]);

  const handleSplit = useCallback(async (splitTime: number) => {
    if (selectedSegments.length !== 1) {
      onError('Split operation requires exactly one segment selected');
      return;
    }

    setIsEditing(true);
    try {
      const splitSegments = await editManager.splitSegment(selectedSegments[0], splitTime);
      onEditOperation('split', splitSegments);
    } catch (error) {
      onError(`Split operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEditing(false);
    }
  }, [selectedSegments, editManager, onEditOperation, onError]);

  const handleUndo = useCallback(async () => {
    try {
      const undoneSegments = await editManager.undo();
      onEditOperation('undo', undoneSegments);
    } catch (error) {
      onError(`Undo operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [editManager, onEditOperation, onError]);

  const handleRedo = useCallback(async () => {
    try {
      const redoneSegments = await editManager.redo();
      onEditOperation('redo', redoneSegments);
    } catch (error) {
      onError(`Redo operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [editManager, onEditOperation, onError]);

  const canCut = selectedSegments.length > 0 && !isEditing;
  const canCopy = selectedSegments.length > 0;
  const canPaste = clipboard.length > 0 && !isEditing;
  const canDelete = selectedSegments.length > 0 && !isEditing;
  const canTrim = selectedSegments.length === 1 && !isEditing;
  const canSplit = selectedSegments.length === 1 && !isEditing;
  const canUndo = editManager.canUndo();
  const canRedo = editManager.canRedo();

  return (
    <div className="edit-controls">
      <div className="edit-controls-toolbar">
        <button
          onClick={handleCut}
          disabled={!canCut}
          title="Cut selected segments (Ctrl+X)"
          className="edit-button"
        >
          <i className="icon-cut"></i>
          Cut
        </button>

        <button
          onClick={handleCopy}
          disabled={!canCopy}
          title="Copy selected segments (Ctrl+C)"
          className="edit-button"
        >
          <i className="icon-copy"></i>
          Copy
        </button>

        <button
          onClick={() => handlePaste(timelineState.currentTime)}
          disabled={!canPaste}
          title="Paste segments at current time (Ctrl+V)"
          className="edit-button"
        >
          <i className="icon-paste"></i>
          Paste
        </button>

        <button
          onClick={handleDelete}
          disabled={!canDelete}
          title="Delete selected segments (Delete)"
          className="edit-button delete"
        >
          <i className="icon-delete"></i>
          Delete
        </button>

        <div className="separator"></div>

        <button
          onClick={handleUndo}
          disabled={!canUndo}
          title="Undo last operation (Ctrl+Z)"
          className="edit-button"
        >
          <i className="icon-undo"></i>
          Undo
        </button>

        <button
          onClick={handleRedo}
          disabled={!canRedo}
          title="Redo last undone operation (Ctrl+Y)"
          className="edit-button"
        >
          <i className="icon-redo"></i>
          Redo
        </button>

        <div className="separator"></div>

        <button
          onClick={() => handleTrimStart(timelineState.currentTime)}
          disabled={!canTrim}
          title="Trim start of selected segment"
          className="edit-button"
        >
          <i className="icon-trim-start"></i>
          Trim Start
        </button>

        <button
          onClick={() => handleTrimEnd(timelineState.currentTime)}
          disabled={!canTrim}
          title="Trim end of selected segment"
          className="edit-button"
        >
          <i className="icon-trim-end"></i>
          Trim End
        </button>

        <button
          onClick={() => handleSplit(timelineState.currentTime)}
          disabled={!canSplit}
          title="Split selected segment at current time"
          className="edit-button"
        >
          <i className="icon-split"></i>
          Split
        </button>
      </div>

      <div className="edit-controls-info">
        <span className="selected-count">
          {selectedSegments.length} segment{selectedSegments.length !== 1 ? 's' : ''} selected
        </span>
        {clipboard.length > 0 && (
          <span className="clipboard-count">
            {clipboard.length} segment{clipboard.length !== 1 ? 's' : ''} in clipboard
          </span>
        )}
      </div>

      {isEditing && (
        <div className="edit-progress">
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
          <span>Processing edit operation...</span>
        </div>
      )}
    </div>
  );
};

export default EditControls;
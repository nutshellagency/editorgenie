import React, { useState, useRef, useCallback, useEffect } from 'react';
import './ResizablePanels.css';

interface Panel {
  id: string;
  component: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

interface ResizablePanelsProps {
  panels: Panel[];
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  onPanelResize?: (panelId: string, size: number) => void;
  storageKey?: string; // For persisting panel sizes
}

interface PanelState {
  size: number;
  collapsed: boolean;
}

const ResizablePanels: React.FC<ResizablePanelsProps> = ({
  panels,
  orientation = 'horizontal',
  className = '',
  onPanelResize,
  storageKey,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelStates, setPanelStates] = useState<Record<string, PanelState>>(() => {
    const initialStates: Record<string, PanelState> = {};

    panels.forEach((panel) => {
      // Try to load from localStorage if storageKey is provided
      let storedSize: number | undefined;
      let storedCollapsed: boolean | undefined;

      if (storageKey) {
        const stored = localStorage.getItem(`${storageKey}_${panel.id}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            storedSize = parsed.size;
            storedCollapsed = parsed.collapsed;
          } catch (e) {
            console.warn('Failed to parse stored panel state:', e);
          }
        }
      }

      initialStates[panel.id] = {
        size: storedSize ?? panel.defaultSize ?? (orientation === 'horizontal' ? 320 : 200),
        collapsed: storedCollapsed ?? panel.defaultCollapsed ?? false,
      };
    });

    return initialStates;
  });

  const [draggedPanel, setDraggedPanel] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Save panel states to localStorage
  const savePanelState = useCallback((panelId: string, state: PanelState) => {
    if (storageKey) {
      localStorage.setItem(`${storageKey}_${panelId}`, JSON.stringify(state));
    }
  }, [storageKey]);

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback((panelId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setDraggedPanel(panelId);
    setDragOffset(0);
  }, []);

  // Handle mouse move during resize
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!draggedPanel || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const panelState = panelStates[draggedPanel];
    const panel = panels.find(p => p.id === draggedPanel);

    if (!panelState || !panel) return;

    let newSize: number;
    let delta: number;

    if (orientation === 'horizontal') {
      delta = event.clientX - (panelStates[draggedPanel].size || 0);
      newSize = Math.max(
        panel.minSize || 100,
        Math.min(panel.maxSize || 800, panelState.size + delta)
      );
    } else {
      delta = event.clientY - (panelStates[draggedPanel].size || 0);
      newSize = Math.max(
        panel.minSize || 100,
        Math.min(panel.maxSize || 600, panelState.size + delta)
      );
    }

    setPanelStates(prev => ({
      ...prev,
      [draggedPanel]: {
        ...prev[draggedPanel],
        size: newSize,
      }
    }));

    setDragOffset(delta);
    onPanelResize?.(draggedPanel, newSize);
  }, [draggedPanel, panelStates, panels, orientation, onPanelResize]);

  // Handle mouse up after resize
  const handleMouseUp = useCallback(() => {
    if (draggedPanel) {
      const panelState = panelStates[draggedPanel];
      savePanelState(draggedPanel, panelState);
      setDraggedPanel(null);
      setDragOffset(0);
    }
  }, [draggedPanel, panelStates, savePanelState]);

  // Toggle panel collapse
  const togglePanelCollapse = useCallback((panelId: string) => {
    setPanelStates(prev => {
      const newState = {
        ...prev[panelId],
        collapsed: !prev[panelId].collapsed,
      };
      savePanelState(panelId, newState);
      return {
        ...prev,
        [panelId]: newState,
      };
    });
  }, [savePanelState]);

  // Set up event listeners
  useEffect(() => {
    if (draggedPanel) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [draggedPanel, handleMouseMove, handleMouseUp, orientation]);

  // Calculate total size of all panels
  const totalSize = panels.reduce((total, panel) => {
    const state = panelStates[panel.id];
    return total + (state?.collapsed ? 0 : state?.size || panel.defaultSize || 320);
  }, 0);

  return (
    <div
      ref={containerRef}
      className={`resizable-panels ${orientation} ${className} ${draggedPanel ? 'resizing' : ''}`}
    >
      {panels.map((panel, index) => {
        const state = panelStates[panel.id];
        const isCollapsed = state?.collapsed || false;
        const size = state?.size || panel.defaultSize || 320;
        const isLast = index === panels.length - 1;
        const isFirst = index === 0;

        return (
          <React.Fragment key={panel.id}>
            <div
              className={`resizable-panel ${isCollapsed ? 'collapsed' : ''} ${panel.id}`}
              style={{
                [orientation === 'horizontal' ? 'width' : 'height']: isCollapsed ? 0 : `${size}px`,
                [orientation === 'horizontal' ? 'minWidth' : 'minHeight']: isCollapsed ? '0' : `${panel.minSize || 100}px`,
                [orientation === 'horizontal' ? 'maxWidth' : 'maxHeight']: `${panel.maxSize || (orientation === 'horizontal' ? 800 : 600)}px`,
              }}
            >
              {panel.collapsible && (
                <div className="panel-header">
                  <button
                    className="collapse-button"
                    onClick={() => togglePanelCollapse(panel.id)}
                    title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
                  >
                    {orientation === 'horizontal' ? '◀' : '▲'}
                  </button>
                </div>
              )}
              <div className="panel-content">
                {panel.component}
              </div>
            </div>

            {/* Resize handle (except for last panel) */}
            {!isLast && (
              <div
                className={`resize-handle ${orientation} ${draggedPanel === panel.id ? 'active' : ''}`}
                onMouseDown={(e) => handleMouseDown(panel.id, e)}
                title={`Resize ${panel.id} panel`}
              >
                <div className="handle-indicator"></div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ResizablePanels;
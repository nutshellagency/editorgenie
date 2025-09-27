import React from 'react';

interface ToolbarProps {
  onAddNode: (nodeType: 'sttNode' | 'shotDetectionNode' | 'aiDirectorNode' | 'assemblyNode' | 'exportNode') => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onAddNode }) => {
  const nodeTypes = [
    { type: 'sttNode' as const, label: 'STT', description: 'Speech to Text' },
    { type: 'shotDetectionNode' as const, label: 'Shot Detection', description: 'Scene Analysis' },
    { type: 'aiDirectorNode' as const, label: 'AI Director', description: 'Content Analysis' },
    { type: 'assemblyNode' as const, label: 'Assembly', description: 'Video Assembly' },
    { type: 'exportNode' as const, label: 'Export', description: 'Export Video' },
  ];

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <h3>Add Nodes</h3>
        <div className="node-buttons">
          {nodeTypes.map(({ type, label, description }) => (
            <button
              key={type}
              onClick={() => onAddNode(type)}
              className="node-button"
              title={description}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <h3>Actions</h3>
        <div className="action-buttons">
          <button className="action-button">Save Project</button>
          <button className="action-button">Load Project</button>
          <button className="action-button">Clear All</button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
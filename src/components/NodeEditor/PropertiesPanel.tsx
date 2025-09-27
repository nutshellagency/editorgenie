import React from 'react';
import { CustomNode } from '../../stores/nodeStore';

interface PropertiesPanelProps {
  selectedNode: CustomNode | null;
  onNodeUpdate: (id: string, updates: Partial<CustomNode>) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedNode, onNodeUpdate }) => {
  if (!selectedNode) {
    return (
      <div className="properties-panel">
        <div className="properties-header">
          <h3>Properties</h3>
        </div>
        <div className="properties-content">
          <p>Select a node to view its properties</p>
        </div>
      </div>
    );
  }

  const handleConfigChange = (key: string, value: any) => {
    const updatedConfig = {
      ...selectedNode.data.config,
      [key]: value,
    };

    onNodeUpdate(selectedNode.id, {
      data: {
        ...selectedNode.data,
        config: updatedConfig,
      },
    });
  };

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <h3>{selectedNode.data.label}</h3>
        <span className={`status-badge status-${selectedNode.data.status}`}>
          {selectedNode.data.status}
        </span>
      </div>

      <div className="properties-content">
        <div className="property-group">
          <h4>Basic Settings</h4>
          <div className="property-item">
            <label>Label:</label>
            <input
              type="text"
              value={selectedNode.data.label}
              onChange={(e) => onNodeUpdate(selectedNode.id, {
                data: { ...selectedNode.data, label: e.target.value }
              })}
            />
          </div>

          <div className="property-item">
            <label>Status:</label>
            <select
              value={selectedNode.data.status}
              onChange={(e) => onNodeUpdate(selectedNode.id, {
                data: { ...selectedNode.data, status: e.target.value as any }
              })}
            >
              <option value="idle">Idle</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="property-item">
            <label>Progress:</label>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedNode.data.progress || 0}
              onChange={(e) => onNodeUpdate(selectedNode.id, {
                data: { ...selectedNode.data, progress: parseInt(e.target.value) }
              })}
            />
            <span>{selectedNode.data.progress || 0}%</span>
          </div>
        </div>

        <div className="property-group">
          <h4>Configuration</h4>
          {Object.entries(selectedNode.data.config || {}).map(([key, value]) => (
            <div key={key} className="property-item">
              <label>{key}:</label>
              <input
                type="text"
                value={String(value)}
                onChange={(e) => handleConfigChange(key, e.target.value)}
              />
            </div>
          ))}

          {(!selectedNode.data.config || Object.keys(selectedNode.data.config).length === 0) && (
            <p className="no-config">No configuration options available</p>
          )}
        </div>

        <div className="property-group">
          <h4>Position</h4>
          <div className="property-item">
            <label>X:</label>
            <input
              type="number"
              value={selectedNode.position.x}
              onChange={(e) => onNodeUpdate(selectedNode.id, {
                position: { ...selectedNode.position, x: parseFloat(e.target.value) }
              })}
            />
          </div>
          <div className="property-item">
            <label>Y:</label>
            <input
              type="number"
              value={selectedNode.position.y}
              onChange={(e) => onNodeUpdate(selectedNode.id, {
                position: { ...selectedNode.position, y: parseFloat(e.target.value) }
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;
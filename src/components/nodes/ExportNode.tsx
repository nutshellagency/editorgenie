import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'react-flow-renderer';
import { NodeData } from '../../stores/nodeStore';

interface ExportNodeData extends NodeData {
  type: 'exportNode';
  config?: {
    format?: string;
    quality?: string;
    platform?: string;
  };
}

const ExportNode: React.FC<NodeProps<ExportNodeData>> = ({ data, selected }) => {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'processing':
        return '#3b82f6';
      case 'completed':
        return '#10b981';
      case 'error':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  return (
    <div
      className={`node export-node ${selected ? 'selected' : ''}`}
      data-testid="export-node"
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="node-handle"
      />

      <div className="node-header">
        <div className="node-icon">📤</div>
        <div className="node-title">{data.label}</div>
        <div
          className="node-status"
          style={{ backgroundColor: getStatusColor(data.status) }}
        />
      </div>

      <div className="node-content">
        <div className="node-config">
          <div className="config-item">
            <label>Format:</label>
            <span>{data.config?.format || 'MP4'}</span>
          </div>
          <div className="config-item">
            <label>Quality:</label>
            <span>{data.config?.quality || 'High'}</span>
          </div>
        </div>

        {data.status === 'processing' && (
          <div className="node-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${data.progress || 0}%` }}
              />
            </div>
            <span className="progress-text">{data.progress || 0}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ExportNode);
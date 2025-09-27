import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'react-flow-renderer';
import { NodeData } from '../../stores/nodeStore';

interface AssemblyNodeData extends NodeData {
  type: 'assemblyNode';
  config?: {
    resolution?: string;
    fps?: number;
    codec?: string;
  };
}

const AssemblyNode: React.FC<NodeProps<AssemblyNodeData>> = ({ data, selected }) => {
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
      className={`node assembly-node ${selected ? 'selected' : ''}`}
      data-testid="assembly-node"
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="node-handle"
      />

      <div className="node-header">
        <div className="node-icon">🔧</div>
        <div className="node-title">{data.label}</div>
        <div
          className="node-status"
          style={{ backgroundColor: getStatusColor(data.status) }}
        />
      </div>

      <div className="node-content">
        <div className="node-config">
          <div className="config-item">
            <label>Resolution:</label>
            <span>{data.config?.resolution || '1080p'}</span>
          </div>
          <div className="config-item">
            <label>FPS:</label>
            <span>{data.config?.fps || 30}</span>
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

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="node-handle"
      />
    </div>
  );
};

export default memo(AssemblyNode);
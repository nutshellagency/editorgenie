import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'react-flow-renderer';
import { NodeData } from '../../stores/nodeStore';

interface AIDirectorNodeData extends NodeData {
  type: 'aiDirectorNode';
  config?: {
    rules?: string[];
    style?: string;
    pacing?: string;
  };
}

const AIDirectorNode: React.FC<NodeProps<AIDirectorNodeData>> = ({ data, selected }) => {
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
      className={`node ai-director-node ${selected ? 'selected' : ''}`}
      data-testid="ai-director-node"
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="node-handle"
      />

      <div className="node-header">
        <div className="node-icon">🤖</div>
        <div className="node-title">{data.label}</div>
        <div
          className="node-status"
          style={{ backgroundColor: getStatusColor(data.status) }}
        />
      </div>

      <div className="node-content">
        <div className="node-config">
          <div className="config-item">
            <label>Style:</label>
            <span>{data.config?.style || 'Dynamic'}</span>
          </div>
          <div className="config-item">
            <label>Pacing:</label>
            <span>{data.config?.pacing || 'Moderate'}</span>
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

export default memo(AIDirectorNode);
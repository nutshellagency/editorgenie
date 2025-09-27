import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'react-flow-renderer';
import { NodeData } from '../../stores/nodeStore';

interface ShotDetectionNodeData extends NodeData {
  type: 'shotDetectionNode';
  config?: {
    model?: string;
    threshold?: number;
    minDuration?: number;
  };
}

const ShotDetectionNode: React.FC<NodeProps<ShotDetectionNodeData>> = ({ data, selected }) => {
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
      className={`node shot-detection-node ${selected ? 'selected' : ''}`}
      data-testid="shot-detection-node"
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="node-handle"
      />

      <div className="node-header">
        <div className="node-icon">🎬</div>
        <div className="node-title">{data.label}</div>
        <div
          className="node-status"
          style={{ backgroundColor: getStatusColor(data.status) }}
        />
      </div>

      <div className="node-content">
        <div className="node-config">
          <div className="config-item">
            <label>Model:</label>
            <span>{data.config?.model || 'Qwen Vision'}</span>
          </div>
          <div className="config-item">
            <label>Threshold:</label>
            <span>{data.config?.threshold || 0.5}</span>
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

export default memo(ShotDetectionNode);
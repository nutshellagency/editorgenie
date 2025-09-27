import React, { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
} from 'react-flow-renderer';
import { useNodeStore } from '../../stores/nodeStore';
import { useUIStore } from '../../stores/uiStore';
import { nodeTypes } from '../nodes';
import Toolbar from './Toolbar';
import PropertiesPanel from './PropertiesPanel';
import PreviewPanel from './PreviewPanel';
import './NodeEditor.css';

const NodeEditor: React.FC = () => {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    onNodesChange,
    onEdgesChange,
    addNode,
    addEdge: addStoreEdge,
    setSelectedNodeId,
    selectedNodeId,
  } = useNodeStore();

  const { theme } = useUIStore();

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(storeEdges);

  // Sync store changes with internal state
  useEffect(() => {
    setNodes(storeNodes);
    setEdges(storeEdges);
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = addEdge(params, edges);
      setEdges(newEdge);
      addStoreEdge(params);
    },
    [edges, setEdges, addStoreEdge]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onNodesChange([
        {
          id: node.id,
          type: 'position',
          position: node.position,
        },
      ]);
    },
    [onNodesChange]
  );

  const handleAddNode = useCallback(
    (nodeType: 'sttNode' | 'shotDetectionNode' | 'aiDirectorNode' | 'assemblyNode' | 'exportNode') => {
      const newNode = {
        id: `${nodeType}_${Date.now()}`,
        type: nodeType,
        position: { x: Math.random() * 400, y: Math.random() * 400 },
        data: {
          label: `${nodeType.replace(/([A-Z])/g, ' $1').trim()}`,
          type: nodeType,
          config: {},
          status: 'idle' as const,
          progress: 0,
        },
      };
      addNode(newNode);
    },
    [addNode]
  );

  const selectedNode = useMemo(() => {
    return storeNodes.find(node => node.id === selectedNodeId) || null;
  }, [storeNodes, selectedNodeId]);

  return (
    <div className="node-editor">
      <Toolbar onAddNode={handleAddNode} />

      <div className="node-editor-main">
        <div className="node-editor-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => {
              onNodesChangeInternal(changes);
              onNodesChange(changes);
            }}
            onEdgesChange={(changes) => {
              onEdgesChangeInternal(changes);
              onEdgesChange(changes);
            }}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            className={theme}
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'sttNode':
                    return '#3b82f6';
                  case 'shotDetectionNode':
                    return '#10b981';
                  case 'aiDirectorNode':
                    return '#f59e0b';
                  case 'assemblyNode':
                    return '#ef4444';
                  case 'exportNode':
                    return '#8b5cf6';
                  default:
                    return '#64748b';
                }
              }}
            />
          </ReactFlow>
        </div>

        <div className="node-editor-panels">
          <PropertiesPanel
            selectedNode={selectedNode}
            onNodeUpdate={(id, updates) => {
              onNodesChange([{ id, type: 'select', selected: false }]);
              onNodesChange([{ id, ...updates }]);
            }}
          />
          <PreviewPanel />
        </div>
      </div>
    </div>
  );
};

export default NodeEditor;
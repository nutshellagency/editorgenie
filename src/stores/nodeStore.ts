import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Node, Edge, addEdge, Connection, NodeTypes } from 'react-flow-renderer';

export interface NodeData {
  label: string;
  type: 'sttNode' | 'shotDetectionNode' | 'aiDirectorNode' | 'assemblyNode' | 'exportNode';
  config?: Record<string, any>;
  status?: 'idle' | 'processing' | 'completed' | 'error';
  progress?: number;
}

export interface CustomNode extends Node {
  data: NodeData;
}

export interface CustomEdge extends Edge {}

interface NodeStore {
  // State
  nodes: CustomNode[];
  edges: CustomEdge[];
  selectedNodeId: string | null;

  // Actions
  onNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  addNode: (node: Omit<CustomNode, 'id'> & { id?: string }) => void;
  updateNode: (id: string, updates: Partial<CustomNode>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: CustomEdge | Connection) => void;
  updateEdge: (id: string, updates: Partial<CustomEdge>) => void;
  deleteEdge: (id: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  duplicateNode: (id: string) => void;
  clearAll: () => void;

  // Computed
  getNodeById: (id: string) => CustomNode | undefined;
  getConnectedNodes: (id: string) => { inputs: CustomNode[]; outputs: CustomNode[] };
  getNodesByType: (type: NodeData['type']) => CustomNode[];
}

const NODE_TYPE_LABELS = {
  sttNode: 'STT Node',
  shotDetectionNode: 'Shot Detection Node',
  aiDirectorNode: 'AI Director Node',
  assemblyNode: 'Assembly Node',
  exportNode: 'Export Node',
};

export const useNodeStore = create<NodeStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      nodes: [],
      edges: [],
      selectedNodeId: null,

      // Node change handlers
      onNodesChange: (changes) => {
        set((state) => ({
          nodes: state.nodes.map(node => {
            const change = changes.find(c => c.id === node.id);
            if (change) {
              return { ...node, ...change };
            }
            return node;
          }),
        }));
      },

      onEdgesChange: (changes) => {
        set((state) => ({
          edges: state.edges.map(edge => {
            const change = changes.find(c => c.id === edge.id);
            if (change) {
              return { ...edge, ...change };
            }
            return edge;
          }),
        }));
      },

      // Node management
      addNode: (nodeData) => {
        const id = nodeData.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newNode: CustomNode = {
          id,
          type: nodeData.type,
          position: nodeData.position,
          data: {
            label: NODE_TYPE_LABELS[nodeData.data.type] || nodeData.data.label,
            type: nodeData.data.type,
            config: nodeData.data.config || {},
            status: 'idle',
            progress: 0,
          },
          selected: false,
          dragging: false,
        };

        set((state) => ({
          nodes: [...state.nodes, newNode],
        }));
      },

      updateNode: (id, updates) => {
        set((state) => ({
          nodes: state.nodes.map(node =>
            node.id === id ? { ...node, ...updates } : node
          ),
        }));
      },

      deleteNode: (id) => {
        set((state) => ({
          nodes: state.nodes.filter(node => node.id !== id),
          edges: state.edges.filter(edge => edge.source !== id && edge.target !== id),
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
        }));
      },

      // Edge management
      addEdge: (edgeData) => {
        const newEdge: CustomEdge = {
          id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: edgeData.source || '',
          target: edgeData.target || '',
          sourceHandle: edgeData.sourceHandle || null,
          targetHandle: edgeData.targetHandle || null,
          type: 'default',
          style: { stroke: '#64748b', strokeWidth: 2 },
        };

        set((state) => ({
          edges: [...state.edges, newEdge],
        }));
      },

      updateEdge: (id, updates) => {
        set((state) => ({
          edges: state.edges.map(edge =>
            edge.id === id ? { ...edge, ...updates } : edge
          ),
        }));
      },

      deleteEdge: (id) => {
        set((state) => ({
          edges: state.edges.filter(edge => edge.id !== id),
        }));
      },

      // Selection
      setSelectedNodeId: (id) => {
        set((state) => ({
          selectedNodeId: id,
          nodes: state.nodes.map(node => ({
            ...node,
            selected: node.id === id,
          })),
        }));
      },

      // Node operations
      duplicateNode: (id) => {
        const nodeToDuplicate = get().nodes.find(node => node.id === id);
        if (nodeToDuplicate) {
          const duplicatedNode = {
            ...nodeToDuplicate,
            id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            position: {
              x: nodeToDuplicate.position.x + 50,
              y: nodeToDuplicate.position.y + 50,
            },
            selected: false,
          };

          set((state) => ({
            nodes: [...state.nodes, duplicatedNode],
          }));
        }
      },

      clearAll: () => {
        set({
          nodes: [],
          edges: [],
          selectedNodeId: null,
        });
      },

      // Computed getters
      getNodeById: (id) => {
        return get().nodes.find(node => node.id === id);
      },

      getConnectedNodes: (id) => {
        const state = get();
        const inputs = state.nodes.filter(node =>
          state.edges.some(edge => edge.target === id && edge.source === node.id)
        );
        const outputs = state.nodes.filter(node =>
          state.edges.some(edge => edge.source === id && edge.target === node.id)
        );

        return { inputs, outputs };
      },

      getNodesByType: (type) => {
        return get().nodes.filter(node => node.data.type === type);
      },
    }),
    { name: 'node-store' }
  )
);
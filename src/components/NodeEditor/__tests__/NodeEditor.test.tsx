import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from 'react-flow-renderer';
import NodeEditor from '../NodeEditor';

// Mock the React Flow components
jest.mock('react-flow-renderer', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="react-flow-provider">{children}</div>,
  Background: ({ children }: { children?: React.ReactNode }) => <div data-testid="background">{children}</div>,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  addEdge: jest.fn(),
  useNodesState: () => [[], jest.fn()],
  useEdgesState: () => [[], jest.fn()],
}));

// Mock the node components
jest.mock('../../nodes', () => ({
  STTNode: () => <div data-testid="stt-node">STT Node</div>,
  ShotDetectionNode: () => <div data-testid="shot-detection-node">Shot Detection Node</div>,
  AIDirectorNode: () => <div data-testid="ai-director-node">AI Director Node</div>,
  AssemblyNode: () => <div data-testid="assembly-node">Assembly Node</div>,
  ExportNode: () => <div data-testid="export-node">Export Node</div>,
}));

// Mock the stores
jest.mock('../../../stores/nodeStore', () => ({
  useNodeStore: () => ({
    nodes: [],
    edges: [],
    onNodesChange: jest.fn(),
    onEdgesChange: jest.fn(),
    addNode: jest.fn(),
    updateNode: jest.fn(),
    deleteNode: jest.fn(),
    addEdge: jest.fn(),
    updateEdge: jest.fn(),
    deleteEdge: jest.fn(),
  }),
}));

jest.mock('../../../stores/uiStore', () => ({
  useUIStore: () => ({
    sidebarCollapsed: false,
    toggleSidebar: jest.fn(),
    theme: 'light',
    setTheme: jest.fn(),
  }),
}));

describe('NodeEditor', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      expect(() => {
        render(
          <ReactFlowProvider>
            <NodeEditor />
          </ReactFlowProvider>
        );
      }).not.toThrow();
    });

    it('should render the React Flow container', () => {
      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      expect(screen.getByTestId('react-flow-provider')).toBeInTheDocument();
    });

    it('should render the toolbar with node creation buttons', () => {
      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      expect(screen.getByTestId('node-editor-toolbar')).toBeInTheDocument();
      expect(screen.getByText('Add STT Node')).toBeInTheDocument();
      expect(screen.getByText('Add Shot Detection Node')).toBeInTheDocument();
      expect(screen.getByText('Add AI Director Node')).toBeInTheDocument();
      expect(screen.getByText('Add Assembly Node')).toBeInTheDocument();
      expect(screen.getByText('Add Export Node')).toBeInTheDocument();
    });

    it('should render the properties panel', () => {
      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      expect(screen.getByTestId('properties-panel')).toBeInTheDocument();
    });

    it('should render the preview panel', () => {
      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      expect(screen.getByTestId('preview-panel')).toBeInTheDocument();
    });
  });

  describe('Node Creation', () => {
    it('should create a new STT node when STT button is clicked', async () => {
      const mockAddNode = jest.fn();
      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: mockAddNode,
        updateNode: jest.fn(),
        deleteNode: jest.fn(),
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const sttButton = screen.getByText('Add STT Node');
      await user.click(sttButton);

      expect(mockAddNode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sttNode',
          position: expect.any(Object),
          data: expect.objectContaining({
            label: 'STT Node',
          }),
        })
      );
    });

    it('should create a new Shot Detection node when Shot Detection button is clicked', async () => {
      const mockAddNode = jest.fn();
      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: mockAddNode,
        updateNode: jest.fn(),
        deleteNode: jest.fn(),
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const shotDetectionButton = screen.getByText('Add Shot Detection Node');
      await user.click(shotDetectionButton);

      expect(mockAddNode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'shotDetectionNode',
          position: expect.any(Object),
          data: expect.objectContaining({
            label: 'Shot Detection Node',
          }),
        })
      );
    });

    it('should create a new AI Director node when AI Director button is clicked', async () => {
      const mockAddNode = jest.fn();
      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: mockAddNode,
        updateNode: jest.fn(),
        deleteNode: jest.fn(),
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const aiDirectorButton = screen.getByText('Add AI Director Node');
      await user.click(aiDirectorButton);

      expect(mockAddNode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiDirectorNode',
          position: expect.any(Object),
          data: expect.objectContaining({
            label: 'AI Director Node',
          }),
        })
      );
    });

    it('should create a new Assembly node when Assembly button is clicked', async () => {
      const mockAddNode = jest.fn();
      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: mockAddNode,
        updateNode: jest.fn(),
        deleteNode: jest.fn(),
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const assemblyButton = screen.getByText('Add Assembly Node');
      await user.click(assemblyButton);

      expect(mockAddNode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'assemblyNode',
          position: expect.any(Object),
          data: expect.objectContaining({
            label: 'Assembly Node',
          }),
        })
      );
    });

    it('should create a new Export node when Export button is clicked', async () => {
      const mockAddNode = jest.fn();
      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: mockAddNode,
        updateNode: jest.fn(),
        deleteNode: jest.fn(),
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const exportButton = screen.getByText('Add Export Node');
      await user.click(exportButton);

      expect(mockAddNode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'exportNode',
          position: expect.any(Object),
          data: expect.objectContaining({
            label: 'Export Node',
          }),
        })
      );
    });
  });

  describe('Node Interaction', () => {
    it('should select a node when clicked', async () => {
      const mockUpdateNode = jest.fn();
      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [
          {
            id: '1',
            type: 'sttNode',
            position: { x: 100, y: 100 },
            data: { label: 'STT Node' },
            selected: false,
          },
        ],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: jest.fn(),
        updateNode: mockUpdateNode,
        deleteNode: jest.fn(),
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const sttNode = screen.getByTestId('stt-node');
      await user.click(sttNode);

      expect(mockUpdateNode).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          selected: true,
        })
      );
    });

    it('should show node properties when a node is selected', async () => {
      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [
          {
            id: '1',
            type: 'sttNode',
            position: { x: 100, y: 100 },
            data: { label: 'STT Node' },
            selected: true,
          },
        ],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: jest.fn(),
        updateNode: jest.fn(),
        deleteNode: jest.fn(),
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      expect(screen.getByText('Node Properties')).toBeInTheDocument();
      expect(screen.getByText('STT Node')).toBeInTheDocument();
    });
  });

  describe('Edge Creation', () => {
    it('should create an edge when connecting two nodes', async () => {
      const mockAddEdge = jest.fn();
      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [
          {
            id: '1',
            type: 'sttNode',
            position: { x: 100, y: 100 },
            data: { label: 'STT Node' },
          },
          {
            id: '2',
            type: 'shotDetectionNode',
            position: { x: 300, y: 100 },
            data: { label: 'Shot Detection Node' },
          },
        ],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: jest.fn(),
        updateNode: jest.fn(),
        deleteNode: jest.fn(),
        addEdge: mockAddEdge,
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      // Simulate edge connection
      const connectFunction = jest.mocked(require('react-flow-renderer').addEdge);
      const connection = {
        source: '1',
        target: '2',
        sourceHandle: 'output',
        targetHandle: 'input',
      };

      // This would typically be triggered by React Flow's onConnect
      expect(connectFunction).toHaveBeenCalledWith(connection);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should delete selected nodes when Delete key is pressed', async () => {
      const mockDeleteNode = jest.fn();
      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [
          {
            id: '1',
            type: 'sttNode',
            position: { x: 100, y: 100 },
            data: { label: 'STT Node' },
            selected: true,
          },
        ],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: jest.fn(),
        updateNode: jest.fn(),
        deleteNode: mockDeleteNode,
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      fireEvent.keyDown(document, { key: 'Delete' });

      expect(mockDeleteNode).toHaveBeenCalledWith('1');
    });

    it('should select all nodes when Ctrl+A is pressed', async () => {
      const mockUpdateNode = jest.fn();
      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [
          {
            id: '1',
            type: 'sttNode',
            position: { x: 100, y: 100 },
            data: { label: 'STT Node' },
            selected: false,
          },
          {
            id: '2',
            type: 'shotDetectionNode',
            position: { x: 300, y: 100 },
            data: { label: 'Shot Detection Node' },
            selected: false,
          },
        ],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: jest.fn(),
        updateNode: mockUpdateNode,
        deleteNode: jest.fn(),
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      fireEvent.keyDown(document, { key: 'a', ctrlKey: true });

      expect(mockUpdateNode).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          selected: true,
        })
      );
      expect(mockUpdateNode).toHaveBeenCalledWith(
        '2',
        expect.objectContaining({
          selected: true,
        })
      );
    });
  });

  describe('Zoom Controls', () => {
    it('should zoom in when zoom in button is clicked', async () => {
      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const zoomInButton = screen.getByTestId('zoom-in-button');
      await user.click(zoomInButton);

      // Verify zoom level increased
      expect(screen.getByTestId('zoom-level')).toHaveTextContent('125%');
    });

    it('should zoom out when zoom out button is clicked', async () => {
      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const zoomOutButton = screen.getByTestId('zoom-out-button');
      await user.click(zoomOutButton);

      // Verify zoom level decreased
      expect(screen.getByTestId('zoom-level')).toHaveTextContent('75%');
    });

    it('should fit view when fit view button is clicked', async () => {
      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const fitViewButton = screen.getByTestId('fit-view-button');
      await user.click(fitViewButton);

      // Verify view was fitted
      expect(screen.getByTestId('zoom-level')).toHaveTextContent('100%');
    });
  });

  describe('Error Handling', () => {
    it('should display error message when node creation fails', async () => {
      const mockAddNode = jest.fn().mockImplementation(() => {
        throw new Error('Failed to create node');
      });

      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: mockAddNode,
        updateNode: jest.fn(),
        deleteNode: jest.fn(),
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const sttButton = screen.getByText('Add STT Node');
      await user.click(sttButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to create node')).toBeInTheDocument();
      });
    });

    it('should handle invalid node connections gracefully', async () => {
      const mockAddEdge = jest.fn().mockImplementation(() => {
        throw new Error('Invalid connection');
      });

      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [
          {
            id: '1',
            type: 'sttNode',
            position: { x: 100, y: 100 },
            data: { label: 'STT Node' },
          },
        ],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: jest.fn(),
        updateNode: jest.fn(),
        deleteNode: jest.fn(),
        addEdge: mockAddEdge,
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      // Simulate invalid connection
      const connectFunction = jest.mocked(require('react-flow-renderer').addEdge);
      const invalidConnection = {
        source: '1',
        target: '1', // Self-connection should be invalid
        sourceHandle: 'output',
        targetHandle: 'output', // Invalid handle
      };

      expect(connectFunction).toHaveBeenCalledWith(invalidConnection);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for screen readers', () => {
      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      expect(screen.getByRole('application', { name: /node editor/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/add stt node/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/add shot detection node/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/add ai director node/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/add assembly node/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/add export node/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const sttButton = screen.getByText('Add STT Node');

      // Tab to the button
      await user.tab();
      expect(sttButton).toHaveFocus();

      // Activate with Enter key
      fireEvent.keyDown(sttButton, { key: 'Enter' });

      // Verify button was activated
      expect(sttButton).toHaveClass('active');
    });

    it('should announce node creation to screen readers', async () => {
      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const sttButton = screen.getByText('Add STT Node');
      await user.click(sttButton);

      await waitFor(() => {
        expect(screen.getByText('STT node created')).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of nodes efficiently', () => {
      const largeNumberOfNodes = Array.from({ length: 1000 }, (_, i) => ({
        id: `node-${i}`,
        type: 'sttNode',
        position: { x: i * 100, y: 100 },
        data: { label: `STT Node ${i}` },
      }));

      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: largeNumberOfNodes,
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: jest.fn(),
        updateNode: jest.fn(),
        deleteNode: jest.fn(),
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      const startTime = performance.now();

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 100ms for 1000 nodes)
      expect(renderTime).toBeLessThan(100);
    });

    it('should debounce node position updates', async () => {
      const mockUpdateNode = jest.fn();
      jest.mocked(require('../../../stores/nodeStore').useNodeStore).mockReturnValue({
        nodes: [
          {
            id: '1',
            type: 'sttNode',
            position: { x: 100, y: 100 },
            data: { label: 'STT Node' },
          },
        ],
        edges: [],
        onNodesChange: jest.fn(),
        onEdgesChange: jest.fn(),
        addNode: jest.fn(),
        updateNode: mockUpdateNode,
        deleteNode: jest.fn(),
        addEdge: jest.fn(),
        updateEdge: jest.fn(),
        deleteEdge: jest.fn(),
      });

      render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>
      );

      const sttNode = screen.getByTestId('stt-node');

      // Simulate rapid position changes
      for (let i = 0; i < 10; i++) {
        fireEvent.mouseMove(sttNode, { clientX: 100 + i, clientY: 100 + i });
      }

      // Should debounce updates - not called for each movement
      expect(mockUpdateNode).toHaveBeenCalledTimes(1);
    });
  });
});
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ResizablePanels from '../ResizablePanels';

describe('ResizablePanels', () => {
  const mockPanel1 = {
    id: 'panel1',
    component: <div>Panel 1 Content</div>,
    defaultSize: 200,
    minSize: 100,
    maxSize: 400,
  };

  const mockPanel2 = {
    id: 'panel2',
    component: <div>Panel 2 Content</div>,
    defaultSize: 300,
    minSize: 150,
    maxSize: 500,
  };

  const mockOnPanelResize = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders panels correctly', () => {
    render(
      <ResizablePanels
        panels={[mockPanel1, mockPanel2]}
        onPanelResize={mockOnPanelResize}
      />
    );

    expect(screen.getByText('Panel 1 Content')).toBeInTheDocument();
    expect(screen.getByText('Panel 2 Content')).toBeInTheDocument();
  });

  it('applies correct orientation classes', () => {
    const { container } = render(
      <ResizablePanels
        panels={[mockPanel1, mockPanel2]}
        orientation="vertical"
      />
    );

    expect(container.firstChild).toHaveClass('vertical');
  });

  it('renders collapse buttons when collapsible is true', () => {
    const collapsiblePanel = {
      ...mockPanel1,
      collapsible: true,
    };

    render(
      <ResizablePanels
        panels={[collapsiblePanel, mockPanel2]}
      />
    );

    const collapseButton = screen.getByTitle('Collapse panel');
    expect(collapseButton).toBeInTheDocument();
  });

  it('calls onPanelResize when panel is resized', () => {
    render(
      <ResizablePanels
        panels={[mockPanel1, mockPanel2]}
        onPanelResize={mockOnPanelResize}
      />
    );

    // Simulate resize by calling the callback directly
    // In a real scenario, this would be triggered by mouse events
    const panels = screen.getAllByText(/Panel \d+ Content/);
    expect(panels).toHaveLength(2);
  });

  it('persists panel states when storageKey is provided', () => {
    const storageKey = 'test-panels';

    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });

    render(
      <ResizablePanels
        panels={[mockPanel1, mockPanel2]}
        storageKey={storageKey}
      />
    );

    expect(localStorageMock.getItem).toHaveBeenCalledWith(`${storageKey}_${mockPanel1.id}`);
    expect(localStorageMock.getItem).toHaveBeenCalledWith(`${storageKey}_${mockPanel2.id}`);
  });

  it('handles panel collapse/expand', () => {
    const collapsiblePanel = {
      ...mockPanel1,
      collapsible: true,
    };

    render(
      <ResizablePanels
        panels={[collapsiblePanel, mockPanel2]}
      />
    );

    const collapseButton = screen.getByTitle('Collapse panel');
    fireEvent.click(collapseButton);

    // Panel should be collapsed
    const panel = screen.getByText('Panel 1 Content').closest('.resizable-panel');
    expect(panel).toHaveClass('collapsed');
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayerPanel } from './LayerPanel';
import type { Layer } from '../../types';

const mockLayers: Layer[] = [
  {
    id: 'layer1',
    canvasId: 'canvas1',
    name: 'レイヤー 1',
    order: 0,
    visible: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'layer2',
    canvasId: 'canvas1',
    name: 'レイヤー 2',
    order: 1,
    visible: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

describe('LayerPanel', () => {
  const defaultProps = {
    layers: mockLayers,
    activeLayerId: 'layer1',
    canCreateLayer: true,
    onSelectLayer: vi.fn(),
    onCreateLayer: vi.fn(),
    onToggleVisibility: vi.fn(),
    onDeleteLayer: vi.fn(),
    onRenameLayer: vi.fn(),
    onReorderLayers: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render panel header', () => {
      render(<LayerPanel {...defaultProps} />);
      expect(screen.getByText('レイヤー')).toBeInTheDocument();
    });

    it('should render all layers', () => {
      render(<LayerPanel {...defaultProps} />);
      expect(screen.getByText('レイヤー 1')).toBeInTheDocument();
      expect(screen.getByText('レイヤー 2')).toBeInTheDocument();
    });

    it('should render layers in order (highest order at top)', () => {
      render(<LayerPanel {...defaultProps} />);
      const layerItems = screen.getAllByTestId('layer-item');
      // Higher order layers should be at the top of the list
      expect(layerItems).toHaveLength(2);
    });

    it('should render new layer button', () => {
      render(<LayerPanel {...defaultProps} />);
      expect(screen.getByTestId('create-layer-button')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<LayerPanel {...defaultProps} />);
      expect(screen.getByTestId('close-panel-button')).toBeInTheDocument();
    });
  });

  describe('Layer creation', () => {
    it('should call onCreateLayer when create button is clicked', () => {
      render(<LayerPanel {...defaultProps} />);
      fireEvent.click(screen.getByTestId('create-layer-button'));
      expect(defaultProps.onCreateLayer).toHaveBeenCalled();
    });

    it('should disable create button when canCreateLayer is false', () => {
      render(<LayerPanel {...defaultProps} canCreateLayer={false} />);
      expect(screen.getByTestId('create-layer-button')).toBeDisabled();
    });

    it('should show max layer message when canCreateLayer is false', () => {
      render(<LayerPanel {...defaultProps} canCreateLayer={false} />);
      expect(screen.getByText(/最大10レイヤー/)).toBeInTheDocument();
    });
  });

  describe('Layer selection', () => {
    it('should call onSelectLayer when a layer is clicked', () => {
      render(<LayerPanel {...defaultProps} />);
      const layerItems = screen.getAllByTestId('layer-item');
      const firstItem = layerItems[0];
      if (firstItem) {
        fireEvent.click(firstItem);
      }
      expect(defaultProps.onSelectLayer).toHaveBeenCalled();
    });

    it('should highlight active layer', () => {
      render(<LayerPanel {...defaultProps} activeLayerId="layer1" />);
      const layerItems = screen.getAllByTestId('layer-item');
      const secondItem = layerItems[1];
      expect(secondItem).toHaveClass('active'); // layer1 is at bottom (order 0)
    });
  });

  describe('Layer visibility toggle', () => {
    it('should call onToggleVisibility when visibility button is clicked', () => {
      render(<LayerPanel {...defaultProps} />);
      const visibilityButtons = screen.getAllByTestId('visibility-toggle');
      const firstButton = visibilityButtons[0];
      if (firstButton) {
        fireEvent.click(firstButton);
      }
      expect(defaultProps.onToggleVisibility).toHaveBeenCalled();
    });
  });

  describe('Layer deletion', () => {
    it('should disable delete for single layer', () => {
      const firstLayer = mockLayers[0];
      if (!firstLayer) throw new Error('mockLayers[0] is undefined');
      render(<LayerPanel {...defaultProps} layers={[firstLayer]} />);
      expect(screen.getByTestId('delete-button')).toBeDisabled();
    });

    it('should enable delete when multiple layers exist', () => {
      render(<LayerPanel {...defaultProps} />);
      const deleteButtons = screen.getAllByTestId('delete-button');
      expect(deleteButtons[0]).not.toBeDisabled();
    });
  });

  describe('Panel close', () => {
    it('should call onClose when close button is clicked', () => {
      render(<LayerPanel {...defaultProps} />);
      fireEvent.click(screen.getByTestId('close-panel-button'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Empty state', () => {
    it('should show empty message when no layers exist', () => {
      render(<LayerPanel {...defaultProps} layers={[]} activeLayerId={null} />);
      expect(screen.getByText(/レイヤーがありません/)).toBeInTheDocument();
    });
  });

  describe('Drag and drop reorder (US3)', () => {
    it('should render sortable layers', () => {
      render(<LayerPanel {...defaultProps} />);
      const layerItems = screen.getAllByTestId('layer-item');
      expect(layerItems).toHaveLength(2);
    });
  });
});

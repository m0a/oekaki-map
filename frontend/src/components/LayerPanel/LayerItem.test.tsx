import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayerItem } from './LayerItem';
import type { Layer } from '../../types';

const mockLayer: Layer = {
  id: 'layer1',
  canvasId: 'canvas1',
  name: 'レイヤー 1',
  order: 0,
  visible: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('LayerItem', () => {
  const defaultProps = {
    layer: mockLayer,
    isActive: false,
    onSelect: vi.fn(),
    onToggleVisibility: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    canDelete: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render layer name', () => {
      render(<LayerItem {...defaultProps} />);
      expect(screen.getByText('レイヤー 1')).toBeInTheDocument();
    });

    it('should indicate active layer with visual style', () => {
      render(<LayerItem {...defaultProps} isActive={true} />);
      const item = screen.getByTestId('layer-item');
      expect(item).toHaveClass('active');
    });

    it('should not have active class when not active', () => {
      render(<LayerItem {...defaultProps} isActive={false} />);
      const item = screen.getByTestId('layer-item');
      expect(item).not.toHaveClass('active');
    });
  });

  describe('Layer selection', () => {
    it('should call onSelect when layer is clicked', () => {
      render(<LayerItem {...defaultProps} />);
      fireEvent.click(screen.getByTestId('layer-item'));
      expect(defaultProps.onSelect).toHaveBeenCalledWith('layer1');
    });
  });

  describe('Visibility toggle (US2)', () => {
    it('should show visibility icon for visible layer', () => {
      render(<LayerItem {...defaultProps} />);
      expect(screen.getByTestId('visibility-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('visibility-toggle')).toHaveAttribute('aria-label', '非表示にする');
    });

    it('should show hidden icon for invisible layer', () => {
      const hiddenLayer = { ...mockLayer, visible: false };
      render(<LayerItem {...defaultProps} layer={hiddenLayer} />);
      expect(screen.getByTestId('visibility-toggle')).toHaveAttribute('aria-label', '表示する');
    });

    it('should call onToggleVisibility when visibility button is clicked', () => {
      render(<LayerItem {...defaultProps} />);
      fireEvent.click(screen.getByTestId('visibility-toggle'));
      expect(defaultProps.onToggleVisibility).toHaveBeenCalledWith('layer1');
    });

    it('should not propagate click event from visibility toggle to layer selection', () => {
      render(<LayerItem {...defaultProps} />);
      fireEvent.click(screen.getByTestId('visibility-toggle'));
      expect(defaultProps.onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Delete button (US4)', () => {
    it('should render delete button when canDelete is true', () => {
      render(<LayerItem {...defaultProps} canDelete={true} />);
      expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    });

    it('should disable delete button when canDelete is false', () => {
      render(<LayerItem {...defaultProps} canDelete={false} />);
      expect(screen.getByTestId('delete-button')).toBeDisabled();
    });

    it('should call onDelete when delete button is clicked', () => {
      render(<LayerItem {...defaultProps} />);
      fireEvent.click(screen.getByTestId('delete-button'));
      expect(defaultProps.onDelete).toHaveBeenCalledWith('layer1');
    });

    it('should not propagate click event from delete button to layer selection', () => {
      render(<LayerItem {...defaultProps} />);
      fireEvent.click(screen.getByTestId('delete-button'));
      expect(defaultProps.onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Name editing (US5)', () => {
    it('should enter edit mode when name is double-clicked', () => {
      render(<LayerItem {...defaultProps} />);
      fireEvent.doubleClick(screen.getByText('レイヤー 1'));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('レイヤー 1');
    });

    it('should call onRename when editing is completed with Enter key', () => {
      render(<LayerItem {...defaultProps} />);
      fireEvent.doubleClick(screen.getByText('レイヤー 1'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '新しい名前' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(defaultProps.onRename).toHaveBeenCalledWith('layer1', '新しい名前');
    });

    it('should call onRename when input loses focus', () => {
      render(<LayerItem {...defaultProps} />);
      fireEvent.doubleClick(screen.getByText('レイヤー 1'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '新しい名前' } });
      fireEvent.blur(input);
      expect(defaultProps.onRename).toHaveBeenCalledWith('layer1', '新しい名前');
    });

    it('should cancel editing with Escape key without calling onRename', () => {
      render(<LayerItem {...defaultProps} />);
      fireEvent.doubleClick(screen.getByText('レイヤー 1'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '新しい名前' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(defaultProps.onRename).not.toHaveBeenCalled();
      expect(screen.getByText('レイヤー 1')).toBeInTheDocument();
    });

    it('should not call onRename if name is empty', () => {
      render(<LayerItem {...defaultProps} />);
      fireEvent.doubleClick(screen.getByText('レイヤー 1'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(defaultProps.onRename).not.toHaveBeenCalled();
    });
  });
});

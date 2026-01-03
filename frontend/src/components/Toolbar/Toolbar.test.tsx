import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  const defaultProps = {
    color: '#000000',
    thickness: 4,
    mode: 'draw' as const,
    onColorChange: vi.fn(),
    onThicknessChange: vi.fn(),
    onModeChange: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
  };

  describe('Undo button', () => {
    it('should render Undo button', () => {
      render(<Toolbar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    });

    it('should be disabled when canUndo is false', () => {
      render(<Toolbar {...defaultProps} canUndo={false} />);
      const undoButton = screen.getByRole('button', { name: /undo/i });
      expect(undoButton).toBeDisabled();
    });

    it('should be enabled when canUndo is true', () => {
      render(<Toolbar {...defaultProps} canUndo={true} />);
      const undoButton = screen.getByRole('button', { name: /undo/i });
      expect(undoButton).not.toBeDisabled();
    });

    it('should call onUndo when clicked', () => {
      const onUndo = vi.fn();
      render(<Toolbar {...defaultProps} canUndo={true} onUndo={onUndo} />);
      const undoButton = screen.getByRole('button', { name: /undo/i });
      fireEvent.click(undoButton);
      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('should not call onUndo when disabled and clicked', () => {
      const onUndo = vi.fn();
      render(<Toolbar {...defaultProps} canUndo={false} onUndo={onUndo} />);
      const undoButton = screen.getByRole('button', { name: /undo/i });
      fireEvent.click(undoButton);
      expect(onUndo).not.toHaveBeenCalled();
    });
  });

  describe('Redo button', () => {
    it('should render Redo button', () => {
      render(<Toolbar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument();
    });

    it('should be disabled when canRedo is false', () => {
      render(<Toolbar {...defaultProps} canRedo={false} />);
      const redoButton = screen.getByRole('button', { name: /redo/i });
      expect(redoButton).toBeDisabled();
    });

    it('should be enabled when canRedo is true', () => {
      render(<Toolbar {...defaultProps} canRedo={true} />);
      const redoButton = screen.getByRole('button', { name: /redo/i });
      expect(redoButton).not.toBeDisabled();
    });

    it('should call onRedo when clicked', () => {
      const onRedo = vi.fn();
      render(<Toolbar {...defaultProps} canRedo={true} onRedo={onRedo} />);
      const redoButton = screen.getByRole('button', { name: /redo/i });
      fireEvent.click(redoButton);
      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('should not call onRedo when disabled and clicked', () => {
      const onRedo = vi.fn();
      render(<Toolbar {...defaultProps} canRedo={false} onRedo={onRedo} />);
      const redoButton = screen.getByRole('button', { name: /redo/i });
      fireEvent.click(redoButton);
      expect(onRedo).not.toHaveBeenCalled();
    });
  });

  describe('Color button and popup', () => {
    it('should render color button with current color', () => {
      render(<Toolbar {...defaultProps} color="#FF0000" />);
      const colorButton = screen.getByRole('button', { name: /color picker/i });
      expect(colorButton).toBeInTheDocument();
      expect(colorButton).toHaveStyle({ backgroundColor: '#FF0000' });
    });

    it('should open color popup when color button is clicked', () => {
      render(<Toolbar {...defaultProps} />);
      const colorButton = screen.getByRole('button', { name: /color picker/i });
      fireEvent.click(colorButton);
      // Check that color options are visible (popup is open)
      expect(screen.getByRole('button', { name: 'Color #FF0000' })).toBeInTheDocument();
    });

    it('should close color popup when a color is selected', () => {
      const onColorChange = vi.fn();
      render(<Toolbar {...defaultProps} onColorChange={onColorChange} />);
      const colorButton = screen.getByRole('button', { name: /color picker/i });
      fireEvent.click(colorButton);
      // Select a color
      const redColor = screen.getByRole('button', { name: 'Color #FF0000' });
      fireEvent.click(redColor);
      expect(onColorChange).toHaveBeenCalledWith('#FF0000');
      // Popup should be closed (color options should not be visible)
      expect(screen.queryByRole('button', { name: 'Color #FF0000' })).not.toBeInTheDocument();
    });
  });

  describe('Thickness button and popup', () => {
    it('should render thickness button', () => {
      render(<Toolbar {...defaultProps} thickness={4} />);
      const thicknessButton = screen.getByRole('button', { name: /thickness picker/i });
      expect(thicknessButton).toBeInTheDocument();
    });

    it('should open thickness popup when thickness button is clicked', () => {
      render(<Toolbar {...defaultProps} />);
      const thicknessButton = screen.getByRole('button', { name: /thickness picker/i });
      fireEvent.click(thicknessButton);
      // Check that thickness options are visible (popup is open)
      expect(screen.getByRole('button', { name: 'thin thickness' })).toBeInTheDocument();
    });

    it('should close thickness popup when a thickness is selected', () => {
      const onThicknessChange = vi.fn();
      render(<Toolbar {...defaultProps} onThicknessChange={onThicknessChange} />);
      const thicknessButton = screen.getByRole('button', { name: /thickness picker/i });
      fireEvent.click(thicknessButton);
      // Select a thickness
      const thinButton = screen.getByRole('button', { name: 'thin thickness' });
      fireEvent.click(thinButton);
      expect(onThicknessChange).toHaveBeenCalledWith(2);
      // Popup should be closed
      expect(screen.queryByRole('button', { name: 'thin thickness' })).not.toBeInTheDocument();
    });
  });
});

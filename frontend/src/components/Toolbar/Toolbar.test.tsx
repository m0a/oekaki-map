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
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPopup } from './ColorPopup';
import { DEFAULT_COLORS } from '../../types';

describe('ColorPopup', () => {
  const defaultProps = {
    colors: DEFAULT_COLORS,
    selectedColor: '#000000',
    onColorSelect: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders all color options', () => {
    render(<ColorPopup {...defaultProps} />);
    DEFAULT_COLORS.forEach((color) => {
      expect(screen.getByRole('button', { name: `Color ${color}` })).toBeInTheDocument();
    });
  });

  it('highlights the selected color', () => {
    render(<ColorPopup {...defaultProps} selectedColor="#FF0000" />);
    const selectedButton = screen.getByRole('button', { name: 'Color #FF0000' });
    expect(selectedButton).toHaveStyle({ border: '3px solid #007AFF' });
  });

  it('calls onColorSelect when a color is clicked', () => {
    const onColorSelect = vi.fn();
    render(<ColorPopup {...defaultProps} onColorSelect={onColorSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Color #FF0000' }));
    expect(onColorSelect).toHaveBeenCalledWith('#FF0000');
  });

  it('calls onClose after color selection', () => {
    const onClose = vi.fn();
    render(<ColorPopup {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Color #FF0000' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders in a popup container with correct positioning', () => {
    const { container } = render(<ColorPopup {...defaultProps} />);
    const popup = container.firstChild as HTMLElement;
    expect(popup).toHaveStyle({ position: 'absolute' });
  });
});

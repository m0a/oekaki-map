import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThicknessPopup } from './ThicknessPopup';
import { LINE_THICKNESSES } from '../../types';

describe('ThicknessPopup', () => {
  const defaultProps = {
    thicknesses: LINE_THICKNESSES,
    selectedThickness: 4,
    onThicknessSelect: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders all thickness options', () => {
    render(<ThicknessPopup {...defaultProps} />);
    Object.keys(LINE_THICKNESSES).forEach((name) => {
      expect(screen.getByRole('button', { name: `${name} thickness` })).toBeInTheDocument();
    });
  });

  it('highlights the selected thickness', () => {
    render(<ThicknessPopup {...defaultProps} selectedThickness={4} />);
    const selectedButton = screen.getByRole('button', { name: /medium/i });
    expect(selectedButton).toHaveStyle({ backgroundColor: '#007AFF' });
  });

  it('calls onThicknessSelect when a thickness is clicked', () => {
    const onThicknessSelect = vi.fn();
    render(<ThicknessPopup {...defaultProps} onThicknessSelect={onThicknessSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /thin/i }));
    expect(onThicknessSelect).toHaveBeenCalledWith(2);
  });

  it('calls onClose after thickness selection', () => {
    const onClose = vi.fn();
    render(<ThicknessPopup {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /thin/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders in a popup container with correct positioning', () => {
    const { container } = render(<ThicknessPopup {...defaultProps} />);
    const popup = container.firstChild as HTMLElement;
    expect(popup).toHaveStyle({ position: 'absolute' });
  });
});

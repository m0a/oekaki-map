import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareButton } from './ShareButton';

describe('ShareButton', () => {
  const defaultProps = {
    canvasId: 'canvas123',
    currentPosition: {
      lat: 35.6762,
      lng: 139.6503,
      zoom: 15,
    },
    onShare: vi.fn(),
    isSharing: false,
    disabled: false,
  };

  describe('rendering', () => {
    it('should render share button', () => {
      render(<ShareButton {...defaultProps} />);
      expect(screen.getByRole('button', { name: /共有/i })).toBeInTheDocument();
    });

    it('should show share icon', () => {
      render(<ShareButton {...defaultProps} />);
      const button = screen.getByRole('button', { name: /共有/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<ShareButton {...defaultProps} disabled={true} />);
      const button = screen.getByRole('button', { name: /共有/i });
      expect(button).toBeDisabled();
    });

    it('should be disabled when isSharing is true', () => {
      render(<ShareButton {...defaultProps} isSharing={true} />);
      const button = screen.getByRole('button', { name: /共有/i });
      expect(button).toBeDisabled();
    });

    it('should be disabled when canvasId is empty', () => {
      render(<ShareButton {...defaultProps} canvasId="" />);
      const button = screen.getByRole('button', { name: /共有/i });
      expect(button).toBeDisabled();
    });
  });

  describe('interactions', () => {
    it('should call onShare with position when clicked', () => {
      const onShare = vi.fn();
      render(<ShareButton {...defaultProps} onShare={onShare} />);
      const button = screen.getByRole('button', { name: /共有/i });
      fireEvent.click(button);
      expect(onShare).toHaveBeenCalledTimes(1);
    });

    it('should not call onShare when disabled', () => {
      const onShare = vi.fn();
      render(<ShareButton {...defaultProps} onShare={onShare} disabled={true} />);
      const button = screen.getByRole('button', { name: /共有/i });
      fireEvent.click(button);
      expect(onShare).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when isSharing is true', () => {
      render(<ShareButton {...defaultProps} isSharing={true} />);
      // Button should be in a loading state
      const button = screen.getByRole('button', { name: /共有/i });
      expect(button).toHaveAttribute('aria-busy', 'true');
    });
  });
});

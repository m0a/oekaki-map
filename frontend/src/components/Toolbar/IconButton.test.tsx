import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from './IconButton';
import { PencilIcon } from './icons';

describe('IconButton', () => {
  const defaultProps = {
    icon: <PencilIcon />,
    label: 'Draw',
    onClick: vi.fn(),
  };

  it('renders a button with icon', () => {
    render(<IconButton {...defaultProps} />);
    const button = screen.getByRole('button', { name: 'Draw' });
    expect(button).toBeInTheDocument();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with correct aria-label', () => {
    render(<IconButton {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Draw' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<IconButton {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies active styles when isActive is true', () => {
    render(<IconButton {...defaultProps} isActive />);
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({ backgroundColor: '#007AFF' });
  });

  it('applies inactive styles when isActive is false', () => {
    render(<IconButton {...defaultProps} isActive={false} />);
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({ backgroundColor: '#f0f0f0' });
  });

  it('is disabled when disabled prop is true', () => {
    render(<IconButton {...defaultProps} disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(<IconButton {...defaultProps} onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows tooltip via title attribute', () => {
    render(<IconButton {...defaultProps} tooltip="描画" />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', '描画');
  });

  it('uses label as fallback tooltip when tooltip is not provided', () => {
    render(<IconButton {...defaultProps} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Draw');
  });

  it('uses default size of 44', () => {
    render(<IconButton {...defaultProps} />);
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({ width: '44px', height: '44px' });
  });

  it('accepts custom size', () => {
    render(<IconButton {...defaultProps} size={36} />);
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({ width: '36px', height: '36px' });
  });
});

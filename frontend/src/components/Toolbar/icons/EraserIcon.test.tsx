import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EraserIcon } from './EraserIcon';

describe('EraserIcon', () => {
  it('renders an SVG element', () => {
    render(<EraserIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('uses default size of 20', () => {
    render(<EraserIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
  });

  it('accepts custom size', () => {
    render(<EraserIcon size={24} />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('accepts custom color', () => {
    render(<EraserIcon color="blue" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'blue');
  });

  it('uses currentColor as default color', () => {
    render(<EraserIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });
});

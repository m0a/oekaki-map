import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LayersIcon } from './LayersIcon';

describe('LayersIcon', () => {
  it('renders an SVG element', () => {
    render(<LayersIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('uses default size of 20', () => {
    render(<LayersIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
  });

  it('accepts custom size', () => {
    render(<LayersIcon size={24} />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('accepts custom color', () => {
    render(<LayersIcon color="purple" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'purple');
  });

  it('uses currentColor as default color', () => {
    render(<LayersIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });
});

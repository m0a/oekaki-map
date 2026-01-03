import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HandIcon } from './HandIcon';

describe('HandIcon', () => {
  it('renders an SVG element', () => {
    render(<HandIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('uses default size of 20', () => {
    render(<HandIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
  });

  it('accepts custom size', () => {
    render(<HandIcon size={24} />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('accepts custom color', () => {
    render(<HandIcon color="green" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'green');
  });

  it('uses currentColor as default color', () => {
    render(<HandIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });
});

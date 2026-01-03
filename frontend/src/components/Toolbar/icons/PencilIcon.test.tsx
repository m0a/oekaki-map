import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PencilIcon } from './PencilIcon';

describe('PencilIcon', () => {
  it('renders an SVG element', () => {
    render(<PencilIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('uses default size of 20', () => {
    render(<PencilIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
  });

  it('accepts custom size', () => {
    render(<PencilIcon size={24} />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('accepts custom color', () => {
    render(<PencilIcon color="red" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'red');
  });

  it('uses currentColor as default color', () => {
    render(<PencilIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });
});

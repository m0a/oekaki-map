import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { UndoIcon } from './UndoIcon';

describe('UndoIcon', () => {
  it('renders an SVG element', () => {
    render(<UndoIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('uses default size of 20', () => {
    render(<UndoIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
  });

  it('accepts custom size', () => {
    render(<UndoIcon size={24} />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('accepts custom color', () => {
    render(<UndoIcon color="orange" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'orange');
  });

  it('uses currentColor as default color', () => {
    render(<UndoIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });
});

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RedoIcon } from './RedoIcon';

describe('RedoIcon', () => {
  it('renders an SVG element', () => {
    render(<RedoIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('uses default size of 20', () => {
    render(<RedoIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
  });

  it('accepts custom size', () => {
    render(<RedoIcon size={24} />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('accepts custom color', () => {
    render(<RedoIcon color="cyan" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'cyan');
  });

  it('uses currentColor as default color', () => {
    render(<RedoIcon />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });
});

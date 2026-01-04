// ID validation utilities

// Canvas/Layer ID format: 20-21 characters (nanoid)
// Accept 20-21 chars for backwards compatibility
export const isValidCanvasId = (id: string): boolean =>
  id.length >= 20 && id.length <= 21;

export const isValidLayerId = (id: string): boolean =>
  id.length >= 20 && id.length <= 21;

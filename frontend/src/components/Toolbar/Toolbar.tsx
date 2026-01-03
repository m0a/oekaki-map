import { DEFAULT_COLORS, LINE_THICKNESSES, type DrawingState } from '../../types';

interface ToolbarProps {
  color: string;
  thickness: number;
  mode: DrawingState['mode'];
  onColorChange: (color: string) => void;
  onThicknessChange: (thickness: number) => void;
  onModeChange: (mode: DrawingState['mode']) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function Toolbar({
  color,
  thickness,
  mode,
  onColorChange,
  onThicknessChange,
  onModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: ToolbarProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 8,
        padding: 12,
        backgroundColor: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      {/* Color palette */}
      <div style={{ display: 'flex', gap: 4 }}>
        {DEFAULT_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onColorChange(c)}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: c,
              border: color === c ? '3px solid #007AFF' : '2px solid #ddd',
              cursor: 'pointer',
              padding: 0,
            }}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      {/* Separator */}
      <div
        style={{
          width: 1,
          backgroundColor: '#ddd',
          margin: '0 4px',
        }}
      />

      {/* Thickness selector */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {Object.entries(LINE_THICKNESSES).map(([name, value]) => (
          <button
            key={name}
            onClick={() => onThicknessChange(value)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: thickness === value ? '#007AFF' : '#f0f0f0',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label={`${name} thickness`}
          >
            <div
              style={{
                width: value * 2,
                height: value * 2,
                borderRadius: '50%',
                backgroundColor: thickness === value ? 'white' : '#333',
              }}
            />
          </button>
        ))}
      </div>

      {/* Separator */}
      <div
        style={{
          width: 1,
          backgroundColor: '#ddd',
          margin: '0 4px',
        }}
      />

      {/* Undo/Redo buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            backgroundColor: canUndo ? '#f0f0f0' : '#e0e0e0',
            color: canUndo ? '#333' : '#999',
            border: 'none',
            cursor: canUndo ? 'pointer' : 'not-allowed',
            fontWeight: 'normal',
          }}
          aria-label="Undo"
        >
          ↩ Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            backgroundColor: canRedo ? '#f0f0f0' : '#e0e0e0',
            color: canRedo ? '#333' : '#999',
            border: 'none',
            cursor: canRedo ? 'pointer' : 'not-allowed',
            fontWeight: 'normal',
          }}
          aria-label="Redo"
        >
          Redo ↪
        </button>
      </div>

      {/* Separator */}
      <div
        style={{
          width: 1,
          backgroundColor: '#ddd',
          margin: '0 4px',
        }}
      />

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => onModeChange('draw')}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            backgroundColor: mode === 'draw' ? '#007AFF' : '#f0f0f0',
            color: mode === 'draw' ? 'white' : '#333',
            border: 'none',
            cursor: 'pointer',
            fontWeight: mode === 'draw' ? 'bold' : 'normal',
          }}
        >
          Draw
        </button>
        <button
          onClick={() => onModeChange('erase')}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            backgroundColor: mode === 'erase' ? '#007AFF' : '#f0f0f0',
            color: mode === 'erase' ? 'white' : '#333',
            border: 'none',
            cursor: 'pointer',
            fontWeight: mode === 'erase' ? 'bold' : 'normal',
          }}
        >
          Erase
        </button>
        <button
          onClick={() => onModeChange('navigate')}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            backgroundColor: mode === 'navigate' ? '#007AFF' : '#f0f0f0',
            color: mode === 'navigate' ? 'white' : '#333',
            border: 'none',
            cursor: 'pointer',
            fontWeight: mode === 'navigate' ? 'bold' : 'normal',
          }}
        >
          Move
        </button>
      </div>
    </div>
  );
}

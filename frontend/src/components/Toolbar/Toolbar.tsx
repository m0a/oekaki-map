import { useState, useRef, useEffect, useMemo } from 'react';
import { DEFAULT_COLORS, LINE_THICKNESSES, type DrawingState, type PopupType } from '../../types';
import { ShareButton } from '../ShareButton';
import { IconButton } from './IconButton';
import { ColorPopup } from './ColorPopup';
import { ThicknessPopup } from './ThicknessPopup';
import {
  PencilIcon,
  EraserIcon,
  HandIcon,
  LayersIcon,
  UndoIcon,
  RedoIcon,
} from './icons';

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
  isLayerPanelOpen?: boolean;
  onToggleLayerPanel?: () => void;
  // Share functionality
  canvasId?: string | undefined;
  currentPosition?: { lat: number; lng: number; zoom: number } | undefined;
  onShare?: (() => void) | undefined;
  isSharing?: boolean | undefined;
  // Geolocation functionality
  onGetLocation?: (() => void) | undefined;
  isGettingLocation?: boolean | undefined;
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
  isLayerPanelOpen,
  onToggleLayerPanel,
  canvasId,
  currentPosition,
  onShare,
  isSharing,
  onGetLocation,
  isGettingLocation,
}: ToolbarProps) {
  const [openPopup, setOpenPopup] = useState<PopupType>('none');
  const [isLandscape, setIsLandscape] = useState(() => window.innerWidth > window.innerHeight);
  const colorPopupRef = useRef<HTMLDivElement>(null);
  const thicknessPopupRef = useRef<HTMLDivElement>(null);

  // Detect orientation change
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle outside click to close popups
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openPopup === 'none') return;

      const target = e.target as Node;

      if (openPopup === 'color' && colorPopupRef.current && !colorPopupRef.current.contains(target)) {
        setOpenPopup('none');
      }
      if (openPopup === 'thickness' && thicknessPopupRef.current && !thicknessPopupRef.current.contains(target)) {
        setOpenPopup('none');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openPopup]);

  const handleColorButtonClick = () => {
    setOpenPopup(openPopup === 'color' ? 'none' : 'color');
  };

  const handleColorSelect = (newColor: string) => {
    onColorChange(newColor);
    setOpenPopup('none');
  };

  const handleThicknessButtonClick = () => {
    setOpenPopup(openPopup === 'thickness' ? 'none' : 'thickness');
  };

  const handleThicknessSelect = (newThickness: number) => {
    onThicknessChange(newThickness);
    setOpenPopup('none');
  };

  // Separator component - adapts to layout direction
  const Separator = () => (
    <div
      style={isLandscape ? {
        width: 1,
        height: 32,
        backgroundColor: '#ddd',
        margin: '0 4px',
      } : {
        width: 32,
        height: 1,
        backgroundColor: '#ddd',
        margin: '4px 0',
      }}
    />
  );

  // Popup position based on orientation
  const popupPosition = isLandscape ? 'top' : 'left';

  // Container styles based on orientation
  const containerStyle = useMemo(() => isLandscape ? {
    position: 'fixed' as const,
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'row' as const,
    gap: 4,
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 1000,
    alignItems: 'center',
  } : {
    position: 'fixed' as const,
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 1000,
    alignItems: 'center',
  }, [isLandscape]);

  return (
    <div style={containerStyle}>
      {/* Color button with popup */}
      <div ref={colorPopupRef} style={{ position: 'relative' }}>
        <button
          onClick={handleColorButtonClick}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: color,
            border: openPopup === 'color' ? '3px solid #007AFF' : '2px solid #ddd',
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label="Color picker"
          title="色を選択"
        />
        {openPopup === 'color' && (
          <ColorPopup
            colors={DEFAULT_COLORS}
            selectedColor={color}
            onColorSelect={handleColorSelect}
            onClose={() => setOpenPopup('none')}
            position={popupPosition}
          />
        )}
      </div>

      {/* Thickness button with popup */}
      <div ref={thicknessPopupRef} style={{ position: 'relative' }}>
        <button
          onClick={handleThicknessButtonClick}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: openPopup === 'thickness' ? '#007AFF' : '#f0f0f0',
            border: openPopup === 'thickness' ? '3px solid #007AFF' : '2px solid #ddd',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          aria-label="Thickness picker"
          title="線の太さを選択"
        >
          <div
            style={{
              width: thickness * 2,
              height: thickness * 2,
              borderRadius: '50%',
              backgroundColor: openPopup === 'thickness' ? 'white' : '#333',
            }}
          />
        </button>
        {openPopup === 'thickness' && (
          <ThicknessPopup
            thicknesses={LINE_THICKNESSES}
            selectedThickness={thickness}
            onThicknessSelect={handleThicknessSelect}
            onClose={() => setOpenPopup('none')}
            position={popupPosition}
          />
        )}
      </div>

      <Separator />

      {/* Undo/Redo buttons - Icon only */}
      <IconButton
        icon={<UndoIcon size={20} />}
        label="Undo"
        tooltip="元に戻す"
        onClick={onUndo}
        disabled={!canUndo}
        size={36}
      />
      <IconButton
        icon={<RedoIcon size={20} />}
        label="Redo"
        tooltip="やり直し"
        onClick={onRedo}
        disabled={!canRedo}
        size={36}
      />

      <Separator />

      {/* Mode toggle - Icon buttons */}
      <IconButton
        icon={<PencilIcon size={20} />}
        label="Draw"
        tooltip="描画"
        onClick={() => onModeChange('draw')}
        isActive={mode === 'draw'}
        size={36}
      />
      <IconButton
        icon={<EraserIcon size={20} />}
        label="Erase"
        tooltip="消去"
        onClick={() => onModeChange('erase')}
        isActive={mode === 'erase'}
        size={36}
      />
      <IconButton
        icon={<HandIcon size={20} />}
        label="Move"
        tooltip="移動"
        onClick={() => onModeChange('navigate')}
        isActive={mode === 'navigate'}
        size={36}
      />

      {/* Layer panel toggle button */}
      {onToggleLayerPanel && (
        <>
          <Separator />
          <IconButton
            icon={<LayersIcon size={20} />}
            label="Toggle layer panel"
            tooltip="レイヤー"
            onClick={onToggleLayerPanel}
            isActive={isLayerPanelOpen ?? false}
            size={36}
          />
        </>
      )}

      {/* Share button */}
      {onShare && canvasId && currentPosition && (
        <>
          <Separator />
          <ShareButton
            canvasId={canvasId}
            currentPosition={currentPosition}
            onShare={onShare}
            isSharing={isSharing ?? false}
          />
        </>
      )}

      {/* Location button */}
      {onGetLocation && (
        <button
          onClick={onGetLocation}
          disabled={isGettingLocation}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: isGettingLocation ? '#e0e0e0' : '#f0f0f0',
            color: isGettingLocation ? '#999' : '#333',
            border: 'none',
            cursor: isGettingLocation ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          aria-label="現在位置"
          aria-busy={isGettingLocation}
          title="現在位置に移動"
        >
          {isGettingLocation ? (
            <span
              aria-hidden="true"
              style={{
                width: 16,
                height: 16,
                border: '2px solid transparent',
                borderTopColor: 'currentColor',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ width: 20, height: 20 }}
            >
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

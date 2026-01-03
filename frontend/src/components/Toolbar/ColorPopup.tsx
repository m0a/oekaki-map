interface ColorPopupProps {
  colors: readonly string[];
  selectedColor: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
  position?: 'top' | 'left';
}

export function ColorPopup({
  colors,
  selectedColor,
  onColorSelect,
  onClose,
  position = 'top',
}: ColorPopupProps) {
  const handleColorClick = (color: string) => {
    onColorSelect(color);
    onClose();
  };

  const positionStyles = position === 'left'
    ? {
        right: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        marginRight: 8,
      }
    : {
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: 8,
      };

  return (
    <div
      style={{
        position: 'absolute',
        ...positionStyles,
        padding: 8,
        backgroundColor: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 4,
        zIndex: 1001,
      }}
    >
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => handleColorClick(color)}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: color,
            border: selectedColor === color ? '3px solid #007AFF' : '2px solid #ddd',
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label={`Color ${color}`}
        />
      ))}
    </div>
  );
}

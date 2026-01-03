interface ThicknessPopupProps {
  thicknesses: Record<string, number>;
  selectedThickness: number;
  onThicknessSelect: (thickness: number) => void;
  onClose: () => void;
  position?: 'top' | 'left';
}

export function ThicknessPopup({
  thicknesses,
  selectedThickness,
  onThicknessSelect,
  onClose,
  position = 'top',
}: ThicknessPopupProps) {
  const handleThicknessClick = (thickness: number) => {
    onThicknessSelect(thickness);
    onClose();
  };

  const positionStyles = position === 'left'
    ? {
        right: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        marginRight: 8,
        flexDirection: 'column' as const,
      }
    : {
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: 8,
        flexDirection: 'row' as const,
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
        display: 'flex',
        gap: 4,
        zIndex: 1001,
      }}
    >
      {Object.entries(thicknesses).map(([name, value]) => (
        <button
          key={name}
          onClick={() => handleThicknessClick(value)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: selectedThickness === value ? '#007AFF' : '#f0f0f0',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          aria-label={`${name} thickness`}
        >
          <div
            style={{
              width: value * 2,
              height: value * 2,
              borderRadius: '50%',
              backgroundColor: selectedThickness === value ? 'white' : '#333',
            }}
          />
        </button>
      ))}
    </div>
  );
}

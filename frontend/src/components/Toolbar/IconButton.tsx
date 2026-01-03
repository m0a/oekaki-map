import type { ReactNode, CSSProperties } from 'react';

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  tooltip?: string;
  size?: number;
  style?: CSSProperties;
}

export function IconButton({
  icon,
  label,
  onClick,
  isActive = false,
  disabled = false,
  tooltip,
  size = 44,
  style,
}: IconButtonProps) {
  const buttonStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 8,
    backgroundColor: disabled ? '#e0e0e0' : isActive ? '#007AFF' : '#f0f0f0',
    color: disabled ? '#999' : isActive ? 'white' : '#333',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    ...style,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={buttonStyle}
      aria-label={label}
      title={tooltip ?? label}
    >
      {icon}
    </button>
  );
}

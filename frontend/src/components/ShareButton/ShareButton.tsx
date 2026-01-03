import { memo } from 'react';

interface ShareButtonProps {
  canvasId: string;
  currentPosition: {
    lat: number;
    lng: number;
    zoom: number;
  };
  onShare: () => void;
  isSharing: boolean;
  disabled?: boolean;
}

/**
 * Share button component that triggers URL sharing
 * On mobile: Opens native share sheet via Web Share API
 * On desktop: Copies URL to clipboard (handled by parent)
 */
export const ShareButton = memo(function ShareButton({
  canvasId,
  onShare,
  isSharing,
  disabled = false,
}: ShareButtonProps) {
  const isDisabled = disabled || isSharing || !canvasId;

  return (
    <button
      type="button"
      onClick={onShare}
      disabled={isDisabled}
      aria-label="共有"
      aria-busy={isSharing}
      title="URLを共有"
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        backgroundColor: isDisabled ? '#e0e0e0' : '#007AFF',
        color: isDisabled ? '#999' : 'white',
        border: 'none',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        fontWeight: 'normal',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minWidth: 44,
        minHeight: 36,
      }}
    >
      {isSharing ? (
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
          {/* Share icon */}
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      )}
    </button>
  );
});

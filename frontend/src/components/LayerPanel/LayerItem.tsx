import { useState, useCallback, useRef, useEffect, type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Layer } from '../../types';

interface LayerItemProps {
  layer: Layer;
  isActive: boolean;
  canDelete: boolean;
  onSelect: (layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onDelete: (layerId: string) => void;
  onRename: (layerId: string, newName: string) => void;
}

export function LayerItem({
  layer,
  isActive,
  canDelete,
  onSelect,
  onToggleVisibility,
  onDelete,
  onRename,
}: LayerItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sortable hook for drag and drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const sortableStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback(() => {
    if (!isEditing) {
      onSelect(layer.id);
    }
  }, [layer.id, onSelect, isEditing]);

  const handleVisibilityClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleVisibility(layer.id);
  }, [layer.id, onToggleVisibility]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(layer.id);
  }, [layer.id, onDelete]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(layer.name);
    setIsEditing(true);
  }, [layer.name]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditName(e.target.value);
  }, []);

  const handleNameSubmit = useCallback(() => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== layer.name) {
      onRename(layer.id, trimmedName);
    }
    setIsEditing(false);
  }, [editName, layer.id, layer.name, onRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditName(layer.name);
      setIsEditing(false);
    }
  }, [handleNameSubmit, layer.name]);

  const handleBlur = useCallback(() => {
    handleNameSubmit();
  }, [handleNameSubmit]);

  return (
    <div
      ref={setNodeRef}
      data-testid="layer-item"
      className={`layer-item ${isActive ? 'active' : ''}`}
      onClick={handleClick}
      style={{
        ...sortableStyle,
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        gap: '8px',
        backgroundColor: isActive ? '#e3f2fd' : 'transparent',
        borderLeft: isActive ? '3px solid #2196f3' : '3px solid transparent',
        cursor: 'pointer',
      }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab',
          padding: '4px',
          fontSize: '12px',
          color: '#999',
          touchAction: 'none',
        }}
        data-testid="drag-handle"
      >
        ⋮⋮
      </div>

      <button
        data-testid="visibility-toggle"
        onClick={handleVisibilityClick}
        aria-label={layer.visible ? '非表示にする' : '表示する'}
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          padding: '4px',
          fontSize: '16px',
          opacity: layer.visible ? 1 : 0.5,
        }}
      >
        {layer.visible ? '👁' : '👁‍🗨'}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={handleNameChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            style={{
              width: '100%',
              padding: '2px 4px',
              fontSize: '14px',
              border: '1px solid #2196f3',
              borderRadius: '2px',
            }}
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '14px',
            }}
          >
            {layer.name}
          </span>
        )}
      </div>

      <button
        data-testid="delete-button"
        onClick={handleDeleteClick}
        disabled={!canDelete}
        aria-label="削除"
        style={{
          border: 'none',
          background: 'none',
          cursor: canDelete ? 'pointer' : 'not-allowed',
          padding: '4px',
          fontSize: '14px',
          opacity: canDelete ? 1 : 0.3,
        }}
      >
        🗑
      </button>
    </div>
  );
}

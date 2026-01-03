import { useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Layer } from '../../types';
import { LayerItem } from './LayerItem';

interface LayerPanelProps {
  layers: Layer[];
  activeLayerId: string | null;
  canCreateLayer: boolean;
  onSelectLayer: (layerId: string) => void;
  onCreateLayer: () => void;
  onToggleVisibility: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, newName: string) => void;
  onReorderLayers: (layerId: string, newOrder: number) => void;
  onClose: () => void;
}

export function LayerPanel({
  layers,
  activeLayerId,
  canCreateLayer,
  onSelectLayer,
  onCreateLayer,
  onToggleVisibility,
  onDeleteLayer,
  onRenameLayer,
  onReorderLayers,
  onClose,
}: LayerPanelProps) {
  // Sort layers by order descending (highest order at top)
  const sortedLayers = useMemo(() => {
    return [...layers].sort((a, b) => b.order - a.order);
  }, [layers]);

  const canDelete = layers.length > 1;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeLayer = sortedLayers.find((l) => l.id === active.id);
      const overLayer = sortedLayers.find((l) => l.id === over.id);

      if (activeLayer && overLayer) {
        // Calculate new order based on the drop position
        // Since we display highest order at top, we need to swap the order values
        onReorderLayers(activeLayer.id, overLayer.order);
      }
    }
  }, [sortedLayers, onReorderLayers]);

  return (
    <div
      className="layer-panel"
      style={{
        position: 'absolute',
        left: '10px',
        top: '10px',
        width: '250px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 80px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>レイヤー</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            data-testid="create-layer-button"
            onClick={onCreateLayer}
            disabled={!canCreateLayer}
            title={canCreateLayer ? '新しいレイヤーを作成' : '最大10レイヤーまで'}
            style={{
              border: 'none',
              background: canCreateLayer ? '#2196f3' : '#ccc',
              color: 'white',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: canCreateLayer ? 'pointer' : 'not-allowed',
              fontSize: '12px',
            }}
          >
            + 追加
          </button>
          <button
            data-testid="close-panel-button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Layer list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: '100px',
        }}
      >
        {sortedLayers.length === 0 ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: '#666',
              fontSize: '14px',
            }}
          >
            レイヤーがありません
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedLayers.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedLayers.map((layer) => (
                <LayerItem
                  key={layer.id}
                  layer={layer}
                  isActive={layer.id === activeLayerId}
                  canDelete={canDelete}
                  onSelect={onSelectLayer}
                  onToggleVisibility={onToggleVisibility}
                  onDelete={onDeleteLayer}
                  onRename={onRenameLayer}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Footer with max layer message */}
      {!canCreateLayer && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #e0e0e0',
            fontSize: '12px',
            color: '#666',
            textAlign: 'center',
          }}
        >
          最大10レイヤーまで作成できます
        </div>
      )}
    </div>
  );
}

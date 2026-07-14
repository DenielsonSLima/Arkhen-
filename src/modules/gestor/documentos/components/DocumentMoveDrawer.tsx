import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FolderInput } from 'lucide-react';
import { documentosPreferencesService } from '../services/documentosPreferencesService';

export interface DocumentMoveTarget {
  key: string;
  label: string;
  targetFolder: string | null;
  description: string;
}

interface DocumentMoveDrawerProps {
  targets: DocumentMoveTarget[];
  dropTargetKey: string | null;
  storageKey: string;
  canDropOnFolder: (event: React.DragEvent, targetFolder: string | null) => boolean;
  onDropItem: (event: React.DragEvent, targetFolder: string | null) => void;
  onDropTargetChange: (targetKey: string | null) => void;
}

const hasDocumentDrag = (event: React.DragEvent) => (
  Array.from(event.dataTransfer.types).includes('application/x-documentos-item')
);

export const DocumentMoveDrawer: React.FC<DocumentMoveDrawerProps> = ({
  targets,
  dropTargetKey,
  storageKey,
  canDropOnFolder,
  onDropItem,
  onDropTargetChange,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const savedState = await documentosPreferencesService.getDrawerState(storageKey);
        if (!mounted) return;
        setIsOpen(savedState === null ? true : savedState);
      } catch {
        if (!mounted) return;
        setIsOpen(true);
      } finally {
        if (!mounted) return;
        setInitialized(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!initialized) return;
    try {
      void documentosPreferencesService.setDrawerState(storageKey, isOpen);
    } catch {
      // Local storage can be unavailable in restricted browser contexts.
    }
  }, [isOpen, storageKey, initialized]);

  if (targets.length === 0) return null;

  return (
    <aside className={`document-move-drawer ${isOpen ? 'is-open' : 'is-collapsed'}`}>
      {!isOpen ? (
        <button
          type="button"
          className="document-move-drawer__rail"
          onClick={() => setIsOpen(true)}
          onDragOver={(event) => {
            if (!hasDocumentDrag(event)) return;
            event.preventDefault();
            setIsOpen(true);
          }}
          aria-label="Abrir destinos para mover documentos"
        >
          <ChevronLeft size={17} />
          <span>Mover</span>
        </button>
      ) : (
        <div className="document-move-drawer__panel">
          <div className="document-move-drawer__header">
            <div>
              <strong>Mover</strong>
              <span>Arraste para uma pasta</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Ocultar destinos para mover"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="document-move-drawer__targets">
            {targets.map((target) => {
              const isActive = dropTargetKey === target.key;

              return (
                <div
                  key={target.key}
                  className={`document-move-target ${isActive ? 'is-drop-target' : ''}`}
                  onDragOver={(event) => {
                    if (!canDropOnFolder(event, target.targetFolder)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    onDropTargetChange(target.key);
                  }}
                  onDragLeave={() => {
                    onDropTargetChange(dropTargetKey === target.key ? null : dropTargetKey);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDropItem(event, target.targetFolder);
                  }}
                >
                  <FolderInput size={19} />
                  <div>
                    <strong>{target.label}</strong>
                    <span>{target.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};

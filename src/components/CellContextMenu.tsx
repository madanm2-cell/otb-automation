'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CommentOutlined } from '@ant-design/icons';

interface CellContextMenuProps {
  x: number;
  y: number;
  onAddComment: () => void;
  onClose: () => void;
}

export function CellContextMenu({ x, y, onAddComment, onClose }: CellContextMenuProps) {
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const el = document.getElementById('cell-context-menu');
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      id="cell-context-menu"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        zIndex: 9999,
        minWidth: 160,
        padding: '4px 0',
      }}
    >
      <div
        onClick={() => { onAddComment(); onClose(); }}
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <CommentOutlined style={{ color: '#666' }} />
        Add comment
      </div>
    </div>,
    document.body
  );
}

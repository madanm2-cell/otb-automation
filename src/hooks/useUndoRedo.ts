'use client';

import { useState, useCallback, useEffect } from 'react';

interface UndoEntry {
  rowId: string;
  month: string;
  field: string;
  oldValue: number | null;
  newValue: number;
}

const MAX_STACK = 50;

export function useUndoRedo(onApply: (rowId: string, month: string, field: string, value: number | null) => void) {
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  const pushUndo = useCallback((entry: UndoEntry) => {
    setUndoStack(prev => {
      const next = [...prev, entry];
      return next.length > MAX_STACK ? next.slice(-MAX_STACK) : next;
    });
    setRedoStack([]); // Clear redo on new edit
  }, []);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      const next = prev.slice(0, -1);

      // Push to redo
      setRedoStack(r => [...r, entry]);

      // Apply old value
      onApply(entry.rowId, entry.month, entry.field, entry.oldValue);

      return next;
    });
  }, [onApply]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      const next = prev.slice(0, -1);

      // Push to undo
      setUndoStack(u => [...u, entry]);

      // Apply new value
      onApply(entry.rowId, entry.month, entry.field, entry.newValue);

      return next;
    });
  }, [onApply]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    pushUndo,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
  };
}

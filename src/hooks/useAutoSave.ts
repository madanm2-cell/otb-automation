'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
  dirtyCount: number;
  onSave: () => Promise<void>;
  intervalMs?: number;
  debounceMs?: number;
}

/**
 * Auto-save hook: triggers save after interval if dirty,
 * debounces to avoid saving while user is actively typing.
 */
export function useAutoSave({
  dirtyCount,
  onSave,
  intervalMs = 30000,
  debounceMs = 2000,
}: UseAutoSaveOptions) {
  const lastEditTime = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track last edit time
  useEffect(() => {
    if (dirtyCount > 0) {
      lastEditTime.current = Date.now();
    }
  }, [dirtyCount]);

  const tryAutoSave = useCallback(async () => {
    if (dirtyCount === 0) return;

    // Don't save if user edited recently (debounce)
    const timeSinceLastEdit = Date.now() - lastEditTime.current;
    if (timeSinceLastEdit < debounceMs) return;

    await onSave();
  }, [dirtyCount, onSave, debounceMs]);

  // Set up auto-save interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(tryAutoSave, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [tryAutoSave, intervalMs]);

  // Save before unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyCount > 0) {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyCount]);
}

import { useCallback, useState } from 'react';

export interface RoomLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

const STORAGE_PREFIX = 'floormap-layout-';
const DEFAULT_WIDTH = 90;
const DEFAULT_HEIGHT = 60;
const MIN_WIDTH = 60;
const MIN_HEIGHT = 40;

function getStorageKey(roomId: string) {
  return `${STORAGE_PREFIX}${roomId}`;
}

function readLayout(roomId: string): RoomLayout | null {
  try {
    const raw = localStorage.getItem(getStorageKey(roomId));
    if (!raw) return null;
    return JSON.parse(raw) as RoomLayout;
  } catch {
    return null;
  }
}

function writeLayout(roomId: string, layout: RoomLayout) {
  localStorage.setItem(getStorageKey(roomId), JSON.stringify(layout));
}

export function useFloorMapLayout() {
  // revision counter to force re-renders after localStorage writes
  const [rev, setRev] = useState(0);

  const getLayout = useCallback(
    (roomId: string, dbX: number | null, dbY: number | null): RoomLayout => {
      const saved = readLayout(roomId);
      if (saved) return saved;
      return {
        x: dbX ?? 0,
        y: dbY ?? 0,
        w: DEFAULT_WIDTH,
        h: DEFAULT_HEIGHT,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rev]
  );

  const updateLayout = useCallback(
    (roomId: string, partial: Partial<RoomLayout>, dbX: number | null, dbY: number | null) => {
      const current = readLayout(roomId) ?? {
        x: dbX ?? 0,
        y: dbY ?? 0,
        w: DEFAULT_WIDTH,
        h: DEFAULT_HEIGHT,
      };
      const next: RoomLayout = {
        x: partial.x ?? current.x,
        y: partial.y ?? current.y,
        w: Math.max(MIN_WIDTH, partial.w ?? current.w),
        h: Math.max(MIN_HEIGHT, partial.h ?? current.h),
      };
      writeLayout(roomId, next);
      setRev(r => r + 1);
    },
    []
  );

  const resetLayout = useCallback((roomIds: string[]) => {
    roomIds.forEach(id => localStorage.removeItem(getStorageKey(id)));
    setRev(r => r + 1);
  }, []);

  const hasOverride = useCallback((roomId: string) => {
    return readLayout(roomId) !== null;
  }, [rev]); // eslint-disable-line react-hooks/exhaustive-deps

  return { getLayout, updateLayout, resetLayout, hasOverride };
}

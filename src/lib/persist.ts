'use client';

import { CfgModel, serializeCfg } from './cfg';
import { LibImage } from './store';

const KEY = 'overlay-studio-v1';

export interface SavedSession {
  fileName: string;
  cfg: string;
  lib: LibImage[];
  savedAt: number;
  ui?: {
    aspect?: number;
    gridStep?: number;
    showGrid?: boolean;
    snapOn?: boolean;
    showHitbox?: boolean;
  };
}

export function saveSession(fileName: string, model: CfgModel, lib: LibImage[], ui?: SavedSession['ui']) {
  try {
    const data: SavedSession = {
      fileName,
      cfg: serializeCfg(model),
      lib,
      savedAt: Date.now(),
      ui,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota exceeded (large images) — ignore */
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as SavedSession;
    if (!p?.cfg || !p?.fileName) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

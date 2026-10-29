'use client';

import { resolveImgRef } from './cfg';

export interface PresetCfg {
  name: string;
  file: string;
  path: string;
  dir: string;
  overlays: number;
  descs: number;
  names: string[];
  thumb: string | null;
}

export interface PresetCategory {
  id: string;
  count: number;
  cfgs: PresetCfg[];
}

export interface PresetIndex {
  generated: string;
  source: string;
  license: string;
  categories: PresetCategory[];
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const presetsIndexUrl = () => `${BASE}/presets/index.json`;
export const presetsFileUrl = (rel: string) => `${BASE}/presets/${rel.split('/').map(encodeURIComponent).join('/')}`;

let cachedIndex: PresetIndex | null = null;

export async function fetchPresetIndex(): Promise<PresetIndex> {
  if (cachedIndex) return cachedIndex;
  const res = await fetch(presetsIndexUrl());
  if (!res.ok) throw new Error(`Failed to load preset index (${res.status})`);
  cachedIndex = (await res.json()) as PresetIndex;
  return cachedIndex;
}

export async function fetchPresetCfg(p: string): Promise<string> {
  const res = await fetch(presetsFileUrl(p));
  if (!res.ok) throw new Error(`Failed to load ${p} (${res.status})`);
  return res.text();
}

/** absolute URL for an image ref found inside a preset cfg */
export function presetImgUrl(cfgDir: string, ref: string): string {
  return presetsFileUrl(resolveImgRef(cfgDir, ref));
}

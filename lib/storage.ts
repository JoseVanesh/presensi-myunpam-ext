import { browser } from 'wxt/browser';
import { CACHE_KEY } from './messages';
import type { PresensiCache } from './types';

export async function getCache(): Promise<PresensiCache | null> {
  const stored = await browser.storage.local.get(CACHE_KEY);
  const cache = stored?.[CACHE_KEY] as PresensiCache | undefined;
  if (!cache || typeof cache !== 'object' || cache.version !== 1) return null;
  return cache;
}

export async function setCache(cache: PresensiCache): Promise<void> {
  await browser.storage.local.set({ [CACHE_KEY]: cache });
}

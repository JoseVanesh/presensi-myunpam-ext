import type { RawPresensiResult } from './types';

export const PORTAL_ORIGIN = 'https://my.unpam.ac.id';
export const PORTAL_PAGE = `${PORTAL_ORIGIN}/presensi`;
export const PORTAL_MATCH = `${PORTAL_ORIGIN}/*`;

export const MSG_SYNC = 'unpam:presensi:sync';
export const MSG_PROGRESS = 'unpam:presensi:progress';

export const CACHE_KEY = 'unpam:presensi:cache:v1';

const PAGE_NAMESPACE = 'unpam:presensi:page';
export const PAGE_REQUEST = `${PAGE_NAMESPACE}:request`;
export const PAGE_RESULT = `${PAGE_NAMESPACE}:result`;
export const PAGE_PROGRESS = `${PAGE_NAMESPACE}:progress`;

export interface SyncRequestMessage {
  type: typeof MSG_SYNC;
}

export interface ProgressMessage {
  type: typeof MSG_PROGRESS;
  done: number;
  total: number;
  name: string;
}

export interface PageRequest {
  __unpam: 1;
  type: typeof PAGE_REQUEST;
  id: string;
}

export interface PageResult {
  __unpam: 1;
  type: typeof PAGE_RESULT;
  id: string;
  ok: boolean;
  result?: RawPresensiResult;
  error?: string;
}

export interface PageProgress {
  __unpam: 1;
  type: typeof PAGE_PROGRESS;
  id: string;
  done: number;
  total: number;
  name: string;
}

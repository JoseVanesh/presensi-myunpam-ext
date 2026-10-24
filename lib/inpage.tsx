import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { MIN_ATTENDANCE, countBelow, countUnrecorded } from './attendance';
import { CACHE_KEY, type ProgressMessage } from './messages';
import { getCache } from './storage';
import type { PresensiCache, SyncResponse } from './types';
import {
  ClipboardIcon,
  CloseIcon,
  CourseCard,
  RefreshIcon,
  SkeletonCard,
  Stat,
  formatUpdatedAt,
  friendlyError,
} from './ui';

type SyncFn = (
  onProgress?: (progress: ProgressMessage) => void,
) => Promise<SyncResponse>;

type Anchor = { side: 'left' | 'right'; offset: number };

function isHiddenRoute(): boolean {
  return /^\/(login|login-satu-sampai-enam|validasi)(\/|$)/.test(window.location.pathname);
}

function findSidebar(): HTMLElement | null {
  const selectors = ['.q-drawer', 'aside', '[class*="sidebar"]', 'nav'];

  for (const selector of selectors) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const candidate of candidates) {
      const rect = candidate.getBoundingClientRect();
      if (
        rect.width >= 48 &&
        rect.width <= 420 &&
        rect.height >= 300 &&
        rect.right > 0 &&
        rect.left < window.innerWidth
      ) {
        return candidate;
      }
    }
  }

  return null;
}

function computeAnchor(): Anchor {
  if (window.innerWidth < 640) return { side: 'left', offset: 16 };

  const sidebar = findSidebar();
  if (!sidebar) return { side: 'left', offset: 16 };

  const rect = sidebar.getBoundingClientRect();
  const center = rect.left + rect.width / 2;
  if (center < window.innerWidth / 2) {
    return { side: 'left', offset: Math.max(8, Math.round(center - 22)) };
  }
  return { side: 'right', offset: Math.max(8, Math.round(window.innerWidth - center - 22)) };
}

export function InPageApp({ onSync }: { onSync: SyncFn }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(isHiddenRoute);
  const [anchor, setAnchor] = useState<Anchor>({ side: 'left', offset: 16 });
  const [cache, setCache] = useState<PresensiCache | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;

    void getCache().then((value) => {
      if (alive) setCache(value);
    });

    const onStorageChanged = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName !== 'local' || !changes[CACHE_KEY]) return;
      const next = changes[CACHE_KEY].newValue as PresensiCache | undefined;
      if (next && next.version === 1) setCache(next);
    };

    browser.storage.onChanged.addListener(onStorageChanged);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(onStorageChanged);
    };
  }, []);

  useEffect(() => {
    const update = () => setHidden(isHiddenRoute());
    window.addEventListener('popstate', update);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.removeEventListener('popstate', update);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const update = () => setAnchor(computeAnchor());
    update();
    window.addEventListener('resize', update);
    const timer = window.setInterval(update, 1500);
    return () => {
      window.removeEventListener('resize', update);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (hidden && open) setOpen(false);
  }, [hidden, open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current) return;
      if (!event.composedPath().includes(rootRef.current)) setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const runSync = useCallback(async () => {
    setError(null);
    setProgress(null);
    setLoading(true);

    try {
      const response = await onSync((next) =>
        setProgress({ done: next.done, total: next.total, name: next.name }),
      );
      if (!response.ok) throw new Error(response.error);
      setCache(response.cache);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [onSync]);

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    if (!cache && !loading) void runSync();
  }, [open, cache, loading, runSync]);

  const below = useMemo(() => (cache ? countBelow(cache.courses) : 0), [cache]);
  const unrecorded = useMemo(() => (cache ? countUnrecorded(cache.courses) : 0), [cache]);
  const semesterName = cache?.semester?.name ?? 'Semester aktif';

  if (hidden) return null;

  return (
    <div
      ref={rootRef}
      className="fixed bottom-4 z-[2147483000] font-sans"
      style={anchor.side === 'left' ? { left: anchor.offset } : { right: anchor.offset }}
    >
      {open ? (
        <section
          role="dialog"
          aria-label="Presensi"
          className={`absolute bottom-14 flex max-h-[min(70vh,560px)] w-[370px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 shadow-2xl ${
            anchor.side === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                <ClipboardIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight text-slate-800">Presensi</p>
                <p className="truncate text-[11px] text-slate-500">{semesterName}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void runSync()}
                disabled={loading}
                title="Muat data"
                aria-label="Muat data"
                className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshIcon spinning={loading} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Tutup"
                aria-label="Tutup"
                className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100"
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          {loading ? (
            <div className="h-1 w-full overflow-hidden bg-emerald-100">
              <div
                className="h-1 bg-emerald-500 transition-all"
                style={{
                  width:
                    progress && progress.total > 0
                      ? `${(progress.done / progress.total) * 100}%`
                      : '15%',
                }}
              />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {error ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-700">
                {error}
              </div>
            ) : null}

            {cache ? (
              <>
                <div className="mb-3 flex gap-2">
                  <Stat label="mata kuliah" value={String(cache.courses.length)} tone="neutral" />
                  <Stat
                    label={`di bawah ${MIN_ATTENDANCE}%`}
                    value={String(below)}
                    tone={below > 0 ? 'danger' : 'neutral'}
                  />
                  <Stat
                    label="belum diabsen"
                    value={String(unrecorded)}
                    tone={unrecorded > 0 ? 'warning' : 'neutral'}
                  />
                </div>

                {below > 0 ? (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                    {below} mata kuliah di bawah ambang {MIN_ATTENDANCE}%.
                  </div>
                ) : unrecorded > 0 ? (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    {unrecorded} pertemuan lewat belum diabsen dan dihitung belum hadir.
                  </div>
                ) : null}

                {cache.failed.length > 0 ? (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    {cache.failed.length} mata kuliah gagal dimuat. Coba muat data lagi.
                  </div>
                ) : null}

                {loading && cache.courses.length === 0 ? (
                  <div className="space-y-2">
                    <SkeletonCard />
                    <SkeletonCard />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cache.courses.map((course) => (
                      <CourseCard key={`${course.idKelas}/${course.idMataKuliah}`} course={course} />
                    ))}
                  </div>
                )}
              </>
            ) : loading ? (
              <div className="space-y-2">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
                <p className="text-sm font-semibold text-slate-700">Belum ada data presensi</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Muat data untuk melihat persentase kehadiran tiap mata kuliah.
                </p>
                <button
                  type="button"
                  onClick={() => void runSync()}
                  className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  Muat data
                </button>
              </div>
            )}

            {loading && progress ? (
              <p className="mt-3 truncate text-center text-[10px] text-slate-500">
                Memuat {Math.min(progress.done + 1, progress.total)}/{progress.total}
                {progress.name ? ` · ${progress.name}` : ''}
              </p>
            ) : null}
          </div>

          <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2">
            <span className="text-[10px] text-slate-500">
              {cache ? formatUpdatedAt(cache.updatedAt) : 'Belum pernah dimuat'}
            </span>
            <span className="text-[10px] text-slate-400">Ambang {MIN_ATTENDANCE}%</span>
          </footer>
        </section>
      ) : null}

      <button
        type="button"
        onClick={toggle}
        title="Presensi"
        aria-label="Buka presensi"
        aria-expanded={open}
        className="relative grid h-11 w-11 place-items-center rounded-full bg-emerald-600 text-white shadow-lg ring-1 ring-emerald-700/20 transition hover:bg-emerald-700 active:scale-95"
      >
        <ClipboardIcon className="h-5 w-5" />
        {below > 0 && !open ? (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
        ) : null}
      </button>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { MIN_ATTENDANCE, countBelow, countUnrecorded } from '@/lib/attendance';
import {
  CACHE_KEY,
  MSG_PROGRESS,
  MSG_SYNC,
  PORTAL_MATCH,
  PORTAL_PAGE,
  type ProgressMessage,
} from '@/lib/messages';
import { getCache } from '@/lib/storage';
import type { PresensiCache, SyncResponse } from '@/lib/types';
import {
  CourseCard,
  RefreshIcon,
  SkeletonCard,
  Stat,
  formatUpdatedAt,
  friendlyError,
} from '@/lib/ui';

function findPortalTab(): Promise<number | null> {
  return browser.tabs
    .query({ url: PORTAL_MATCH })
    .then((tabs) => tabs.find((tab) => tab.id !== undefined)?.id ?? null)
    .catch(() => null);
}

export default function App() {
  const [cache, setCache] = useState<PresensiCache | null>(null);
  const [portalTabId, setPortalTabId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);

  useEffect(() => {
    let alive = true;

    void getCache().then((value) => {
      if (alive) setCache(value);
    });
    void findPortalTab().then((tabId) => {
      if (alive) setPortalTabId(tabId);
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
    const onMessage = (message: unknown) => {
      const payload = message as ProgressMessage | null;
      if (payload?.type !== MSG_PROGRESS) return;
      setProgress({ done: payload.done, total: payload.total, name: payload.name });
    };

    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, []);

  const sync = useCallback(async () => {
    setError(null);
    setProgress(null);
    setLoading(true);

    try {
      const tabId = portalTabId ?? (await findPortalTab());
      if (tabId === null) {
        setError('Portal belum terbuka. Buka my.unpam.ac.id, login, lalu klik Muat data.');
        return;
      }

      setPortalTabId(tabId);
      const response = (await browser.tabs.sendMessage(tabId, { type: MSG_SYNC })) as
        | SyncResponse
        | undefined;

      if (!response) throw new Error('Portal tidak memberi respons. Coba muat ulang halaman portal.');
      if (!response.ok) throw new Error(response.error);

      setCache(response.cache);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [portalTabId]);

  const openPortal = useCallback(async () => {
    if (portalTabId !== null) {
      try {
        await browser.tabs.update(portalTabId, { active: true });
        return;
      } catch {
        // Tab lama sudah tidak ada.
      }
    }
    const tab = await browser.tabs.create({ url: PORTAL_PAGE });
    if (tab.id !== undefined) setPortalTabId(tab.id);
  }, [portalTabId]);

  const below = useMemo(() => (cache ? countBelow(cache.courses) : 0), [cache]);
  const unrecorded = useMemo(() => (cache ? countUnrecorded(cache.courses) : 0), [cache]);
  const semesterName = cache?.semester?.name ?? 'Semester aktif';

  return (
    <div className="w-[360px] bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="grid h-5 w-5 place-items-center rounded bg-emerald-600 text-[11px] font-bold text-white">
              P
            </span>
            <h1 className="text-sm font-bold tracking-tight text-slate-800">Presensi</h1>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{semesterName}</p>
        </div>

        <button
          type="button"
          onClick={() => void sync()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshIcon spinning={loading} />
          {loading ? 'Memuat' : 'Muat data'}
        </button>
      </header>

      {loading ? (
        <div className="h-1 w-full overflow-hidden bg-emerald-100">
          <div
            className="h-1 bg-emerald-500 transition-all"
            style={{
              width: progress && progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '15%',
            }}
          />
        </div>
      ) : null}

      <main className="max-h-[500px] overflow-y-auto px-3 py-3">
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
                {cache.failed.length} mata kuliah gagal dimuat. Coba Muat data lagi.
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
              Buka portal, login, lalu muat data. Persentase = jumlah hadir ÷ total pertemuan.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void sync()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                Muat data
              </button>
              <button
                type="button"
                onClick={() => void openPortal()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Buka portal
              </button>
            </div>
          </div>
        )}

        {loading && progress ? (
          <p className="mt-3 truncate text-center text-[10px] text-slate-500">
            Memuat {Math.min(progress.done + 1, progress.total)}/{progress.total}
            {progress.name ? ` · ${progress.name}` : ''}
          </p>
        ) : null}
      </main>

      <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2">
        <span className="text-[10px] text-slate-500">
          {cache ? formatUpdatedAt(cache.updatedAt) : 'Belum pernah dimuat'}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400">Ambang {MIN_ATTENDANCE}%</span>
          <button
            type="button"
            onClick={() => void openPortal()}
            className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Buka portal
          </button>
        </div>
      </footer>
    </div>
  );
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { buildCache } from '@/lib/attendance';
import { InPageApp } from '@/lib/inpage';
import '@/lib/inpage.css';
import {
  MSG_PROGRESS,
  MSG_SYNC,
  PAGE_PROGRESS,
  PAGE_REQUEST,
  PAGE_RESULT,
  type PageProgress,
  type PageRequest,
  type PageResult,
  type ProgressMessage,
} from '@/lib/messages';
import { normalizeResult } from '@/lib/normalize';
import { setCache } from '@/lib/storage';
import type { RawPresensiResult, SyncResponse } from '@/lib/types';

export default defineContentScript({
  matches: ['https://my.unpam.ac.id/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const type = (message as { type?: string } | null)?.type;
      if (type !== MSG_SYNC) return;

      sync()
        .then((response) => sendResponse(response))
        .catch((error) =>
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          } satisfies SyncResponse),
        );

      return true;
    });

    if (!document.body) {
      await new Promise<void>((resolve) => {
        const timer = window.setInterval(() => {
          if (!document.body) return;
          window.clearInterval(timer);
          resolve();
        }, 50);
      });
    }

    const ui = await createShadowRootUi(ctx, {
      name: 'unpam-presensi',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(
          <React.StrictMode>
            <InPageApp onSync={sync} />
          </React.StrictMode>,
        );
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });

    ui.mount();
  },
});

async function sync(
  onProgress?: (progress: ProgressMessage) => void,
): Promise<SyncResponse> {
  const raw = await requestFromPage(onProgress);
  const normalized = normalizeResult(raw);
  const cache = buildCache(
    normalized.semester,
    normalized.courses,
    normalized.details,
    normalized.failed,
  );
  await setCache(cache);
  return { ok: true, cache };
}

async function sendProgress(message: ProgressMessage) {
  try {
    await browser.runtime.sendMessage(message);
  } catch {
    // Popup bisa saja sudah tertutup.
  }
}

function requestFromPage(
  onProgress?: (progress: ProgressMessage) => void,
): Promise<RawPresensiResult> {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Portal tidak merespons. Muat ulang halaman portal lalu coba lagi.'));
    }, 60000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as (PageProgress | PageResult) | null;
      if (!data || data.__unpam !== 1 || data.id !== id) return;

      if (data.type === PAGE_PROGRESS) {
        const progress: ProgressMessage = {
          type: MSG_PROGRESS,
          done: data.done,
          total: data.total,
          name: data.name,
        };
        onProgress?.(progress);
        void sendProgress(progress);
        return;
      }

      if (data.type === PAGE_RESULT) {
        cleanup();
        if (data.ok && data.result) {
          resolve(data.result);
        } else {
          reject(new Error(data.error ?? 'Gagal memuat data presensi.'));
        }
      }
    };

    window.addEventListener('message', onMessage);
    const request: PageRequest = { __unpam: 1, type: PAGE_REQUEST, id };
    window.postMessage(request, '*');
  });
}

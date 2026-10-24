import {
  PAGE_PROGRESS,
  PAGE_REQUEST,
  PAGE_RESULT,
  type PageProgress,
  type PageRequest,
  type PageResult,
} from '@/lib/messages';
import { normalizeSemester } from '@/lib/normalize';
import type { PageDetail, RawPresensiResult } from '@/lib/types';

interface AxiosLike {
  get(url: string, config?: Record<string, unknown>): Promise<{ status: number; data: unknown }>;
}

interface VueVm {
  $axios?: AxiosLike;
  $store?: { state?: { userToken?: string } };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function findVm(): VueVm | null {
  const element = document.querySelector('#q-app, #app') as
    | (Element & { __vue__?: VueVm })
    | null;
  if (element?.__vue__) return element.__vue__;

  const nodes = document.querySelectorAll('*') as NodeListOf<Element & { __vue__?: VueVm }>;
  for (const node of Array.from(nodes)) {
    const candidate = node.__vue__;
    if (candidate && (candidate.$axios || candidate.$store)) return candidate;
  }

  return null;
}

async function waitForVm(): Promise<VueVm> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const vm = findVm();
    if (vm) return vm;
    await sleep(200);
  }
  throw new Error('Portal tidak terdeteksi. Buka my.unpam.ac.id lalu muat ulang halaman.');
}

async function getViaToken(vm: VueVm, path: string): Promise<PageDetail> {
  const token = vm.$store?.state?.userToken;
  if (!token) throw new Error('Sesi portal tidak ditemukan. Login ulang di portal.');

  const response = await fetch(`/api/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    credentials: 'same-origin',
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function apiGet(vm: VueVm, path: string): Promise<PageDetail> {
  if (vm.$axios) {
    try {
      const response = await vm.$axios.get(path, {
        validateStatus: () => true,
        timeout: 15000,
      });
      if (response.status !== 401) {
        return { status: response.status, data: response.data };
      }
    } catch {
      // Fall back to fetch with the token stored in Vuex.
    }
  }

  return getViaToken(vm, path);
}

function post(message: PageProgress | PageResult) {
  window.postMessage(message, '*');
}

function normalizePageSemester(data: unknown) {
  return normalizeSemester(data);
}

async function fetchAll(id: string): Promise<RawPresensiResult> {
  const vm = await waitForVm();

  const semesterDetail = await apiGet(vm, 'presensi/semester-aktif');
  if (semesterDetail.status === 401) {
    throw new Error('Sesi portal tidak valid. Login ulang di portal, lalu muat data lagi.');
  }
  if (semesterDetail.status !== 200) {
    throw new Error(`Gagal memuat semester aktif (HTTP ${semesterDetail.status}).`);
  }

  const listDetail = await apiGet(vm, 'presensi/mahasiswa/jadwal-kuliah');
  if (listDetail.status === 401) {
    throw new Error('Sesi portal tidak valid. Login ulang di portal, lalu muat data lagi.');
  }
  if (listDetail.status !== 200) {
    throw new Error(`Gagal memuat daftar mata kuliah (HTTP ${listDetail.status}).`);
  }

  const courses = Array.isArray(listDetail.data)
    ? listDetail.data
    : ((listDetail.data as { data?: unknown[] } | null)?.data ?? []);

  const details: Record<string, PageDetail> = {};

  for (let index = 0; index < courses.length; index += 1) {
    const course = courses[index] as Record<string, unknown> | null;
    const idKelas = String(course?.id_kelas ?? '');
    const idMataKuliah = String(course?.id_mata_kuliah ?? '');
    if (!idKelas || !idMataKuliah) continue;

    post({
      __unpam: 1,
      type: PAGE_PROGRESS,
      id,
      done: index,
      total: courses.length,
      name: String(course?.nama_mata_kuliah ?? 'Mata kuliah'),
    });

    const key = `${idKelas}/${idMataKuliah}`;
    try {
      details[key] = await apiGet(
        vm,
        `presensi/mahasiswa/jadwal-pertemuan/${encodeURIComponent(idKelas)}/${encodeURIComponent(idMataKuliah)}`,
      );
    } catch {
      details[key] = { status: 0, data: null };
    }

    await sleep(200);
  }

  post({
    __unpam: 1,
    type: PAGE_PROGRESS,
    id,
    done: courses.length,
    total: courses.length,
    name: '',
  });

  return {
    semester: normalizePageSemester(semesterDetail.data),
    list: listDetail.data,
    details,
  };
}

async function handleRequest(id: string) {
  try {
    const result = await fetchAll(id);
    post({ __unpam: 1, type: PAGE_RESULT, id, ok: true, result });
  } catch (error) {
    post({
      __unpam: 1,
      type: PAGE_RESULT,
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default defineContentScript({
  matches: ['https://my.unpam.ac.id/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as Partial<PageRequest> | null;
      if (!data || data.__unpam !== 1 || data.type !== PAGE_REQUEST || typeof data.id !== 'string') {
        return;
      }
      void handleRequest(data.id);
    });
  },
});

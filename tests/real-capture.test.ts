import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCache } from '@/lib/attendance';
import { normalizeResult, normalizeSemester } from '@/lib/normalize';

const capturePath = resolve(process.cwd(), 'myunpam-presensi.json');
const hasCapture = existsSync(capturePath);

describe.skipIf(!hasCapture)('capture asli my.unpam.ac.id', () => {
  it('menghasilkan persentase yang sesuai dengan data portal', () => {
    const raw = JSON.parse(readFileSync(capturePath, 'utf8')) as {
      semester: unknown;
      list: unknown;
      detail: Record<string, unknown>;
    };

    const details = Object.fromEntries(
      Object.entries(raw.detail).map(([key, data]) => [key, { status: 200, data }]),
    );

    const normalized = normalizeResult({
      semester: normalizeSemester(raw.semester),
      list: raw.list,
      details,
    });
    const cache = buildCache(
      normalized.semester,
      normalized.courses,
      normalized.details,
      normalized.failed,
    );

    const percentByName = Object.fromEntries(
      cache.courses.map((course) => [course.name, course.percent]),
    );

    expect(cache.courses).toHaveLength(8);
    expect(cache.failed).toEqual([]);
    expect(percentByName['ARSITEKTUR DAN ORGANISASI KOMPUTER']).toBe(38.1);
    expect(percentByName['PEMROGRAMAN WEB II']).toBe(33.3);
    expect(percentByName['KEAMANAN KOMPUTER']).toBe(42.9);
    expect(percentByName['ETIKA PROFESI']).toBe(50);
    expect(percentByName['JARINGAN NIRKABEL']).toBe(50);
    expect(percentByName['KECAKAPAN ANTAR PERSONAL']).toBe(50);
    expect(percentByName['MANAJEMEN PROYEK INFORMATIKA']).toBe(50);
    expect(percentByName['TESTING DAN QA PERANGKAT LUNAK']).toBe(50);
    expect(cache.courses.find((course) => course.name === 'PEMROGRAMAN WEB II')?.total).toBe(21);
    expect(cache.courses.find((course) => course.name === 'ETIKA PROFESI')?.total).toBe(14);
    expect(cache.courses.filter((course) => course.belowMin)).toHaveLength(8);
  });
});

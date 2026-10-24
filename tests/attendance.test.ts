import { describe, expect, it } from 'vitest';
import {
  MIN_ATTENDANCE,
  buildCache,
  computeCourse,
  countBelow,
  countUnrecorded,
  formatPercent,
} from '@/lib/attendance';
import {
  normalizeMeetings,
  normalizeResult,
  normalizeSemester,
  normalizeStatus,
} from '@/lib/normalize';
import type { Meeting, PortalCourse } from '@/lib/types';

const course: PortalCourse = {
  idKelas: 'K1',
  idMataKuliah: 'M1',
  name: 'Mata Kuliah Uji',
  sks: 2,
};

function meeting(status: Meeting['status'], extra: Partial<Meeting> = {}): Meeting {
  return {
    dateStart: '2026-09-01',
    dateEnd: '2026-09-05',
    time: '07.10 - 08.50',
    kind: 'tatap muka',
    status,
    recordedAt: status ? '2026-09-01 08:00:00' : null,
    isPast: true,
    ...extra,
  };
}

function repeat(count: number, factory: () => Meeting): Meeting[] {
  return Array.from({ length: count }, factory);
}

describe('computeCourse', () => {
  it('menghitung tepat 70% sebagai lolos ambang', () => {
    const meetings = [...repeat(7, () => meeting('hadir')), ...repeat(3, () => meeting(null))];
    const result = computeCourse(course, meetings);

    expect(result.total).toBe(10);
    expect(result.hadir).toBe(7);
    expect(result.unrecorded).toBe(3);
    expect(result.percent).toBe(70);
    expect(result.percent).toBe(MIN_ATTENDANCE);
    expect(result.belowMin).toBe(false);
  });

  it('menandai 69.2% sebagai di bawah ambang', () => {
    const meetings = [...repeat(9, () => meeting('hadir')), ...repeat(4, () => meeting('alpha'))];
    const result = computeCourse(course, meetings);

    expect(result.total).toBe(13);
    expect(result.percent).toBe(69.2);
    expect(result.belowMin).toBe(true);
  });

  it('mengembalikan null jika tidak ada pertemuan', () => {
    const result = computeCourse(course, []);

    expect(result.total).toBe(0);
    expect(result.percent).toBeNull();
    expect(result.belowMin).toBe(false);
  });

  it('memakai total seluruh pertemuan sebagai penyebut', () => {
    const meetings = [
      ...repeat(7, () => meeting('hadir')),
      ...repeat(7, () => meeting(null, { isPast: false, recordedAt: null })),
    ];
    const result = computeCourse(course, meetings);

    expect(result.total).toBe(14);
    expect(result.hadir).toBe(7);
    expect(result.unrecorded).toBe(0);
    expect(result.percent).toBe(50);
    expect(result.belowMin).toBe(true);
  });

  it('menghitung pertemuan ganda di minggu yang sama secara terpisah', () => {
    const meetings = [
      meeting('hadir'),
      meeting('hadir'),
      meeting('alpha'),
      meeting(null),
    ];
    const result = computeCourse(course, meetings);

    expect(result.total).toBe(4);
    expect(result.hadir).toBe(2);
    expect(result.alpha).toBe(1);
    expect(result.unrecorded).toBe(1);
    expect(result.percent).toBe(50);
    expect(result.belowMin).toBe(true);
  });

  it('tidak menambahkan sakit dan izin ke pembilang', () => {
    const meetings = [
      ...repeat(7, () => meeting('hadir')),
      meeting('sakit'),
      meeting('izin'),
      meeting('alpha'),
    ];
    const result = computeCourse(course, meetings);

    expect(result.hadir).toBe(7);
    expect(result.sakit).toBe(1);
    expect(result.izin).toBe(1);
    expect(result.alpha).toBe(1);
    expect(result.percent).toBe(70);
    expect(result.belowMin).toBe(false);
  });
});

describe('buildCache', () => {
  it('mengurutkan persen terendah lebih dulu dan yang kosong paling akhir', () => {
    const courses: PortalCourse[] = [
      { ...course, idMataKuliah: 'M1', name: 'Aman' },
      { ...course, idMataKuliah: 'M2', name: 'Kosong' },
      { ...course, idMataKuliah: 'M3', name: 'Bahaya' },
    ];
    const details: Record<string, Meeting[]> = {
      'K1/M1': repeat(7, () => meeting('hadir')),
      'K1/M3': [...repeat(4, () => meeting('hadir')), ...repeat(6, () => meeting('alpha'))],
    };

    const cache = buildCache(null, courses, details, ['K1/M2']);

    expect(cache.courses.map((item) => item.name)).toEqual(['Bahaya', 'Aman', 'Kosong']);
    expect(cache.courses[0]!.belowMin).toBe(true);
    expect(cache.courses[1]!.belowMin).toBe(false);
    expect(cache.courses[2]!.percent).toBeNull();
    expect(cache.failed).toEqual(['K1/M2']);
  });

  it('menghitung ringkasan di bawah ambang dan belum diabsen', () => {
    const courses: PortalCourse[] = [
      { ...course, idMataKuliah: 'M1' },
      { ...course, idMataKuliah: 'M2' },
    ];
    const details: Record<string, Meeting[]> = {
      'K1/M1': [...repeat(4, () => meeting('hadir')), ...repeat(6, () => meeting(null))],
      'K1/M2': [...repeat(7, () => meeting('hadir')), ...repeat(3, () => meeting(null))],
    };

    const cache = buildCache(null, courses, details, []);

    expect(countBelow(cache.courses)).toBe(1);
    expect(countUnrecorded(cache.courses)).toBe(9);
  });
});

describe('formatPercent', () => {
  it('memformat angka bulat, desimal, dan null', () => {
    expect(formatPercent(70)).toBe('70%');
    expect(formatPercent(85.7)).toBe('85.7%');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('normalizeStatus', () => {
  it('menormalkan variasi kapitalisasi dan alias', () => {
    expect(normalizeStatus('Hadir')).toBe('hadir');
    expect(normalizeStatus(' H ')).toBe('hadir');
    expect(normalizeStatus('ALPA')).toBe('alpha');
    expect(normalizeStatus('sakit')).toBe('sakit');
    expect(normalizeStatus('IZIN')).toBe('izin');
    expect(normalizeStatus('')).toBeNull();
    expect(normalizeStatus(null)).toBeNull();
    expect(normalizeStatus('lainnya')).toBe('lain');
  });
});

describe('normalizeMeetings', () => {
  it('menerima array langsung, data, dan pertemuan', () => {
    const item = {
      presensi_status: 'Hadir',
      presensi_date: '2026-09-01 08:00:00',
      date_status: 'lessthan',
      tanggal_mulai: '2026-09-01',
      tanggal_akhir: '2026-09-05',
      ket_jam: '07.10 - 08.50',
      jenis_perkuliahan: 'tatap muka',
    };

    for (const input of [[item], { data: [item] }, { pertemuan: [item] }]) {
      const meetings = normalizeMeetings(input);
      expect(meetings).toHaveLength(1);
      expect(meetings[0]!.status).toBe('hadir');
      expect(meetings[0]!.isPast).toBe(true);
    }
  });

  it('mengabaikan pertemuan yang akan datang dan item rusak', () => {
    const meetings = normalizeMeetings([
      { date_status: 'greaterthan', tanggal_mulai: '2026-12-01' },
      null,
      'bukan objek',
      { date_status: 'lessthan', presensi_status: null },
    ]);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.isPast).toBe(false);
    expect(meetings[1]!.isPast).toBe(true);
    expect(meetings[1]!.status).toBeNull();
  });

  it('memakai tanggal akhir sebagai cadangan jika date_status tidak dikenal', () => {
    const meetings = normalizeMeetings([
      { date_status: 'unknown', tanggal_akhir: '2020-01-01' },
      { date_status: 'unknown', tanggal_akhir: '2999-01-01' },
    ]);

    expect(meetings[0]!.isPast).toBe(true);
    expect(meetings[1]!.isPast).toBe(false);
  });
});

describe('normalizeResult', () => {
  it('membaca daftar MK dan membungkus detail berstatus', () => {
    const raw = {
      semester: normalizeSemester({
        id_semester_registrasi: '20261',
        nama_semester_registrasi: 'GANJIL 2026/2027',
      }),
      list: [
        {
          id_kelas: 'K1',
          id_mata_kuliah: 'M1',
          nama_mata_kuliah: 'Algoritma',
          sks: '3',
        },
      ],
      details: {
        'K1/M1': {
          status: 200,
          data: [
            {
              presensi_status: 'hadir',
              presensi_date: '2026-09-01 08:00:00',
              date_status: 'lessthan',
            },
          ],
        },
      },
    };

    const normalized = normalizeResult(raw);

    expect(normalized.semester?.id).toBe('20261');
    expect(normalized.courses).toHaveLength(1);
    expect(normalized.courses[0]!).toMatchObject({
      idKelas: 'K1',
      idMataKuliah: 'M1',
      name: 'Algoritma',
      sks: 3,
    });
    expect(normalized.details['K1/M1']).toHaveLength(1);
    expect(normalized.failed).toEqual([]);
  });

  it('mencatat MK yang detailnya bukan 200', () => {
    const raw = {
      semester: null,
      list: [{ id_kelas: 'K1', id_mata_kuliah: 'M1', nama_mata_kuliah: 'Gagal', sks: 2 }],
      details: {
        'K1/M1': { status: 401, data: { message: 'Token tidak valid' } },
      },
    };

    const normalized = normalizeResult(raw);

    expect(normalized.details['K1/M1']).toEqual([]);
    expect(normalized.failed).toEqual(['Gagal']);
  });
});

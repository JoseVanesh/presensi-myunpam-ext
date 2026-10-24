import { z } from 'zod';
import type {
  AttendanceStatus,
  Meeting,
  PageDetail,
  PortalCourse,
  PortalSemester,
  RawPresensiResult,
} from './types';

const nullableString = z.preprocess(
  (value) => (value === null || value === undefined || value === '' ? null : String(value)),
  z.string().nullable(),
).catch(null);

const meetingSchema = z
  .object({
    jenis_perkuliahan: nullableString,
    tanggal_mulai: nullableString,
    tanggal_akhir: nullableString,
    ket_jam: nullableString,
    presensi_status: nullableString,
    presensi_date: nullableString,
    date_status: nullableString,
  })
  .passthrough();

export interface NormalizedResult {
  semester: PortalSemester | null;
  courses: PortalCourse[];
  details: Record<string, Meeting[]>;
  failed: string[];
}

export function normalizeStatus(value: string | null): AttendanceStatus | null {
  const status = (value ?? '').trim().toLowerCase();
  if (!status) return null;
  if (status === 'hadir' || status === 'h') return 'hadir';
  if (status === 'alpha' || status === 'alpa' || status === 'a') return 'alpha';
  if (status === 'sakit' || status === 's') return 'sakit';
  if (status === 'izin' || status === 'i') return 'izin';
  return 'lain';
}

function pickArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    for (const key of ['data', 'pertemuan', 'presensi', 'items', 'rows']) {
      if (Array.isArray(record[key])) return record[key];
    }
  }
  return [];
}

function isPastMeeting(
  dateStatus: string | null,
  dateEnd: string | null,
  recordedAt: string | null,
  status: AttendanceStatus | null,
): boolean {
  const marker = (dateStatus ?? '').trim().toLowerCase();
  if (marker === 'lessthan') return true;
  if (marker === 'greaterthan') return false;

  if (dateEnd) {
    const timestamp = Date.parse(dateEnd.length <= 10 ? `${dateEnd}T23:59:59` : dateEnd);
    if (!Number.isNaN(timestamp)) return timestamp <= Date.now();
  }

  return Boolean(recordedAt) || status !== null;
}

function toMeeting(raw: z.infer<typeof meetingSchema>): Meeting {
  const status = normalizeStatus(raw.presensi_status);
  return {
    dateStart: raw.tanggal_mulai,
    dateEnd: raw.tanggal_akhir,
    time: raw.ket_jam,
    kind: raw.jenis_perkuliahan,
    status,
    recordedAt: raw.presensi_date,
    isPast: isPastMeeting(raw.date_status, raw.tanggal_akhir, raw.presensi_date, status),
  };
}

export function normalizeMeetings(input: unknown): Meeting[] {
  const meetings: Meeting[] = [];
  for (const item of pickArray(input)) {
    const parsed = meetingSchema.safeParse(item);
    if (parsed.success) meetings.push(toMeeting(parsed.data));
  }
  return meetings;
}

export function normalizeSemester(input: unknown): PortalSemester | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  const id = String(record.id_semester_registrasi ?? '').trim();
  const name = String(record.nama_semester_registrasi ?? '').trim();
  return id || name ? { id, name } : null;
}

export function normalizeResult(raw: RawPresensiResult): NormalizedResult {
  const courses: PortalCourse[] = [];

  for (const item of pickArray(raw.list)) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const idKelas = String(record.id_kelas ?? '').trim();
    const idMataKuliah = String(record.id_mata_kuliah ?? '').trim();
    if (!idKelas || !idMataKuliah) continue;

    courses.push({
      idKelas,
      idMataKuliah,
      name: String(record.nama_mata_kuliah ?? 'Tanpa nama').trim() || 'Tanpa nama',
      sks: Number(record.sks) || 0,
    });
  }

  const details: Record<string, Meeting[]> = {};
  const failed: string[] = [];

  for (const course of courses) {
    const key = `${course.idKelas}/${course.idMataKuliah}`;
    const entry = raw.details?.[key];

    if (entry && typeof entry === 'object' && 'status' in entry && 'data' in entry) {
      const detail = entry as PageDetail;
      if (detail.status !== 200) {
        details[key] = [];
        failed.push(course.name);
        continue;
      }
      details[key] = normalizeMeetings(detail.data);
      continue;
    }

    details[key] = normalizeMeetings(entry);
  }

  return { semester: raw.semester, courses, details, failed };
}

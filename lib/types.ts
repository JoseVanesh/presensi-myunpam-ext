export interface PortalSemester {
  id: string;
  name: string;
}

export interface PortalCourse {
  idKelas: string;
  idMataKuliah: string;
  name: string;
  sks: number;
}

export type AttendanceStatus = 'hadir' | 'alpha' | 'sakit' | 'izin' | 'lain';

export interface Meeting {
  dateStart: string | null;
  dateEnd: string | null;
  time: string | null;
  kind: string | null;
  status: AttendanceStatus | null;
  recordedAt: string | null;
  isPast: boolean;
}

export interface CourseAttendance extends PortalCourse {
  total: number;
  hadir: number;
  alpha: number;
  sakit: number;
  izin: number;
  lain: number;
  unrecorded: number;
  percent: number | null;
  belowMin: boolean;
}

export interface PresensiCache {
  version: 1;
  updatedAt: number;
  semester: PortalSemester | null;
  courses: CourseAttendance[];
  failed: string[];
}

export interface PageDetail {
  status: number;
  data: unknown;
}

export interface RawPresensiResult {
  semester: PortalSemester | null;
  list: unknown;
  details: Record<string, PageDetail>;
}

export interface SyncSuccess {
  ok: true;
  cache: PresensiCache;
}

export interface SyncFailure {
  ok: false;
  error: string;
}

export type SyncResponse = SyncSuccess | SyncFailure;

import type { CourseAttendance, Meeting, PortalCourse, PortalSemester, PresensiCache } from './types';

export const MIN_ATTENDANCE = 70;

export function computeCourse(course: PortalCourse, meetings: Meeting[]): CourseAttendance {
  const counts = { hadir: 0, alpha: 0, sakit: 0, izin: 0, lain: 0, unrecorded: 0 };

  for (const meeting of meetings) {
    if (meeting.status === null) {
      if (meeting.isPast) counts.unrecorded += 1;
    } else {
      counts[meeting.status] += 1;
    }
  }

  const total = meetings.length;
  const percent = total === 0 ? null : Math.round((counts.hadir / total) * 1000) / 10;

  return {
    ...course,
    total,
    ...counts,
    percent,
    belowMin: percent !== null && percent < MIN_ATTENDANCE,
  };
}

export function buildCache(
  semester: PortalSemester | null,
  courses: PortalCourse[],
  details: Record<string, Meeting[]>,
  failed: string[],
  updatedAt = Date.now(),
): PresensiCache {
  const rows = courses.map((course) =>
    computeCourse(course, details[`${course.idKelas}/${course.idMataKuliah}`] ?? []),
  );

  rows.sort((a, b) => {
    if (a.percent === null && b.percent === null) return a.name.localeCompare(b.name);
    if (a.percent === null) return 1;
    if (b.percent === null) return -1;
    return a.percent - b.percent || a.name.localeCompare(b.name);
  });

  return { version: 1, updatedAt, semester, courses: rows, failed };
}

export function formatPercent(percent: number | null): string {
  if (percent === null) return '—';
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
}

export function countBelow(courses: CourseAttendance[]): number {
  return courses.filter((course) => course.belowMin).length;
}

export function countUnrecorded(courses: CourseAttendance[]): number {
  return courses.reduce((total, course) => total + course.unrecorded, 0);
}

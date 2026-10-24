import { MIN_ATTENDANCE, formatPercent } from './attendance';
import type { CourseAttendance } from './types';

export function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-3.2-6.9" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'danger' | 'warning';
}) {
  const color =
    tone === 'danger' ? 'text-red-600' : tone === 'warning' ? 'text-amber-600' : 'text-slate-700';

  return (
    <div className="flex flex-1 flex-col items-center rounded-lg bg-white px-2 py-2 ring-1 ring-slate-200">
      <span className={`text-base font-bold leading-tight tabular-nums ${color}`}>{value}</span>
      <span className="mt-0.5 text-center text-[10px] leading-tight text-slate-500">{label}</span>
    </div>
  );
}

export function Badge({
  label,
  tone,
}: {
  label: string;
  tone: 'green' | 'red' | 'amber' | 'blue' | 'slate';
}) {
  const classes = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    blue: 'bg-sky-50 text-sky-700 ring-sky-200',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  }[tone];

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${classes}`}>
      {label}
    </span>
  );
}

export function CourseCard({ course }: { course: CourseAttendance }) {
  const isNeutral = course.percent === null;
  const tone = isNeutral ? 'neutral' : course.belowMin ? 'danger' : 'safe';

  const cardClass = {
    danger: 'border-red-200 bg-red-50/60',
    safe: 'border-slate-200 bg-white',
    neutral: 'border-slate-200 bg-white',
  }[tone];

  const percentClass = {
    danger: 'text-red-600',
    safe: 'text-emerald-600',
    neutral: 'text-slate-400',
  }[tone];

  const barClass = {
    danger: 'bg-red-500',
    safe: 'bg-emerald-500',
    neutral: 'bg-slate-300',
  }[tone];

  const width = Math.min(100, Math.max(0, course.percent ?? 0));

  return (
    <article className={`rounded-xl border p-3 shadow-sm ${cardClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug text-slate-800" title={course.name}>
            {course.name}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {course.sks} SKS · {course.hadir}/{course.total} pertemuan
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-xl font-bold leading-none tabular-nums ${percentClass}`}>
            {formatPercent(course.percent)}
          </span>
          {!isNeutral && course.belowMin ? (
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-red-500">
              di bawah {MIN_ATTENDANCE}%
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative mt-2.5 h-2 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full transition-all ${barClass}`} style={{ width: `${width}%` }} />
        {!isNeutral ? (
          <span
            className="absolute -top-0.5 h-3 w-px bg-slate-400/80"
            style={{ left: `${MIN_ATTENDANCE}%` }}
            title={`Ambang ${MIN_ATTENDANCE}%`}
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge label={`H ${course.hadir}`} tone="green" />
        <Badge label={`A ${course.alpha}`} tone="red" />
        <Badge label={`S ${course.sakit}`} tone="amber" />
        <Badge label={`I ${course.izin}`} tone="blue" />
        {course.unrecorded > 0 ? <Badge label={`Belum ${course.unrecorded}`} tone="slate" /> : null}
      </div>
    </article>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-4/5 rounded bg-slate-200" />
          <div className="h-2.5 w-2/5 rounded bg-slate-100" />
        </div>
        <div className="h-6 w-12 rounded bg-slate-200" />
      </div>
      <div className="mt-3 h-2 w-full rounded bg-slate-100" />
      <div className="mt-2 flex gap-1">
        <div className="h-4 w-10 rounded bg-slate-100" />
        <div className="h-4 w-10 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export function formatUpdatedAt(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Diperbarui ${time}`;
  return `Diperbarui ${date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ${time}`;
}

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes('Receiving end does not exist') ||
    message.includes('Could not establish connection')
  ) {
    return 'Muat ulang tab portal (F5), lalu klik Muat data lagi.';
  }
  if (message.includes('No tab with id')) {
    return 'Tab portal sudah ditutup. Buka my.unpam.ac.id lagi.';
  }
  return message;
}

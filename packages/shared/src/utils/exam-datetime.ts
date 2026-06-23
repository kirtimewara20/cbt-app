export const DEFAULT_EXAM_TIMEZONE = 'Asia/Kolkata';

const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export function isUtcIsoOrOffset(value: string): boolean {
  return /[zZ]$|[+-]\d{2}:\d{2}$/.test(value.trim());
}

/** Wall-clock parts in a timezone for a UTC instant. */
function wallTimeInZone(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcMs));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
  };
}

/**
 * Convert datetime-local value (YYYY-MM-DDTHH:mm) as wall time in `timeZone`
 * to a UTC ISO string for database storage.
 */
export function localDateTimeToUtcIso(localDateTime: string, timeZone: string): string {
  const match = LOCAL_DATETIME_RE.exec(localDateTime.trim());
  if (!match) throw new Error(`Invalid exam datetime: ${localDateTime}`);

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const targetMinutes = hour * 60 + minute;

  let utcMs = Date.UTC(year, month - 1, day, hour, minute);

  for (let attempt = 0; attempt < 6; attempt++) {
    const wall = wallTimeInZone(utcMs, timeZone);
    const wallMinutes = wall.hour * 60 + wall.minute;
    const dayDelta = wall.day - day;
    const monthDelta = wall.month - month;
    const yearDelta = wall.year - year;
    const totalDayShift = yearDelta * 372 + monthDelta * 31 + dayDelta;
    const diffMinutes = totalDayShift * 24 * 60 + (wallMinutes - targetMinutes);

    if (diffMinutes === 0) break;
    utcMs -= diffMinutes * 60 * 1000;
  }

  return new Date(utcMs).toISOString();
}

/** Parse exam start/end from API — respects timezone for bare datetime-local strings. */
export function parseExamDateTime(value: string, timeZone = DEFAULT_EXAM_TIMEZONE): Date {
  const trimmed = value.trim();
  if (isUtcIsoOrOffset(trimmed)) return new Date(trimmed);
  return new Date(localDateTimeToUtcIso(trimmed, timeZone));
}

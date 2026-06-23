/**
 * Format a "date-only" value (Date from Prisma or YYYY-MM-DD string) for display.
 *
 * Date-only fields are stored as UTC midnight (e.g. 2024-06-24T00:00:00Z).
 * Calling new Date(utcDate).toLocaleDateString() in a UTC-5 browser shifts the
 * display one day back (shows Jun 23). This function extracts the YYYY-MM-DD
 * portion and constructs a LOCAL-midnight Date, so the calendar date is always
 * preserved regardless of the viewer's timezone offset.
 */
export function formatDateOnly(
  d: Date | string,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  const str = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  const [y, m, day] = str.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, opts);
}

/**
 * Get today's date as YYYY-MM-DD in the given IANA timezone.
 * Use this server-side instead of new Date() which gives the server's UTC time.
 *
 * en-CA locale reliably produces YYYY-MM-DD output across all environments.
 */
export function todayInTz(tz: string): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: tz });
  } catch {
    return new Date().toLocaleDateString("en-CA");
  }
}

/**
 * Get the day of the week (0=Sun … 6=Sat) in the given IANA timezone.
 * Use this server-side instead of new Date().getDay() which uses the server tz.
 */
export function dayOfWeekInTz(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    }).formatToParts(new Date());
    const day = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day);
  } catch {
    return new Date().getDay();
  }
}

/**
 * Format a full UTC DateTime in a given IANA timezone for display.
 * Use for timestamps that have meaningful time-of-day (e.g. session startedAt).
 */
export function formatDateTimeInTz(
  d: Date,
  tz: string,
  opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
): string {
  try {
    return d.toLocaleString(undefined, { timeZone: tz, ...opts });
  } catch {
    return d.toLocaleString(undefined, opts);
  }
}

import { format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^\d{2}:\d{2}$/;

export function todayInZone(timeZone: string): string {
  return formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
}

export function startOfWeekInZone(
  timeZone: string,
  weekStart: "monday" | "sunday",
): string {
  return startOfWeekForDate(todayInZone(timeZone), weekStart);
}

export function startOfWeekForDate(
  dateValue: string,
  weekStart: "monday" | "sunday",
): string {
  const date = new Date(`${dateValue}T12:00:00`);
  const day = date.getDay();
  const offset = weekStart === "monday" ? (day + 6) % 7 : day;
  date.setDate(date.getDate() - offset);
  return format(date, "yyyy-MM-dd");
}

export function buildStarted(date: string, time: string, timeZone: string): string {
  if (!DATE_ONLY.test(date) || !TIME_ONLY.test(time)) {
    throw new Error("Invalid date or time");
  }

  const utc = fromZonedTime(`${date}T${time}:00`, timeZone);
  const wallClock = formatInTimeZone(utc, timeZone, "yyyy-MM-dd HH:mm");
  if (wallClock !== `${date} ${time}`) {
    throw new Error("That start time does not exist in the Jira timezone.");
  }
  return formatInTimeZone(utc, timeZone, "yyyy-MM-dd'T'HH:mm:ss.SSSxxxx");
}

export function buildSafeStarted(
  date: string,
  preferredTime: string,
  timeZone: string,
): string {
  const started = buildStarted(date, preferredTime, timeZone);
  if (
    date === todayInZone(timeZone) &&
    new Date(started).getTime() > Date.now() + 5 * 60_000
  ) {
    const now = formatInTimeZone(new Date(), timeZone, "HH:mm");
    return buildStarted(date, now, timeZone);
  }
  return started;
}

export function rangeBounds(
  from: string,
  to: string,
  timeZone: string,
): { fromMs: number; toMs: number } {
  if (!DATE_ONLY.test(from) || !DATE_ONLY.test(to)) {
    throw new Error("Invalid date range");
  }

  return {
    fromMs: fromZonedTime(`${from}T00:00:00`, timeZone).getTime(),
    toMs: fromZonedTime(`${to}T23:59:59.999`, timeZone).getTime(),
  };
}

export function isFutureDate(date: string, timeZone: string): boolean {
  return date > todayInZone(timeZone);
}

export function formatWorklogDate(started: string, timeZone: string): string {
  return formatInTimeZone(new Date(started), timeZone, "MMM d");
}

export function formatWorklogTime(started: string, timeZone: string): string {
  return formatInTimeZone(new Date(started), timeZone, "HH:mm");
}

export function formatWeekday(date: string): string {
  return format(new Date(`${date}T12:00:00`), "EEE");
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return format(value, "yyyy-MM-dd");
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

export function isWeekend(date: string): boolean {
  const day = dayOfWeek(date);
  return day === 0 || day === 6;
}

export function formatDayLabel(date: string): string {
  return format(new Date(`${date}T12:00:00`), "EEE d");
}

export function formatDayLong(date: string): string {
  return format(new Date(`${date}T12:00:00`), "EEE, MMM d");
}

export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${weekEnd}T12:00:00`);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${format(start, "MMM d")} – ${format(end, "d")}`;
  }
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

export function worklogDay(started: string, timeZone: string): string {
  return formatInTimeZone(new Date(started), timeZone, "yyyy-MM-dd");
}

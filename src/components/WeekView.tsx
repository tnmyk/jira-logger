import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Menu,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import type { RefObject } from "react";
import type {
  Connection,
  Preferences,
  WorklogEntry,
  WorklogSummary,
} from "@/lib/types";
import { formatDuration } from "@/lib/duration";
import {
  formatDayLabel,
  formatWeekRange,
  formatWorklogTime,
  isWeekend,
  weekDates,
  worklogDay,
} from "@/lib/datetime";
import { Button, IconButton, SectionLabel, Skeleton } from "./ui";

type WeekViewProps = {
  connection: Connection;
  preferences: Preferences;
  weekStart: string;
  weekEnd: string;
  currentWeekStart: string;
  today: string;
  summary?: WorklogSummary;
  loading: boolean;
  error?: string | null;
  daysOff: string[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  onBackfill: (date: string) => void;
  onToggleDayOff: (date: string) => void;
  onCopyPreviousWeek: () => void;
  onDeleteEntry: (entry: WorklogEntry) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenNav: () => void;
  navOpen: boolean;
  navButtonRef?: RefObject<HTMLButtonElement | null>;
  onRetry: () => void;
};

export default function WeekView({
  connection,
  preferences,
  weekStart,
  weekEnd,
  currentWeekStart,
  today,
  summary,
  loading,
  error,
  daysOff,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  onBackfill,
  onToggleDayOff,
  onCopyPreviousWeek,
  onDeleteEntry,
  onOpenSearch,
  onOpenSettings,
  onOpenNav,
  navOpen,
  navButtonRef,
  onRetry,
}: WeekViewProps) {
  const targetPerDay = preferences.targetMinutesPerDay * 60;
  const workingDays = weekDates(weekStart).filter((date) => !isWeekend(date));
  const targetTotal =
    workingDays.filter((date) => !daysOff.includes(date)).length * targetPerDay;
  const weekTotal = summary?.totalSeconds ?? 0;
  const workingWeekSeconds = workingDays.reduce(
    (total, date) => total + (summary?.byDay[date] ?? 0),
    0,
  );
  const weekendSeconds = Math.max(0, weekTotal - workingWeekSeconds);
  const isCurrentWeek = weekStart === currentWeekStart;
  const canGoNext = weekStart < currentWeekStart;
  const pastWorkingDays = workingDays.filter(
    (date) => date < today && !daysOff.includes(date),
  );
  const missingDays =
    targetPerDay > 0
      ? pastWorkingDays.filter((date) => (summary?.byDay[date] ?? 0) === 0)
          .length
      : 0;
  const shortSeconds =
    targetPerDay > 0
      ? pastWorkingDays.reduce(
          (total, date) =>
            total + Math.max(0, targetPerDay - (summary?.byDay[date] ?? 0)),
          0,
        )
      : 0;
  const todayTotal = summary?.byDay[today] ?? 0;
  const todayRemaining =
    isCurrentWeek &&
    targetPerDay > 0 &&
    !daysOff.includes(today) &&
    !isWeekend(today)
      ? Math.max(0, targetPerDay - todayTotal)
      : 0;

  const entriesByDay = new Map<string, WorklogEntry[]>();
  for (const entry of summary?.entries ?? []) {
    const day = worklogDay(entry.started, connection.timeZone);
    const entries = entriesByDay.get(day) ?? [];
    entries.push(entry);
    entriesByDay.set(day, entries);
  }

  const days = weekDates(weekStart).filter((date) => {
    if (date === today) return true;
    if (preferences.showWeekends || !isWeekend(date)) return true;
    return (summary?.byDay[date] ?? 0) > 0;
  });

  return (
    <section
      aria-label="Week"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
        <IconButton
          ref={navButtonRef}
          label="Open navigation"
          aria-expanded={navOpen}
          onClick={onOpenNav}
        >
          <Menu size={15} />
        </IconButton>
        <span className="text-[12px] font-medium text-text">Week</span>
        <div className="flex-1" />
        <IconButton label="Settings" onClick={onOpenSettings}>
          <Settings2 size={15} />
        </IconButton>
      </div>

      <div className="border-b border-border px-4 pb-4 pt-5 md:px-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionLabel>Week</SectionLabel>
            <h1
              id="week-heading"
              tabIndex={-1}
              className="mt-0.5 text-[15px] font-medium tracking-[-0.01em] text-text"
            >
              {formatWeekRange(weekStart, weekEnd)}
            </h1>
            {!isCurrentWeek ? (
              <button
                type="button"
                onClick={onThisWeek}
                className="mt-1 text-[10.5px] text-text-muted underline-offset-2 hover:text-text hover:underline"
              >
                Back to this week
              </button>
            ) : null}
            {!loading &&
            !error &&
            (missingDays > 0 || shortSeconds > 0 || todayRemaining > 0) ? (
              <p className="mt-1 text-[10px] text-warning">
                {missingDays > 0
                  ? `${missingDays} ${missingDays === 1 ? "day" : "days"} missing`
                  : null}
                {missingDays > 0 && shortSeconds > 0 ? " · " : null}
                {shortSeconds > 0 ? `${formatDuration(shortSeconds)} short` : null}
                {todayRemaining > 0 ? (
                  <>
                    {missingDays > 0 || shortSeconds > 0 ? " · " : null}
                    <span className="text-text-faint">
                      {formatDuration(todayRemaining)} left today
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="mono text-[21px] font-medium tracking-[-0.03em] text-text">
                {loading || error ? "—" : formatDuration(workingWeekSeconds)}
                {targetTotal > 0 && !loading && !error ? (
                  <span className="ml-1 text-[10px] font-normal text-text-faint">
                    / {formatDuration(targetTotal)}
                  </span>
                ) : null}
              </p>
              <p className="text-[10px] text-text-faint">
                {loading
                  ? "Loading"
                  : error
                    ? "Unavailable"
                    : weekendSeconds > 0
                      ? `+ ${formatDuration(weekendSeconds)} weekend`
                      : "Logged"}
              </p>
            </div>
            <div className="ml-1 flex items-center">
              <IconButton label="Previous week" onClick={onPrevWeek}>
                <ChevronLeft size={15} />
              </IconButton>
              <IconButton
                label="Next week"
                onClick={onNextWeek}
                disabled={!canGoNext}
              >
                <ChevronRight size={15} />
              </IconButton>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={onOpenSearch}>
            <Search size={13} />
            Search tickets
          </Button>
          <Button
            variant="subtle"
            size="sm"
            onClick={onCopyPreviousWeek}
            disabled={loading || Boolean(error)}
          >
            <Copy size={13} />
            Copy previous week
          </Button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-danger/20 bg-danger/5 px-4 py-2 md:px-5">
          <p role="alert" className="text-[11px] leading-5 text-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-0.5 text-[10.5px] text-text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="px-4 py-4 md:px-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="border-b border-border py-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2 h-2.5 w-52" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-4 py-8 md:px-5">
          <p className="text-[12px] text-text-muted">
            This week’s totals are unavailable.
          </p>
          <Button
            variant="subtle"
            size="sm"
            className="mt-3"
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      ) : (
        days.map((date) => {
          const dayEntries = entriesByDay.get(date) ?? [];
          const dayTotal = summary?.byDay[date] ?? 0;
          const isToday = date === today;
          const isPast = date < today;
          const isOff = daysOff.includes(date);
          const isWorkingDay = !isWeekend(date);
          const underTarget =
            isWorkingDay &&
            !isOff &&
            isPast &&
            targetPerDay > 0 &&
            dayTotal < targetPerDay;
          const missing =
            isWorkingDay && !isOff && isPast && dayTotal === 0;

          return (
            <div
              key={date}
              data-day={date}
              className="border-b border-border px-4 py-3 md:px-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="mono text-[10px] text-text-faint">
                    {formatDayLabel(date)}
                  </span>
                  {isToday ? (
                    <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-accent">
                      Today
                    </span>
                  ) : null}
                  {isOff ? (
                    <span className="text-[9.5px] uppercase tracking-[0.08em] text-warning">
                      Day off
                    </span>
                  ) : null}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="mono text-[12px] text-text">
                    {formatDuration(dayTotal)}
                  </span>
                  {targetPerDay > 0 && isWorkingDay && !isOff ? (
                    <span className="text-[10px] text-text-faint">
                      / {formatDuration(targetPerDay)}
                    </span>
                  ) : null}
                </div>
              </div>

              {dayEntries.length > 0 ? (
                <ul className="mt-1.5">
                  {dayEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="group flex items-start gap-2 border-b border-border/60 py-2 last:border-b-0"
                    >
                      <span className="mono w-[42px] shrink-0 text-[9.5px] text-text-faint">
                        {formatWorklogTime(entry.started, connection.timeZone)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <a
                            href={`${connection.baseUrl}/browse/${entry.issueKey}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${entry.issueKey} in Jira in a new tab`}
                            title="Open in Jira"
                            className="mono inline-flex min-h-9 items-center text-[10.5px] text-text-muted hover:text-text"
                          >
                            {entry.issueKey}
                          </a>
                          <span className="mono text-[10.5px] text-text">
                            {formatDuration(entry.seconds)}
                          </span>
                        </div>
                        {entry.comment ? (
                          <p className="mt-0.5 line-clamp-1 text-[10.5px] text-text-faint">
                            {entry.comment}
                          </p>
                        ) : null}
                      </div>
                      <IconButton
                        label={`Delete ${formatDuration(entry.seconds)} worklog on ${entry.issueKey}`}
                        className="size-9 text-text-faint hover:text-danger"
                        onClick={(event) => {
                        event.currentTarget.focus();
                        onDeleteEntry(entry);
                      }}
                      >
                        <Trash2 size={12} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] leading-5 text-text-faint">
                  {missing ? (
                    <span className="size-1 rounded-full bg-warning" />
                  ) : null}
                  {isOff
                    ? "Marked as day off."
                    : isToday
                      ? "Nothing logged yet."
                      : missing
                        ? "No time logged."
                        : "No entries."}
                </p>
              )}

              <div className="mt-1.5 flex items-center gap-3">
                {isPast && !isOff ? (
                  <button
                    type="button"
                    onClick={() => onBackfill(date)}
                    className="inline-flex min-h-9 items-center px-1 text-[10.5px] text-text-muted underline-offset-2 hover:text-text hover:underline"
                  >
                    Backfill
                  </button>
                ) : null}
                {isWorkingDay ? (
                  <button
                    type="button"
                    onClick={() => onToggleDayOff(date)}
                    className="inline-flex min-h-9 items-center px-1 text-[10.5px] text-text-faint underline-offset-2 hover:text-text hover:underline"
                  >
                    {isOff ? "Undo day off" : "Day off"}
                  </button>
                ) : null}
                {underTarget && !missing ? (
                  <span className="ml-auto text-[10px] text-warning">
                    {formatDuration(targetPerDay - dayTotal)} under target
                  </span>
                ) : isToday && todayRemaining > 0 ? (
                  <span className="ml-auto text-[10px] text-text-faint">
                    {formatDuration(todayRemaining)} remaining
                  </span>
                ) : null}
              </div>
            </div>
          );
        })
      )}

      <div className="h-8" />
    </section>
  );
}

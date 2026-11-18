import {
  CalendarDays,
  ChevronRight,
  ListPlus,
  Menu,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";
import type {
  Connection,
  Favorites,
  Preferences,
  Ticket,
  WorklogEntry,
  WorklogSummary,
} from "@/lib/types";
import { formatDuration } from "@/lib/duration";
import {
  formatDayLong,
  formatWorklogTime,
  isWeekend,
  worklogDay,
} from "@/lib/datetime";
import { Button, IconButton, Monogram, SectionLabel, Skeleton } from "./ui";

type TodayViewProps = {
  connection: Connection;
  preferences: Preferences;
  favorites: Favorites;
  ticketsByKey: Map<string, Ticket>;
  summary?: WorklogSummary;
  loading: boolean;
  error?: string | null;
  today: string;
  daysOff: string[];
  isQuickLogging: boolean;
  onQuickLog: (key: string, seconds: number, comment?: string) => void;
  onOpenTicket: (key: string) => void;
  onOpenWeek: () => void;
  onOpenSearch: () => void;
  onOpenBatch: () => void;
  onOpenAdHoc: () => void;
  onOpenSettings: () => void;
  onOpenFixedSettings: () => void;
  onOpenNav: () => void;
  navOpen: boolean;
  navButtonRef?: RefObject<HTMLButtonElement | null>;
  lastWeekUnderTarget: number;
  lastWeekShortSeconds: number;
  previousWeekError?: string | null;
  onReviewLastWeek: () => void;
  onRetryLastWeek: () => void;
  onDeleteEntry: (entry: WorklogEntry) => void;
  onRetry: () => void;
};

export default function TodayView({
  connection,
  preferences,
  favorites,
  ticketsByKey,
  summary,
  loading,
  error,
  today,
  daysOff,
  isQuickLogging,
  onQuickLog,
  onOpenTicket,
  onOpenWeek,
  onOpenSearch,
  onOpenBatch,
  onOpenAdHoc,
  onOpenSettings,
  onOpenFixedSettings,
  onOpenNav,
  navOpen,
  navButtonRef,
  lastWeekUnderTarget,
  lastWeekShortSeconds,
  previousWeekError,
  onReviewLastWeek,
  onRetryLastWeek,
  onDeleteEntry,
  onRetry,
}: TodayViewProps) {
  const todaySeconds = summary?.byDay[today] ?? 0;
  const isWeekendToday = isWeekend(today);
  const isDayOffToday = daysOff.includes(today);
  const targetSeconds =
    isWeekendToday || isDayOffToday
      ? 0
      : preferences.targetMinutesPerDay * 60;
  const todayEntries =
    summary?.entries
      .filter((entry) => worklogDay(entry.started, connection.timeZone) === today)
      .sort(
        (a, b) =>
          new Date(b.started).getTime() - new Date(a.started).getTime(),
      ) ?? [];
  const todayByIssue = new Map<string, number>();
  for (const entry of todayEntries) {
    todayByIssue.set(
      entry.issueKey,
      (todayByIssue.get(entry.issueKey) ?? 0) + entry.seconds,
    );
  }

  const excluded = new Set([
    ...favorites.pins,
    ...favorites.fixed.map((ticket) => ticket.key),
  ]);
  const recent = new Map<string, { key: string; summary?: string }>();
  for (const entry of summary?.entries ?? []) {
    if (excluded.has(entry.issueKey) || recent.has(entry.issueKey)) continue;
    recent.set(entry.issueKey, {
      key: entry.issueKey,
      summary: entry.issueSummary,
    });
    if (recent.size >= 3) break;
  }

  const hasAnything =
    favorites.fixed.length > 0 || favorites.pins.length > 0 || recent.size > 0;

  function quickLog(key: string, seconds: number, comment?: string) {
    onQuickLog(
      key,
      seconds,
      comment ?? preferences.defaultComment ?? undefined,
    );
  }

  return (
    <section
      aria-label="Today"
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
        <span className="text-[12px] font-medium text-text">Today</span>
        <div className="flex-1" />
        <IconButton label="Settings" onClick={onOpenSettings}>
          <Settings2 size={15} />
        </IconButton>
      </div>

      <div className="border-b border-border px-4 pb-4 pt-5 md:px-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionLabel>Today</SectionLabel>
            <h1
              id="today-heading"
              tabIndex={-1}
              className="mt-0.5 text-[15px] font-medium tracking-[-0.01em] text-text"
            >
              {formatDayLong(today)}
            </h1>
          </div>
          <div className="text-right">
            <p className="mono text-[21px] font-medium tracking-[-0.03em] text-text">
              {loading || error ? "—" : formatDuration(todaySeconds)}
              {targetSeconds > 0 && !loading && !error ? (
                <span className="ml-1 text-[10px] font-normal text-text-faint">
                  / {formatDuration(targetSeconds)}
                </span>
              ) : null}
            </p>
            {loading ? (
              <p className="text-[10px] text-text-faint">Loading</p>
            ) : error ? (
              <p className="text-[10px] text-warning">Totals unavailable</p>
            ) : isDayOffToday ? (
              <p className="text-[10px] text-text-faint">Day off</p>
            ) : isWeekendToday ? (
              <p className="text-[10px] text-text-faint">Weekend</p>
            ) : targetSeconds === 0 ? (
              <p className="text-[10px] text-text-faint">No target</p>
            ) : todaySeconds < targetSeconds ? (
              <p className="text-[10px] text-warning">
                {formatDuration(targetSeconds - todaySeconds)} under target
              </p>
            ) : (
              <p className="text-[10px] text-text-faint">On target</p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button variant="subtle" size="sm" onClick={onOpenWeek}>
            <CalendarDays size={13} />
            This week
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenSearch}>
            <Search size={13} />
            Search tickets
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenAdHoc}>
            <Plus size={13} />
            Log ticket
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenBatch}
            disabled={loading}
          >
            <ListPlus size={13} />
            Fill day
          </Button>
          {favorites.fixed.length === 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenFixedSettings}
              className="col-span-2 sm:col-span-1"
            >
              <Settings2 size={13} />
              Add fixed tickets
            </Button>
          ) : null}
        </div>

        {lastWeekUnderTarget > 0 ? (
          <button
            type="button"
            onClick={onReviewLastWeek}
            className="mt-3 flex w-full items-center justify-between border-l-2 border-warning/60 py-1 pl-2.5 text-left transition-colors hover:bg-bg-hover"
          >
            <span>
              <span className="block text-[11px] text-warning">
                Last week: {lastWeekUnderTarget}{" "}
                {lastWeekUnderTarget === 1 ? "day" : "days"} under target
              </span>
              <span className="mt-0.5 block text-[10px] text-text-faint">
                {formatDuration(lastWeekShortSeconds)} missing · Review
              </span>
            </span>
            <ChevronRight size={14} className="mr-1 text-text-faint" />
          </button>
        ) : previousWeekError ? (
          <div className="mt-3 flex items-center justify-between border-l-2 border-danger/50 py-1 pl-2.5">
            <span className="text-[10.5px] text-danger">
              Could not check last week.
            </span>
            <button
              type="button"
              onClick={onRetryLastWeek}
              className="text-[10.5px] text-text-muted underline-offset-2 hover:text-text hover:underline"
            >
              Retry
            </button>
          </div>
        ) : null}
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
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-2 h-10 w-5/6" />
          <Skeleton className="mt-2 h-10 w-4/6" />
        </div>
      ) : (
        <>
          {favorites.fixed.length > 0 ? (
            <QuickSection
              label="Fixed"
              action={
                <button
                  type="button"
                  onClick={onOpenFixedSettings}
                  className="inline-flex min-h-9 items-center px-1 text-[10.5px] text-text-faint underline-offset-2 hover:text-text hover:underline"
                >
                  Manage
                </button>
              }
            >
              {favorites.fixed.map((fixed) => {
                const loggedSeconds = todayByIssue.get(fixed.key) ?? 0;
                return (
                  <QuickRow
                    key={fixed.key}
                    ticketKey={fixed.key}
                    ticket={ticketsByKey.get(fixed.key)}
                    comment={fixed.comment}
                    status={
                      loggedSeconds > 0
                        ? `Today ${formatDuration(loggedSeconds)}`
                        : undefined
                    }
                    onOpen={() => onOpenTicket(fixed.key)}
                    quick={
                      loggedSeconds > 0
                        ? []
                        : [
                            {
                              seconds: fixed.minutes * 60,
                              label: formatDuration(fixed.minutes * 60),
                              primary: true,
                              comment: fixed.comment,
                            },
                          ]
                    }
                    disabled={isQuickLogging}
                    onQuickLog={quickLog}
                  />
                );
              })}
            </QuickSection>
          ) : null}

          {favorites.pins.length > 0 ? (
            <QuickSection label="Pinned">
              {favorites.pins.map((key) => (
                <QuickRow
                  key={key}
                  ticketKey={key}
                  ticket={ticketsByKey.get(key)}
                  status={
                    (todayByIssue.get(key) ?? 0) > 0
                      ? `Today ${formatDuration(todayByIssue.get(key) ?? 0)}`
                      : undefined
                  }
                  onOpen={() => onOpenTicket(key)}
                  quick={preferences.quickDurations.slice(0, 3).map((minutes) => ({
                    seconds: minutes * 60,
                    label: formatDuration(minutes * 60),
                  }))}
                  disabled={isQuickLogging}
                  onQuickLog={quickLog}
                />
              ))}
            </QuickSection>
          ) : null}

          {recent.size > 0 ? (
            <QuickSection label="Recent">
              {Array.from(recent.values()).map((item) => (
                <QuickRow
                  key={item.key}
                  ticketKey={item.key}
                  ticket={ticketsByKey.get(item.key)}
                  fallbackSummary={item.summary}
                  status={
                    (todayByIssue.get(item.key) ?? 0) > 0
                      ? `Today ${formatDuration(todayByIssue.get(item.key) ?? 0)}`
                      : undefined
                  }
                  onOpen={() => onOpenTicket(item.key)}
                  quick={preferences.quickDurations.slice(0, 2).map((minutes) => ({
                    seconds: minutes * 60,
                    label: formatDuration(minutes * 60),
                  }))}
                  disabled={isQuickLogging}
                  onQuickLog={quickLog}
                />
              ))}
            </QuickSection>
          ) : null}

          {!hasAnything ? (
            <div className="px-4 py-6 md:px-5">
              <p className="text-[12px] text-text-muted">
                Pin tickets you open often, or add fixed tickets for recurring
                admin work in Settings.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="subtle" onClick={onOpenSettings}>
                  Open settings
                </Button>
                <Button size="sm" variant="ghost" onClick={onOpenSearch}>
                  Search tickets
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-2 border-t border-border px-4 py-4 md:px-5">
            <div className="flex items-center justify-between">
              <SectionLabel>Logged today</SectionLabel>
            </div>

            {error ? (
              <p className="mt-2 text-[11px] leading-5 text-warning">
                Worklogs unavailable.
              </p>
            ) : todayEntries.length === 0 ? (
              <p className="mt-2 text-[11px] leading-5 text-text-faint">
                Nothing logged today yet.
              </p>
            ) : (
              <ul className="mt-1">
                {todayEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="group flex items-start gap-2 border-b border-border/70 py-2.5 last:border-b-0"
                  >
                    <div className="w-[42px] shrink-0">
                      <p className="mono text-[10px] text-text-faint">
                        {formatWorklogTime(entry.started, connection.timeZone)}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenTicket(entry.issueKey)}
                          className="mono text-[10.5px] text-text-muted hover:text-text"
                        >
                          {entry.issueKey}
                        </button>
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
            )}
          </div>
        </>
      )}
    </section>
  );
}

function QuickSection({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border px-4 py-3 md:px-5">
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        {action}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function QuickRow({
  ticketKey,
  ticket,
  fallbackSummary,
  comment,
  status,
  quick,
  disabled,
  onOpen,
  onQuickLog,
}: {
  ticketKey: string;
  ticket?: Ticket;
  fallbackSummary?: string;
  comment?: string;
  status?: string;
  quick: Array<{
    seconds: number;
    label: string;
    primary?: boolean;
    comment?: string;
  }>;
  disabled: boolean;
  onOpen: () => void;
  onQuickLog: (key: string, seconds: number, comment?: string) => void;
}) {
  return (
    <div
      data-ticket-key={ticketKey}
      className="flex min-h-12 items-center gap-2 border-b border-border/60 py-2 last:border-b-0"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${ticketKey}: ${ticket?.summary ?? fallbackSummary ?? "ticket"}`}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="mono text-[9.5px] text-text-faint">{ticketKey}</p>
          <p className="truncate text-[12px] text-text-muted hover:text-text">
            {ticket?.summary ?? fallbackSummary ?? "Ticket"}
          </p>
          {comment ? (
            <p className="truncate text-[10px] text-text-faint">{comment}</p>
          ) : null}
        </div>
        {ticket?.assignee ? (
          <Monogram name={ticket.assignee.name} className="mr-1" />
        ) : null}
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {status ? (
          <span className="mr-1 text-[9.5px] text-text-faint">{status}</span>
        ) : null}
        {quick.map((item) => (
          <button
            key={`${item.seconds}-${item.label}`}
            type="button"
            aria-label={`Log ${item.label} on ${ticketKey}`}
            disabled={disabled}
            onClick={() =>
              onQuickLog(ticketKey, item.seconds, item.comment ?? comment)
            }
            className={
              item.primary
                ? "min-h-10 min-w-11 rounded-md border border-accent/35 bg-accent-soft px-2.5 py-1 text-[10.5px] font-medium text-accent transition-colors hover:bg-accent/15 disabled:opacity-40"
                : "min-h-10 min-w-11 rounded-md border border-border px-2.5 py-1 text-[10.5px] text-text-muted transition-colors hover:border-border-strong hover:bg-bg-hover hover:text-text disabled:opacity-40"
            }
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

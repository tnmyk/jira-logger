import { formatInTimeZone } from "date-fns-tz";
import {
  CalendarDays,
  Clock3,
  Search,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  AppView,
  Connection,
  Favorites,
  Preferences,
  Ticket,
  WorklogSummary,
} from "@/lib/types";
import { formatDuration } from "@/lib/duration";
import { worklogDay } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { IconButton, Monogram, SectionLabel, Skeleton } from "./ui";

const ALL_OPEN_JQL = "statusCategory != Done ORDER BY updated DESC";

type SidebarProps = {
  connection: Connection;
  preferences: Preferences;
  favorites: Favorites;
  ticketsByKey: Map<string, Ticket>;
  summary?: WorklogSummary;
  summaryLoading: boolean;
  summaryError?: string | null;
  today: string;
  activeJql: string;
  view: AppView;
  lastWeekUnderTarget: number;
  onSelect: (key: string) => void;
  onQuickLog: (key: string, seconds: number, comment?: string) => void;
  onUnpin: (key: string) => void;
  onView: (jql: string) => void;
  onChangeView: (view: AppView) => void;
  onReviewLastWeek: () => void;
  onOpenSettings: () => void;
  onOpenFixedSettings: () => void;
  onRetrySummary: () => void;
  mobile?: boolean;
  onCloseMobile?: () => void;
};

export default function Sidebar({
  connection,
  preferences,
  favorites,
  ticketsByKey,
  summary,
  summaryLoading,
  summaryError,
  today,
  activeJql,
  view,
  lastWeekUnderTarget,
  onSelect,
  onQuickLog,
  onUnpin,
  onView,
  onChangeView,
  onReviewLastWeek,
  onOpenSettings,
  onOpenFixedSettings,
  onRetrySummary,
  mobile,
  onCloseMobile,
}: SidebarProps) {
  const todayTotal = summary?.byDay[today] ?? 0;
  const weekTotal = summary?.totalSeconds ?? 0;
  const dateLabel = formatInTimeZone(
    new Date(),
    connection.timeZone,
    "EEE, MMM d",
  );
  const host = safeHost(connection.baseUrl);
  const todayByIssue = new Map<string, number>();
  for (const entry of summary?.entries ?? []) {
    if (worklogDay(entry.started, connection.timeZone) !== today) continue;
    todayByIssue.set(
      entry.issueKey,
      (todayByIssue.get(entry.issueKey) ?? 0) + entry.seconds,
    );
  }

  return (
    <aside
      className={cn(
        "w-[232px] shrink-0 flex-col border-r border-border bg-bg-raised",
        mobile ? "flex h-full w-full" : "hidden md:flex",
      )}
    >
      <div className="flex h-12 items-center gap-2 px-4">
        <span className="size-1.5 rounded-sm bg-accent" />
        <span className="text-[12.5px] font-medium tracking-[-0.01em] text-text">
          Jira Logger
        </span>
        {onCloseMobile ? (
          <IconButton
            label="Close navigation"
            className="ml-auto md:hidden"
            onClick={onCloseMobile}
          >
            <X size={14} />
          </IconButton>
        ) : null}
      </div>

      <nav className="px-2 pb-2" aria-label="Views">
        <ModeButton
          active={view === "today"}
          onClick={() => onChangeView("today")}
          icon={<Sun size={13} />}
        >
          Today
        </ModeButton>
        <ModeButton
          active={view === "week"}
          onClick={() => onChangeView("week")}
          icon={<CalendarDays size={13} />}
        >
          Week
        </ModeButton>
        <ModeButton
          active={view === "search"}
          onClick={() => onChangeView("search")}
          icon={<Search size={13} />}
        >
          Search
        </ModeButton>
      </nav>

      {view !== "today" ? (
      <div className="border-t border-border px-4 py-4">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Today</SectionLabel>
          <span className="text-[10px] text-text-faint">{dateLabel}</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          {summaryLoading ? (
            <Skeleton className="h-6 w-[74px]" />
          ) : (
            <span className="mono text-[21px] font-medium tracking-[-0.03em] text-text">
              {summaryError ? "—" : formatDuration(todayTotal)}
            </span>
          )}
          {summaryLoading ? (
            <Skeleton className="h-2.5 w-[92px]" />
          ) : summaryError ? (
            <button
              type="button"
              onClick={onRetrySummary}
              className="text-[10.5px] text-warning underline-offset-2 hover:underline"
            >
              Totals unavailable · retry
            </button>
          ) : (
            <span className="text-[10.5px] text-text-faint">
              {formatDuration(weekTotal)} total this week
            </span>
          )}
        </div>
        {lastWeekUnderTarget > 0 &&
        !summaryLoading &&
        !summaryError ? (
          <button
            type="button"
            onClick={onReviewLastWeek}
            className="mt-1 flex items-center gap-1.5 text-left text-[10px] text-text-muted transition-colors hover:text-text"
          >
            <span className="size-1 rounded-full bg-warning" />
            Last week: {lastWeekUnderTarget}{" "}
            {lastWeekUnderTarget === 1 ? "day" : "days"} under target
          </button>
        ) : null}
      </div>
      ) : null}

      <div className="flex-1 overflow-y-auto pb-4">
        {view !== "today" ? (
          <>
        <SidebarSection
          label="Pinned"
          count={favorites.pins.length}
          empty={
            <button
              type="button"
              onClick={() => onView(preferences.defaultJql)}
              className="text-left underline-offset-2 hover:text-text hover:underline"
            >
              Pin a ticket from search.
            </button>
          }
        >
          {favorites.pins.map((key) => (
            <SidebarTicket
              key={key}
              ticketKey={key}
              ticket={ticketsByKey.get(key)}
              onSelect={() => onSelect(key)}
              action={
                <IconButton
                  label={`Unpin ${key}`}
                  className="sidebar-action size-9 transition-opacity"
                  onClick={(event) => {
                    event.stopPropagation();
                    onUnpin(key);
                  }}
                >
                  <X size={12} />
                </IconButton>
              }
            />
          ))}
        </SidebarSection>

        <SidebarSection
          label="Fixed"
          count={favorites.fixed.length}
          empty={
            <button
              type="button"
              onClick={onOpenFixedSettings}
              className="text-left underline-offset-2 hover:text-text hover:underline"
            >
              Add fixed tickets in Settings.
            </button>
          }
        >
          {favorites.fixed.map((fixed) => (
            <SidebarTicket
              key={fixed.key}
              ticketKey={fixed.key}
              ticket={ticketsByKey.get(fixed.key)}
              onSelect={() => onSelect(fixed.key)}
              action={
                (todayByIssue.get(fixed.key) ?? 0) > 0 ? undefined : (
                  <IconButton
                    label={`Log ${formatDuration(fixed.minutes * 60)} on ${fixed.key}`}
                    className="sidebar-action size-9 transition-opacity"
                    onClick={(event) => {
                      event.stopPropagation();
                      onQuickLog(
                        fixed.key,
                        fixed.minutes * 60,
                        fixed.comment,
                      );
                    }}
                  >
                    <Clock3 size={12} />
                  </IconButton>
                )
              }
            />
          ))}
        </SidebarSection>
          </>
        ) : null}

        <div className="mt-5 px-2">
          <SectionLabel className="px-2">Views</SectionLabel>
          <div className="mt-2 space-y-0.5">
            <ViewButton
              active={view === "search" && activeJql === preferences.defaultJql}
              onClick={() => onView(preferences.defaultJql)}
            >
              My open
            </ViewButton>
            <ViewButton
              active={view === "search" && activeJql === ALL_OPEN_JQL}
              onClick={() => onView(ALL_OPEN_JQL)}
            >
              All open
            </ViewButton>
          </div>
        </div>
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Monogram name={connection.displayName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] text-text-muted">
              {connection.displayName}
            </p>
            <p className="truncate text-[10px] text-text-faint">{host}</p>
          </div>
          <IconButton label="Settings" onClick={onOpenSettings}>
            <Settings2 size={14} />
          </IconButton>
        </div>
      </div>
    </aside>
  );
}

function SidebarSection({
  label,
  count,
  empty,
  children,
}: {
  label: string;
  count: number;
  empty: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-5 px-2">
      <SectionLabel count={count} className="px-2">
        {label}
      </SectionLabel>
      <div className="mt-1.5">
        {count === 0 ? (
          <p className="px-2 py-1 text-[10.5px] leading-4 text-text-faint">
            {empty}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function SidebarTicket({
  ticketKey,
  ticket,
  onSelect,
  action,
}: {
  ticketKey: string;
  ticket?: Ticket;
  onSelect: () => void;
  action?: ReactNode;
}) {
  return (
    <div
      data-ticket-key={ticketKey}
      className="group relative flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-bg-hover"
    >
      <button
        type="button"
        aria-label={`Open ${ticketKey}${ticket ? `: ${ticket.summary}` : ""}`}
        onClick={onSelect}
        className="absolute inset-0 z-10 rounded-md"
      />
      <div className="pointer-events-none min-w-0 flex-1">
        <p className="mono text-[9.5px] leading-4 text-text-faint">{ticketKey}</p>
        <p className="truncate text-[11.5px] leading-4 text-text-muted transition-colors group-hover:text-text">
          {ticket?.summary ?? "Loading…"}
        </p>
      </div>
      {action ? <div className="relative z-20">{action}</div> : null}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11.5px] transition-colors duration-150",
        active
          ? "bg-bg-selected text-text"
          : "text-text-muted hover:bg-bg-hover hover:text-text",
      )}
    >
      <span className={active ? "text-accent" : "text-text-faint"}>{icon}</span>
      {children}
    </button>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11.5px] transition-colors duration-150",
        active
          ? "bg-bg-selected text-text"
          : "text-text-muted hover:bg-bg-hover hover:text-text",
      )}
    >
      <span
        className={cn(
          "size-1 rounded-full",
          active ? "bg-accent" : "bg-transparent",
        )}
      />
      {children}
    </button>
  );
}

function safeHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return baseUrl;
  }
}

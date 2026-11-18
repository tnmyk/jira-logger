import {
  Clock3,
  ExternalLink,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type {
  Connection,
  CreateWorklogInput,
  Preferences,
  Ticket,
  WorklogEntry,
  WorklogSummary,
} from "@/lib/types";
import { formatDuration } from "@/lib/duration";
import {
  formatWorklogDate,
  formatWorklogTime,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";
import WorklogForm from "./WorklogForm";
import {
  Button,
  EmptyState,
  IconButton,
  Monogram,
  SectionLabel,
  Skeleton,
  StatusDot,
} from "./ui";

type DetailPanelProps = {
  ticketKey: string;
  ticket?: Ticket;
  loading: boolean;
  error?: string | null;
  summary?: WorklogSummary;
  summaryLoading: boolean;
  summaryError?: string | null;
  today: string;
  weekStart: string;
  preferences: Preferences;
  connection: Connection;
  pinned: boolean;
  isSubmitting: boolean;
  presetSeconds?: number;
  presetNonce: number;
  onClose: () => void;
  onTogglePin: () => void;
  onCreate: (input: CreateWorklogInput) => Promise<void>;
  onRequestDelete: (entry: WorklogEntry) => void;
  onRetry: () => void;
  onRetrySummary: () => void;
};

export default function DetailPanel({
  ticketKey,
  ticket,
  loading,
  error,
  summary,
  summaryLoading,
  summaryError,
  today,
  weekStart,
  preferences,
  connection,
  pinned,
  isSubmitting,
  presetSeconds,
  presetNonce,
  onClose,
  onTogglePin,
  onCreate,
  onRequestDelete,
  onRetry,
  onRetrySummary,
}: DetailPanelProps) {
  const entries =
    summary?.entries.filter((entry) => entry.issueKey === ticketKey) ?? [];
  const ticketSeconds = summary?.byIssue[ticketKey] ?? 0;
  const [isNarrow, setIsNarrow] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isNarrow) return;
    closeRef.current?.focus();
  }, [isNarrow]);

  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (!isNarrow || event.key !== "Tab") return;
    const root = asideRef.current;
    if (!root) return;

    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getClientRects().length > 0);

    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      {isNarrow ? (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-scrim xl:hidden"
        />
      ) : null}
      <aside
        ref={asideRef}
        id="ticket-detail"
        aria-label="Ticket detail"
        role={isNarrow ? "dialog" : undefined}
        aria-modal={isNarrow ? true : undefined}
        tabIndex={isNarrow ? -1 : undefined}
        onKeyDown={trapFocus}
        className="fixed inset-y-0 right-0 z-40 flex w-[min(420px,100vw)] flex-col border-l border-border bg-bg-raised xl:static xl:z-auto xl:w-[380px] xl:shrink-0"
      >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 md:px-4">
        <IconButton
          ref={closeRef}
          label="Close ticket detail"
          onClick={onClose}
        >
          <X size={15} />
        </IconButton>
        <span className="mono text-[11px] text-text-muted">{ticketKey}</span>
        <div className="flex-1" />
        <IconButton
          label={pinned ? `Unpin ${ticketKey}` : `Pin ${ticketKey}`}
          onClick={onTogglePin}
          className={pinned ? "text-accent" : undefined}
        >
          <Star
            size={14}
            fill={pinned ? "currentColor" : "none"}
            strokeWidth={1.6}
          />
        </IconButton>
        {ticket ? (
          <a
            href={ticket.url}
            target="_blank"
            rel="noreferrer"
            aria-label="Open in Jira"
            title="Open in Jira"
            className="flex size-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
          >
            <ExternalLink size={13} />
          </a>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && !ticket ? (
          <div className="space-y-3 px-4 py-4 md:px-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-6 h-24 w-full" />
          </div>
        ) : error && !ticket ? (
          <EmptyState
            title="Could not load ticket"
            description={error}
            action={
              <Button variant="subtle" size="sm" onClick={onRetry}>
                Try again
              </Button>
            }
          />
        ) : ticket ? (
          <>
            <div className="px-4 pb-4 pt-4 md:px-5">
              <h2 className="text-[15px] font-medium leading-[22px] tracking-[-0.01em] text-text">
                {ticket.summary}
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[10.5px] text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot category={ticket.statusCategory} />
                  {ticket.status}
                </span>
                {ticket.issueType ? <span>{ticket.issueType}</span> : null}
                {ticket.project ? <span>{ticket.project.key}</span> : null}
                <span className="inline-flex items-center gap-1.5">
                  <Monogram name={ticket.assignee?.name} className="size-4 text-[8px]" />
                  {ticket.assignee?.name ?? "Unassigned"}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-3 text-[10px] text-text-faint">
                {summaryLoading ? (
                  <Skeleton className="h-2.5 w-24" />
                ) : summaryError ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={11} />— this week
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={11} />
                    {formatDuration(ticketSeconds)} this week
                  </span>
                )}
                {typeof ticket.remainingEstimateSeconds === "number" ? (
                  <span>
                    {formatDuration(ticket.remainingEstimateSeconds)} remaining
                  </span>
                ) : null}
              </div>
            </div>

            <WorklogForm
              key={`${ticketKey}:${presetNonce}`}
              issueKey={ticketKey}
              timeZone={connection.timeZone}
              today={today}
              weekStart={weekStart}
              preferences={preferences}
              initialSeconds={presetSeconds}
              isSubmitting={isSubmitting}
              onCreate={onCreate}
            />

            <div className="px-4 py-4 md:px-5">
              <div className="flex items-center justify-between">
                <SectionLabel>Recent worklogs</SectionLabel>
                {entries.length > 0 ? (
                  <span className="text-[10px] text-text-faint">
                    {formatDuration(ticketSeconds)}
                  </span>
                ) : null}
              </div>

              {summaryLoading ? (
                <div className="mt-2 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-4/5" />
                </div>
              ) : (
                <>
                  {summaryError ? (
                    <div className="mt-2 rounded-md border border-warning/20 bg-warning/5 px-2.5 py-2">
                      <p role="alert" className="text-[10.5px] leading-4 text-warning">
                        Could not refresh worklogs.
                      </p>
                      <button
                        type="button"
                        onClick={onRetrySummary}
                        className="mt-1 text-[10.5px] text-text-muted underline-offset-2 hover:text-text hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}

                  {entries.length === 0 ? (
                    summaryError ? null : (
                      <p className="mt-2 text-[11px] leading-5 text-text-faint">
                        No time logged this week.
                      </p>
                    )
                  ) : (
                    <ul className="mt-1">
                      {entries.map((entry) => (
                        <li
                          key={entry.id}
                          className="group flex items-start gap-2 border-b border-border/70 py-2.5 last:border-b-0"
                        >
                          <div className="w-[54px] shrink-0">
                            <p className="text-[10.5px] text-text-muted">
                              {formatWorklogDate(entry.started, connection.timeZone)}
                            </p>
                            <p className="mono mt-0.5 text-[9.5px] text-text-faint">
                              {formatWorklogTime(entry.started, connection.timeZone)}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="mono text-[10.5px] text-text">
                              {formatDuration(entry.seconds)}
                            </p>
                            {entry.comment ? (
                              <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-4 text-text-faint">
                                {entry.comment}
                              </p>
                            ) : null}
                          </div>
                          <IconButton
                            label={`Delete ${formatDuration(entry.seconds)} worklog on ${entry.issueKey}`}
                            className={cn(
                              "size-9 text-text-faint transition-colors hover:text-danger focus-visible:text-danger",
                            )}
                            onClick={(event) => {
                            event.currentTarget.focus();
                            onRequestDelete(entry);
                          }}
                          >
                            <Trash2 size={12} />
                          </IconButton>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </>
        ) : null}
      </div>
      </aside>
    </>
  );
}

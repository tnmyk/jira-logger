import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import type {
  Connection,
  CreateWorklogInput,
  Preferences,
} from "@/lib/types";
import { formatInTimeZone } from "date-fns-tz";
import {
  addDays,
  buildStarted,
  formatDayLong,
  isWeekend,
  todayInZone,
} from "@/lib/datetime";
import { formatDuration, parseDuration } from "@/lib/duration";
import {
  Button,
  Input,
  Modal,
  SectionLabel,
  Textarea,
} from "./ui";

const KEY_PATTERN = /^[A-Z][A-Z0-9_]+-\d+$/;

type BackfillDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: string;
  weekLabel?: string;
  weekStart?: string;
  weekEnd?: string;
  dayTotalSeconds?: number;
  dayTotals?: Record<string, number>;
  targetSeconds?: number;
  daysOff?: string[];
  connection: Connection;
  preferences: Preferences;
  suggestions: Array<{
    key: string;
    summary?: string;
    minutes?: number;
    comment?: string;
  }>;
  isSubmitting: boolean;
  onLog: (input: CreateWorklogInput) => Promise<void>;
};

export default function BackfillDialog({
  open,
  onOpenChange,
  initialDate,
  weekLabel,
  weekStart,
  weekEnd,
  dayTotalSeconds = 0,
  dayTotals,
  targetSeconds = 0,
  daysOff = [],
  connection,
  preferences,
  suggestions,
  isSubmitting,
  onLog,
}: BackfillDialogProps) {
  const today = todayInZone(connection.timeZone);
  const minDate = addDays(today, -365);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(preferences.startTime);
  const [ticketKey, setTicketKey] = useState("");
  const [duration, setDuration] = useState("");
  const [comment, setComment] = useState(preferences.defaultComment);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!open) return;
    setDate(initialDate);
    setTime(
      initialDate === today
        ? formatInTimeZone(new Date(), connection.timeZone, "HH:mm")
        : preferences.startTime,
    );
    setDuration(
      preferences.defaultDurationMinutes > 0
        ? formatDuration(preferences.defaultDurationMinutes * 60)
        : "",
    );
    setError(null);
  }, [
    open,
    initialDate,
    preferences.startTime,
    today,
    connection.timeZone,
  ]);

  const selectedSuggestion = suggestions.find(
    (item) => item.key === ticketKey.toUpperCase(),
  );
  const sameWeek =
    !weekStart || !weekEnd
      ? true
      : date >= weekStart && date <= weekEnd;
  const effectiveTarget =
    isWeekend(date) || daysOff.includes(date) ? 0 : targetSeconds;
  const currentDayTotal =
    sameWeek ? (dayTotals?.[date] ?? dayTotalSeconds) : 0;
  const remainingSeconds = sameWeek
    ? Math.max(0, effectiveTarget - currentDayTotal)
    : 0;

  async function submit(mode: "close" | "another") {
    if (submitLock.current || isSubmitting) return;
    setError(null);
    const key = ticketKey.trim().toUpperCase();
    if (!KEY_PATTERN.test(key)) {
      setError("Enter a ticket key like ABC-123.");
      return;
    }
    const seconds = parseDuration(duration);
    if (!seconds) {
      setError("Enter a duration like 90m, 1h 30m, or 1.5.");
      return;
    }
    if (!date) {
      setError("Choose a date.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setError("Choose a start time.");
      return;
    }
    if (date > today) {
      setError("Backfill date cannot be in the future.");
      return;
    }
    if (date < minDate) {
      setError("Backfill is limited to the last 12 months.");
      return;
    }

    submitLock.current = true;
    try {
      const started = buildStarted(date, time, connection.timeZone);
      if (date === today && new Date(started).getTime() > Date.now() + 5 * 60_000) {
        setError("Start time cannot be in the future.");
        return;
      }
      await onLog({
        issueKey: key,
        seconds,
        started,
        comment: comment.trim() || undefined,
        adjustEstimate: preferences.adjustEstimate,
        notifyWatchers: preferences.notifyWatchers,
      });

      if (mode === "another") {
        setTicketKey("");
        setDuration(
          preferences.defaultDurationMinutes > 0
            ? formatDuration(preferences.defaultDurationMinutes * 60)
            : "",
        );
        setComment(preferences.defaultComment);
      } else {
        onOpenChange(false);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log time.");
    } finally {
      submitLock.current = false;
    }
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit("close");
  }

  const isToday = date === today;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isToday ? "Log time" : "Backfill time"}
      description={
        isToday ? "Log time on any ticket." : "Log time on a day you missed."
      }
      className="w-[min(460px,calc(100vw-32px))]"
      closeOnEscape={false}
    >
      <form
        onSubmit={handleSubmit}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit("close");
          }
        }}
      >
        <div className="space-y-3">
          {weekLabel && sameWeek ? (
            <p className="text-[10.5px] leading-4 text-text-faint">
              {weekLabel} · {date ? formatDayLong(date) : ""} ·{" "}
              {formatDuration(currentDayTotal)} logged
              {effectiveTarget > 0
                ? ` / ${formatDuration(effectiveTarget)}`
                : null}
            </p>
          ) : weekLabel ? (
            <p className="text-[10.5px] leading-4 text-text-faint">
              {date ? formatDayLong(date) : ""} is outside the selected week.
              Choose a date in {weekLabel} for target context.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-text-muted">Date</span>
              <Input
                type="date"
                value={date}
                min={minDate}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                className="h-9 text-[12px]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-text-muted">
                Start time
              </span>
              <Input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="h-9 text-[12px]"
              />
            </label>
          </div>

          <div>
            <SectionLabel>Recent tickets</SectionLabel>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {suggestions.slice(0, 8).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={ticketKey.toUpperCase() === item.key}
                  aria-label={`Use ${item.key}${item.summary ? `: ${item.summary}` : ""}`}
                  onClick={() => {
                    setTicketKey(item.key);
                    if (item.minutes) {
                      setDuration(formatDuration(item.minutes * 60));
                    }
                    if (item.comment) setComment(item.comment);
                  }}
                  className={
                    ticketKey.toUpperCase() === item.key
                      ? "min-h-9 rounded-md border border-accent/35 bg-accent-soft px-2.5 py-1 text-[10.5px] text-accent"
                      : "min-h-9 rounded-md border border-border px-2.5 py-1 text-[10.5px] text-text-muted transition-colors hover:border-border-strong hover:text-text"
                  }
                  title={item.summary}
                >
                  {item.key}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] text-text-muted">
              Ticket key
            </span>
            <Input
              value={ticketKey}
              onChange={(event) => setTicketKey(event.target.value.toUpperCase())}
              placeholder="ABC-123"
              className="mono h-9 text-[12px]"
              spellCheck={false}
              autoFocus
            />
            {selectedSuggestion?.summary ? (
              <span className="mt-1 block truncate text-[10px] text-text-faint">
                {selectedSuggestion.summary}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] text-text-muted">
              Duration
            </span>
            <Input
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              placeholder="1h 30m"
              className="mono h-9 text-[12px]"
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {preferences.quickDurations.slice(0, 6).map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={parseDuration(duration) === minutes * 60}
                  onClick={() => setDuration(formatDuration(minutes * 60))}
                  className="min-h-9 min-w-11 rounded-md border border-transparent px-2.5 py-1 text-[10.5px] text-text-faint transition-colors hover:border-border hover:bg-bg-hover hover:text-text"
                >
                  {formatDuration(minutes * 60)}
                </button>
              ))}
              {remainingSeconds > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setDuration(formatDuration(remainingSeconds))
                  }
                  className="min-h-9 rounded-md border border-border px-2 py-1 text-[10.5px] text-text-muted transition-colors hover:border-border-strong hover:text-text"
                >
                  Fill remaining {formatDuration(remainingSeconds)}
                </button>
              ) : null}
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] text-text-muted">
              Comment <span className="text-text-faint">(optional)</span>
            </span>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What did you work on?"
              rows={2}
              className="min-h-[52px] text-[12px]"
            />
          </label>

          {error ? (
            <p role="alert" className="text-[11px] leading-5 text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="subtle"
            size="sm"
            disabled={isSubmitting}
            onClick={() => void submit("another")}
          >
            Log & another
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Logging…" : "Log time"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

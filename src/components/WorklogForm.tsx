import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import { formatInTimeZone } from "date-fns-tz";
import { buildStarted } from "@/lib/datetime";
import { formatDuration, parseDuration } from "@/lib/duration";
import type { CreateWorklogInput, Preferences } from "@/lib/types";
import { Button, Input, SectionLabel, Textarea } from "./ui";

type WorklogFormProps = {
  issueKey: string;
  timeZone: string;
  today: string;
  weekStart: string;
  preferences: Preferences;
  initialSeconds?: number;
  isSubmitting: boolean;
  onCreate: (input: CreateWorklogInput) => Promise<void>;
};

export default function WorklogForm({
  issueKey,
  timeZone,
  today,
  weekStart,
  preferences,
  initialSeconds,
  isSubmitting,
  onCreate,
}: WorklogFormProps) {
  const [duration, setDuration] = useState(
    initialSeconds
      ? formatDuration(initialSeconds)
      : preferences.defaultDurationMinutes > 0
        ? formatDuration(preferences.defaultDurationMinutes * 60)
        : "",
  );
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(() =>
    formatInTimeZone(new Date(), timeZone, "HH:mm"),
  );
  const [comment, setComment] = useState(preferences.defaultComment);
  const [reduceEstimate, setReduceEstimate] = useState(
    preferences.adjustEstimate === "auto",
  );
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

  useEffect(() => {
    setDate((current) =>
      current >= weekStart && current <= today ? current : today,
    );
  }, [today, weekStart]);

  const parsedSeconds = parseDuration(duration);
  const quickDurations = preferences.quickDurations.slice(0, 6);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || submitLock.current) return;
    setError(null);

    if (!parsedSeconds) {
      setError("Enter a duration like 90m, 1h 30m, or 1.5.");
      return;
    }
    if (!date || !time) {
      setError("Choose a date and start time.");
      return;
    }
    if (date < weekStart) {
      setError("Worklogs must be within the current week.");
      return;
    }
    if (date > today) {
      setError("Worklogs cannot be logged in the future.");
      return;
    }

    submitLock.current = true;
    try {
      const started = buildStarted(date, time, timeZone);
      if (new Date(started).getTime() > Date.now() + 5 * 60_000) {
        setError("Start time cannot be in the future.");
        return;
      }
      await onCreate({
        issueKey,
        seconds: parsedSeconds,
        started,
        comment: comment.trim() || undefined,
        adjustEstimate: reduceEstimate ? "auto" : "leave",
        notifyWatchers: preferences.notifyWatchers,
      });
      setDuration("");
      setComment("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log time.");
    } finally {
      submitLock.current = false;
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (isSubmitting || submitLock.current) return;
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="border-b border-border px-4 py-4 md:px-5"
    >
      <SectionLabel>Log time</SectionLabel>

      <div className="mt-2.5 flex items-center gap-2">
        <Input
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
          placeholder="1h 30m"
          aria-label="Duration"
          className="mono h-9 w-[124px] text-[13px]"
          autoFocus={Boolean(initialSeconds)}
        />
        <span className="min-w-0 flex-1 text-[10.5px] text-text-faint">
          {duration.trim()
            ? parsedSeconds
              ? `= ${formatDuration(parsedSeconds)}`
              : "Use 90m, 1h 30m, 1.5, or 1:30"
            : "Hours, minutes, or h:mm"}
        </span>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Logging…" : "Log time"}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {quickDurations.map((minutes) => {
          const seconds = minutes * 60;
          const label = formatDuration(seconds);
          const active = parsedSeconds === seconds;
          return (
            <button
              key={minutes}
              type="button"
              onClick={() => setDuration(label)}
              className={
                active
                  ? "min-h-9 min-w-11 rounded-md border border-accent/40 bg-accent-soft px-2.5 py-1 text-[10.5px] text-accent transition-colors"
                  : "min-h-9 min-w-11 rounded-md border border-transparent px-2.5 py-1 text-[10.5px] text-text-faint transition-colors hover:border-border hover:bg-bg-hover hover:text-text"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-text-muted">Date</span>
          <Input
            type="date"
            value={date}
            min={weekStart}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Worklog date"
            className="h-8 text-[12px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-text-muted">
            Start time
          </span>
          <Input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            aria-label="Worklog start time"
            className="h-8 text-[12px]"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[10.5px] text-text-muted">
          Comment <span className="text-text-faint">(optional)</span>
        </span>
        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What did you work on?"
          className="min-h-[54px] text-[12px]"
          rows={2}
        />
      </label>

      <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[10.5px] text-text-muted">
        <input
          type="checkbox"
          checked={reduceEstimate}
          onChange={(event) => setReduceEstimate(event.target.checked)}
          className="size-3.5 accent-[var(--color-accent)]"
        />
        Reduce remaining estimate automatically
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-[11px] leading-5 text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

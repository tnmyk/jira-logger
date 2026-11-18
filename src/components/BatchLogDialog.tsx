import { useEffect, useMemo, useRef, useState } from "react";
import type { CreateWorklogInput, Preferences } from "@/lib/types";
import { formatDayLong } from "@/lib/datetime";
import { formatDuration, parseDuration } from "@/lib/duration";
import { Button, Input, Modal } from "./ui";

type BatchSuggestion = {
  key: string;
  summary?: string;
  minutes?: number;
  comment?: string;
};

type BatchLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: Preferences;
  today: string;
  suggestions: BatchSuggestion[];
  isSubmitting: boolean;
  onSubmit: (inputs: CreateWorklogInput[]) => Promise<void>;
};

type RowState = {
  key: string;
  summary?: string;
  duration: string;
  comment: string;
  defaultMinutes?: number;
};

export default function BatchLogDialog({
  open,
  onOpenChange,
  preferences,
  today,
  suggestions,
  isSubmitting,
  onSubmit,
}: BatchLogDialogProps) {
  const initialRows = useMemo(
    () =>
      suggestions.map<RowState>((item) => ({
        key: item.key,
        summary: item.summary,
        duration: "",
        comment: item.comment ?? preferences.defaultComment,
        defaultMinutes: item.minutes,
      })),
    [suggestions, preferences.defaultComment],
  );
  const [rows, setRows] = useState<RowState[]>(initialRows);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!open) return;
    setRows(initialRows);
    setError(null);
  }, [open]);

  const readyRows = rows.filter((row) => row.duration.trim());
  const firstBlankIndex = rows.findIndex((row) => !row.duration.trim());

  async function submit() {
    if (submitLock.current || isSubmitting) return;
    setError(null);
    if (readyRows.length === 0) {
      setError("Add a duration to at least one ticket.");
      return;
    }

    const inputs: CreateWorklogInput[] = [];
    for (const row of readyRows) {
      const seconds = parseDuration(row.duration);
      if (!seconds) {
        setError(`Invalid duration for ${row.key}.`);
        return;
      }
      inputs.push({
        issueKey: row.key,
        seconds,
        started: "",
        comment: row.comment.trim() || undefined,
        adjustEstimate: preferences.adjustEstimate,
        notifyWatchers: preferences.notifyWatchers,
      });
    }

    submitLock.current = true;
    try {
      await onSubmit(inputs);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log time.");
    } finally {
      submitLock.current = false;
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Fill today"
      description={`${formatDayLong(today)} · enter durations for the tickets you worked on.`}
      className="w-[min(620px,calc(100vw-32px))]"
      closeOnEscape={false}
    >
      <div
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
      >
      {rows.length === 0 ? (
        <p className="text-[12px] text-text-muted">
          No unlogged tickets to fill. Add or pin tickets, or use a quick-log
          button.
        </p>
      ) : (
        <>
          <div className="mt-3 hidden grid-cols-[1fr_106px_1fr] gap-2 text-[9px] uppercase tracking-[0.08em] text-text-faint sm:grid">
            <span>Ticket</span>
            <span>Duration</span>
            <span>Comment</span>
          </div>
          <div className="mt-1 max-h-[50vh] space-y-2 overflow-y-auto">
            {rows.map((row, index) => (
              <div
                key={row.key}
                className="grid grid-cols-2 items-center gap-2 border-b border-border pb-2 last:border-b-0 sm:grid-cols-[1fr_106px_1fr]"
              >
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <p className="mono text-[9.5px] text-text-faint">{row.key}</p>
                  <p className="truncate text-[11px] text-text-muted">
                    {row.summary ?? "Ticket"}
                  </p>
                </div>
                <Input
                  value={row.duration}
                  autoFocus={index === firstBlankIndex}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, duration: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="—"
                  aria-label={`Duration for ${row.key}`}
                  className="mono h-9 text-[12px]"
                />
                <Input
                  value={row.comment}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, comment: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="Comment"
                  aria-label={`Comment for ${row.key}`}
                  className="h-9 text-[11px]"
                />
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {rows.some((row) => row.defaultMinutes) ? (
              <button
                type="button"
                onClick={() =>
                  setRows((current) =>
                    current.map((row) =>
                      row.defaultMinutes && !row.duration.trim()
                        ? {
                            ...row,
                            duration: formatDuration(row.defaultMinutes * 60),
                          }
                        : row,
                    ),
                  )
                }
                className="min-h-9 rounded-md border border-border px-2.5 py-1 text-[10.5px] text-text-muted transition-colors hover:border-border-strong hover:text-text"
              >
                Use fixed defaults
              </button>
            ) : null}
            {preferences.quickDurations.slice(0, 6).map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => {
                  const label = formatDuration(minutes * 60);
                  setRows((current) =>
                    current.map((row) =>
                      row.duration.trim() ? row : { ...row, duration: label },
                    ),
                  );
                }}
                className="min-h-9 rounded-md border border-transparent px-2.5 py-1 text-[10.5px] text-text-faint transition-colors hover:border-border hover:bg-bg-hover hover:text-text"
              >
                Fill empty with {formatDuration(minutes * 60)}
              </button>
            ))}
          </div>

          {error ? (
            <p role="alert" className="mt-3 text-[11px] leading-5 text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[10.5px] text-text-faint">
              {readyRows.length} {readyRows.length === 1 ? "entry" : "entries"}{" "}
              ready
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isSubmitting || readyRows.length === 0}
                onClick={() => void submit()}
              >
                {isSubmitting
                  ? "Logging…"
                  : `Log ${readyRows.length} ${readyRows.length === 1 ? "entry" : "entries"}`}
              </Button>
            </div>
          </div>
        </>
      )}
      </div>
    </Modal>
  );
}

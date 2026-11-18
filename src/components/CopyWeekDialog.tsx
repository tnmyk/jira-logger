import { useEffect, useMemo, useRef, useState } from "react";
import type { Connection, WorklogEntry, WorklogSummary } from "@/lib/types";
import { formatInTimeZone } from "date-fns-tz";
import {
  addDays,
  formatDayLabel,
  formatWorklogTime,
  worklogDay,
} from "@/lib/datetime";
import { formatDuration } from "@/lib/duration";
import { Button, Modal, Skeleton } from "./ui";

type CopyWeekDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: Connection;
  today: string;
  sourceWeekLabel: string;
  targetWeekLabel: string;
  sourceSummary?: WorklogSummary;
  loading: boolean;
  error?: string | null;
  isSubmitting: boolean;
  onRetry: () => void;
  onCopy: (entries: WorklogEntry[]) => Promise<void>;
};

export default function CopyWeekDialog({
  open,
  onOpenChange,
  connection,
  today,
  sourceWeekLabel,
  targetWeekLabel,
  sourceSummary,
  loading,
  error,
  isSubmitting,
  onRetry,
  onCopy,
}: CopyWeekDialogProps) {
  const entries = sourceSummary?.entries ?? [];
  const submitLock = useRef(false);
  const nowTime = formatInTimeZone(
    new Date(),
    connection.timeZone,
    "HH:mm",
  );
  const eligibleEntries = entries.filter((entry) => {
    const day = worklogDay(entry.started, connection.timeZone);
    const targetDate = addDays(day, 7);
    if (targetDate > today) return false;
    if (targetDate === today) {
      return formatWorklogTime(entry.started, connection.timeZone) <= nowTime;
    }
    return true;
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(eligibleEntries.map((entry) => entry.id)));
  }, [open, sourceSummary]);

  const grouped = useMemo(() => {
    const map = new Map<string, WorklogEntry[]>();
    for (const entry of entries) {
      const day = worklogDay(entry.started, connection.timeZone);
      const list = map.get(day) ?? [];
      list.push(entry);
      map.set(day, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [entries, connection.timeZone]);

  const selectedEntries = entries.filter((entry) => selected.has(entry.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === eligibleEntries.length
        ? new Set()
        : new Set(eligibleEntries.map((entry) => entry.id)),
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Copy previous week"
      description={`${sourceWeekLabel} → ${targetWeekLabel}`}
      className="w-[min(560px,calc(100vw-32px))]"
      closeOnEscape={false}
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-5/6" />
          <Skeleton className="h-8 w-4/6" />
        </div>
      ) : error ? (
        <div>
          <p role="alert" className="text-[11px] text-danger">
            Could not load the previous week.
          </p>
          <Button variant="subtle" size="sm" className="mt-3" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-[12px] text-text-muted">
          No worklogs in {sourceWeekLabel}.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[10.5px] text-text-muted">
              {selectedEntries.length} of {eligibleEntries.length} eligible
              entries selected
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="text-[10.5px] text-text-muted underline-offset-2 hover:text-text hover:underline"
            >
              {selected.size === eligibleEntries.length
                ? "Select none"
                : "Select all"}
            </button>
          </div>

          <div className="mt-2 max-h-[45vh] overflow-y-auto">
            {grouped.map(([day, dayEntries]) => (
              <div key={day} className="border-b border-border py-2 last:border-b-0">
                <p className="mono text-[9.5px] text-text-faint">
                  {formatDayLabel(day)}
                </p>
                <div className="mt-1 space-y-1">
                  {dayEntries.map((entry) => {
                    const sourceTime = formatWorklogTime(
                      entry.started,
                      connection.timeZone,
                    );
                    const targetDate = addDays(
                      worklogDay(entry.started, connection.timeZone),
                      7,
                    );
                    const isFuture =
                      targetDate > today ||
                      (targetDate === today && sourceTime > nowTime);
                    return (
                      <label
                        key={entry.id}
                        className={
                          isFuture
                            ? "flex min-h-9 cursor-not-allowed items-center gap-2 rounded-md px-1 py-1 opacity-45"
                            : "flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-bg-hover"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(entry.id)}
                          disabled={isFuture}
                          onChange={() => toggle(entry.id)}
                          className="size-3.5 accent-[var(--color-accent)]"
                        />
                        <span className="mono w-[70px] shrink-0 text-[10px] text-text-muted">
                          {entry.issueKey}
                        </span>
                        <span className="mono w-[52px] shrink-0 text-[10px] text-text">
                          {formatDuration(entry.seconds)}
                        </span>
                        <span className="w-[36px] shrink-0 text-[10px] text-text-faint">
                          {sourceTime}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[10.5px] text-text-faint">
                          {isFuture
                            ? "Future time — skipped"
                            : (entry.comment ?? entry.issueSummary ?? "")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmitting || selectedEntries.length === 0}
              onClick={() => {
                if (submitLock.current) return;
                submitLock.current = true;
                void onCopy(selectedEntries).finally(() => {
                  submitLock.current = false;
                });
              }}
            >
              {isSubmitting
                ? "Copying…"
                : `Copy ${selectedEntries.length} ${selectedEntries.length === 1 ? "entry" : "entries"}`}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

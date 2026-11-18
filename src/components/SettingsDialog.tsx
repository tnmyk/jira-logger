import { Plus, Trash2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent,
} from "react";
import { getIssue } from "@/lib/api-client";
import type {
  Connection,
  Favorites,
  FixedTicket,
  Preferences,
} from "@/lib/types";
import { formatDuration } from "@/lib/duration";
import { cn } from "@/lib/utils";
import {
  Button,
  ConfirmDialog,
  IconButton,
  Input,
  Modal,
  SectionLabel,
  Textarea,
} from "./ui";

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: Preferences;
  favorites: Favorites;
  connection: Connection;
  initialTab?: SettingsTab;
  onSave: (preferences: Preferences, fixedTickets: FixedTicket[]) => void;
  onDisconnect: () => void;
};

const KEY_PATTERN = /^[A-Z][A-Z0-9_]+-\d+$/;
const TABS = ["defaults", "fixed", "connection"] as const;
type SettingsTab = (typeof TABS)[number];

export default function SettingsDialog({
  open,
  onOpenChange,
  preferences,
  favorites,
  connection,
  initialTab,
  onSave,
  onDisconnect,
}: SettingsDialogProps) {
  const [draft, setDraft] = useState(preferences);
  const [fixedDrafts, setFixedDrafts] = useState<FixedTicket[]>(
    favorites.fixed,
  );
  const [durationsText, setDurationsText] = useState(
    preferences.quickDurations.join(", "),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [saving, setSaving] = useState(false);
  const closedRef = useRef(false);
  const saveGenerationRef = useRef(0);
  const saveLockRef = useRef(false);
  const [tab, setTab] = useState<SettingsTab>("defaults");

  useEffect(() => {
    if (!open) return;
    setDraft(preferences);
    setFixedDrafts(favorites.fixed);
    setDurationsText(preferences.quickDurations.join(", "));
    setError(null);
    setTab(initialTab ?? "defaults");
    setSaving(false);
    closedRef.current = false;
    saveLockRef.current = false;
    saveGenerationRef.current += 1;
  }, [open, preferences, favorites.fixed, initialTab]);

  function closeSettings() {
    closedRef.current = true;
    saveGenerationRef.current += 1;
    onOpenChange(false);
  }

  function handleTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const index = TABS.indexOf(tab);
    let nextIndex = index;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;
    else return;

    event.preventDefault();
    const next = TABS[nextIndex];
    setTab(next);
    document.getElementById(`settings-tab-${next}`)?.focus();
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || saveLockRef.current) return;
    setError(null);

    if (!draft.defaultJql.trim()) {
      setError("Default JQL cannot be empty.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(draft.startTime)) {
      setError("Start time must use HH:mm.");
      return;
    }

    const durations = Array.from(
      new Set(
        durationsText
          .split(/[,\s]+/)
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0 && value <= 1440)
          .map((value) => Math.round(value)),
      ),
    ).sort((a, b) => a - b);

    if (durations.length === 0) {
      setError("Add at least one quick duration in minutes.");
      return;
    }

    if (
      !Number.isFinite(draft.targetMinutesPerDay) ||
      draft.targetMinutesPerDay < 0 ||
      draft.targetMinutesPerDay > 1440
    ) {
      setError("Target per day must be between 0 and 1440 minutes.");
      return;
    }
    if (
      !Number.isFinite(draft.defaultDurationMinutes) ||
      draft.defaultDurationMinutes < 0 ||
      draft.defaultDurationMinutes > 1440
    ) {
      setError("Default duration must be between 0 and 1440 minutes.");
      return;
    }

    const cleanedFixed: FixedTicket[] = [];
    for (const item of fixedDrafts) {
      const key = item.key.trim().toUpperCase();
      if (!key && !item.comment?.trim()) continue;
      if (!KEY_PATTERN.test(key)) {
        setError("Enter a ticket key like ABC-123.");
        return;
      }
      if (
        !Number.isFinite(item.minutes) ||
        item.minutes <= 0 ||
        item.minutes > 1440
      ) {
        setError(`Choose valid minutes for ${key}.`);
        return;
      }
      if (favorites.pins.includes(key)) {
        setError(
          `${key} is pinned. Unpin it first, or remove it from fixed tickets.`,
        );
        return;
      }
      if (cleanedFixed.some((fixed) => fixed.key === key)) {
        setError(`${key} is already in fixed tickets.`);
        return;
      }
      cleanedFixed.push({
        key,
        minutes: Math.round(item.minutes),
        comment: item.comment?.trim() || undefined,
      });
    }

    saveLockRef.current = true;
    const generation = ++saveGenerationRef.current;
    setSaving(true);
    try {
      for (const fixed of cleanedFixed) {
        try {
          await getIssue(fixed.key);
        } catch {
          if (closedRef.current || generation !== saveGenerationRef.current) {
            return;
          }
          setError(
            `Could not find ${fixed.key}. Check the ticket key and Jira access.`,
          );
          return;
        }
        if (closedRef.current || generation !== saveGenerationRef.current) {
          return;
        }
      }
      if (closedRef.current || generation !== saveGenerationRef.current) {
        return;
      }

      onSave(
        {
          ...draft,
          defaultJql: draft.defaultJql.trim(),
          quickDurations: durations,
          targetMinutesPerDay: Math.round(draft.targetMinutesPerDay),
          defaultDurationMinutes: Math.round(draft.defaultDurationMinutes),
          defaultComment: draft.defaultComment.trim(),
        },
        cleanedFixed,
      );
      closeSettings();
    } finally {
      saveLockRef.current = false;
      if (generation === saveGenerationRef.current) {
        setSaving(false);
      }
    }
  }

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeSettings();
          } else {
            onOpenChange(true);
          }
        }}
        title="Settings"
        description="Stored only in this browser."
        className="w-[min(560px,calc(100vw-32px))]"
        closeOnEscape={false}
      >
      <form onSubmit={handleSubmit}>
        <div
          className="mt-4 flex gap-1 border-b border-border"
          role="tablist"
          aria-label="Settings sections"
          onKeyDown={handleTabKeyDown}
        >
          <TabButton
            id="settings-tab-defaults"
            controls="settings-panel-defaults"
            active={tab === "defaults"}
            onClick={() => setTab("defaults")}
          >
            Defaults
          </TabButton>
          <TabButton
            id="settings-tab-fixed"
            controls="settings-panel-fixed"
            active={tab === "fixed"}
            onClick={() => setTab("fixed")}
          >
            Fixed tickets
          </TabButton>
          <TabButton
            id="settings-tab-connection"
            controls="settings-panel-connection"
            active={tab === "connection"}
            onClick={() => setTab("connection")}
          >
            Connection
          </TabButton>
        </div>

        <div className="space-y-4">
          <section
            id="settings-panel-defaults"
            role="tabpanel"
            aria-labelledby="settings-tab-defaults"
            className={tab === "defaults" ? "pt-4" : "hidden"}
          >
            <SectionLabel>Defaults</SectionLabel>
            <div className="mt-2 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] text-text-muted">
                  Default JQL
                </span>
                <Textarea
                  value={draft.defaultJql}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      defaultJql: event.target.value,
                    }))
                  }
                  rows={2}
                  className="mono min-h-[52px] text-[11.5px]"
                  spellCheck={false}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-text-muted">
                    Backfill start time
                  </span>
                  <Input
                    type="time"
                    value={draft.startTime}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                    className="h-8 text-[12px]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-text-muted">
                    Week starts
                  </span>
                  <select
                    value={draft.weekStart}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        weekStart: event.target.value as Preferences["weekStart"],
                      }))
                    }
                    className="quiet-input quiet-select h-8 text-[12px]"
                  >
                    <option value="monday">Monday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-text-muted">
                    Quick durations (minutes)
                  </span>
                  <Input
                    value={durationsText}
                    onChange={(event) => setDurationsText(event.target.value)}
                    placeholder="15, 30, 60, 120, 480"
                    className="h-8 text-[12px]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-text-muted">
                    Estimate on log
                  </span>
                  <select
                    value={draft.adjustEstimate}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        adjustEstimate: event.target.value as Preferences["adjustEstimate"],
                      }))
                    }
                    className="quiet-input quiet-select h-8 text-[12px]"
                  >
                    <option value="leave">Leave unchanged</option>
                    <option value="auto">Reduce automatically</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-text-muted">
                    Daily target on working days
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={1440}
                    value={draft.targetMinutesPerDay}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        targetMinutesPerDay: Number(event.target.value),
                      }))
                    }
                    className="h-8 text-[12px]"
                  />
                  <span className="mt-1 block text-[10px] text-text-faint">
                    {draft.targetMinutesPerDay > 0
                      ? `= ${formatDuration(draft.targetMinutesPerDay * 60)}. 0 hides target.`
                      : "No target. Weekends excluded."}
                  </span>
                </label>
                <label className="flex cursor-pointer items-end gap-2 pb-5 text-[11px] text-text-muted">
                  <input
                    type="checkbox"
                    checked={draft.showWeekends}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        showWeekends: event.target.checked,
                      }))
                    }
                    className="size-3.5 accent-[var(--color-accent)]"
                  />
                  Show weekends
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-text-muted">
                    Default duration (minutes)
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={1440}
                    value={draft.defaultDurationMinutes}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        defaultDurationMinutes: Number(event.target.value),
                      }))
                    }
                    className="h-8 text-[12px]"
                  />
                  <span className="mt-1 block text-[10px] text-text-faint">
                    {draft.defaultDurationMinutes > 0
                      ? `= ${formatDuration(draft.defaultDurationMinutes * 60)} preset. 0 leaves blank.`
                      : "Blank by default."}
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-text-muted">
                    Default comment
                  </span>
                  <Input
                    value={draft.defaultComment}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        defaultComment: event.target.value,
                      }))
                    }
                    placeholder="Optional"
                    className="h-8 text-[12px]"
                  />
                </label>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-text-muted">
                <input
                  type="checkbox"
                  checked={draft.notifyWatchers}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      notifyWatchers: event.target.checked,
                    }))
                  }
                  className="size-3.5 accent-[var(--color-accent)]"
                />
                Notify Jira watchers when logging time
              </label>
            </div>
          </section>

          <section
            id="settings-panel-fixed"
            role="tabpanel"
            aria-labelledby="settings-tab-fixed"
            className={tab === "fixed" ? "pt-4" : "hidden"}
          >
            <SectionLabel>Fixed tickets</SectionLabel>
            <p className="mt-1 text-[11px] leading-5 text-text-muted">
              Pinned tickets are for work you open often. Fixed tickets are
              recurring/admin work with a one-click duration and optional
              default comment.
            </p>

            <div className="mt-2 space-y-2">
              {fixedDrafts.length === 0 ? (
                <p className="text-[10.5px] leading-4 text-text-faint">
                  No fixed tickets yet.
                </p>
              ) : null}

              {fixedDrafts.map((fixed, index) => (
                <div
                  key={index}
                  className="space-y-2 border-b border-border pb-3 last:border-b-0"
                >
                  <div className="flex items-end gap-2">
                    <label className="block min-w-0 flex-1">
                      <span className="mb-1 block text-[10px] text-text-faint">
                        Ticket key
                      </span>
                      <Input
                        value={fixed.key}
                        onChange={(event) =>
                          setFixedDrafts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    key: event.target.value.toUpperCase(),
                                  }
                                : item,
                            ),
                          )
                        }
                        placeholder="ADMIN-123"
                        className="mono h-8 text-[11.5px]"
                        spellCheck={false}
                      />
                    </label>
                    <label className="block w-[80px] shrink-0">
                      <span className="mb-1 block text-[10px] text-text-faint">
                        Minutes
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        value={fixed.minutes}
                        onChange={(event) =>
                          setFixedDrafts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    minutes: Number(event.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                        className="h-8 text-[11.5px]"
                      />
                    </label>
                    <IconButton
                      label={`Remove ${fixed.key || "fixed ticket"}`}
                      className="mb-0.5 text-text-faint hover:text-danger"
                      onClick={() =>
                        setFixedDrafts((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                  <Input
                    value={fixed.comment ?? ""}
                    onChange={(event) =>
                      setFixedDrafts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, comment: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="Default comment (optional), e.g. Daily standup"
                    className="h-8 text-[11.5px]"
                  />
                </div>
              ))}

              <Button
                variant="subtle"
                size="sm"
                onClick={() =>
                  setFixedDrafts((current) => [
                    ...current,
                    {
                      key: "",
                      minutes:
                        Number(durationsText.split(/[,\s]+/)[0]) ||
                        preferences.quickDurations[0] ||
                        15,
                      comment: "",
                    },
                  ])
                }
              >
                <Plus size={13} />
                Add fixed ticket
              </Button>
            </div>
          </section>

          <section
            id="settings-panel-connection"
            role="tabpanel"
            aria-labelledby="settings-tab-connection"
            className={tab === "connection" ? "pt-4" : "hidden"}
          >
            <SectionLabel>Connection</SectionLabel>
            <div className="mt-2 space-y-1 text-[11px]">
              <div className="flex justify-between gap-4">
                <span className="text-text-faint">Site</span>
                <span className="truncate text-text-muted">{connection.baseUrl}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-text-faint">Email</span>
                <span className="truncate text-text-muted">{connection.email}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-text-faint">Time zone</span>
                <span className="truncate text-text-muted">{connection.timeZone}</span>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              className="mt-3"
              onClick={() => setConfirmDisconnect(true)}
            >
              Disconnect Jira
            </Button>
          </section>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-[11px] leading-5 text-danger">
            {error}
          </p>
        ) : null}

        <div className={cn("mt-5 flex justify-end gap-2")}>
          <Button
            variant="ghost"
            onClick={closeSettings}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      </Modal>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Disconnect Jira?"
        description="The token and connection details will be removed from this browser. Pins and settings stay."
        confirmLabel="Disconnect"
        onConfirm={() => {
          setConfirmDisconnect(false);
          closeSettings();
          onDisconnect();
        }}
      />
    </>
  );
}

function TabButton({
  id,
  controls,
  active,
  onClick,
  children,
}: {
  id: string;
  controls: string;
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={cn(
        "relative -mb-px min-h-9 px-2.5 pb-2 text-[11.5px] transition-colors",
        active
          ? "text-text after:absolute after:inset-x-2 after:bottom-0 after:h-px after:bg-accent"
          : "text-text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

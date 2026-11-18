import * as Dialog from "@radix-ui/react-dialog";
import { formatInTimeZone } from "date-fns-tz";
import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  ApiClientError,
  createWorklog,
  deleteWorklog,
  errorMessage,
  getIssue,
  getWorklogSummary,
  searchJql,
} from "@/lib/api-client";
import {
  clearConnection,
  loadConnection,
  loadDaysOff,
  loadFavorites,
  loadFirstLoggedAt,
  markHasLogged,
  loadPreferences,
  saveConnection,
  saveDaysOff,
  saveFavorites,
  savePreferences,
} from "@/lib/storage";
import {
  addDays,
  buildSafeStarted,
  formatDayLong,
  formatWeekRange,
  isWeekend,
  startOfWeekForDate,
  startOfWeekInZone,
  todayInZone,
  weekDates,
  worklogDay,
  formatWorklogTime,
  rangeBounds,
} from "@/lib/datetime";
import { formatDuration } from "@/lib/duration";
import type {
  AppView,
  Connection,
  CreateWorklogInput,
  Favorites,
  FixedTicket,
  Preferences,
  SearchResponse,
  Ticket,
  WorklogEntry,
} from "@/lib/types";
import { isEditableTarget, isInteractiveTarget } from "@/lib/utils";
import BackfillDialog from "./BackfillDialog";
import BatchLogDialog from "./BatchLogDialog";
import ConnectScreen from "./ConnectScreen";
import CopyWeekDialog from "./CopyWeekDialog";
import DetailPanel from "./DetailPanel";
import SearchHeader from "./SearchHeader";
import SettingsDialog from "./SettingsDialog";
import Sidebar from "./Sidebar";
import TicketList from "./TicketList";
import TodayView from "./TodayView";
import WeekView from "./WeekView";
import { Button, ConfirmDialog } from "./ui";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function LoggerApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoggerAppInner />
    </QueryClientProvider>
  );
}

function LoggerAppInner() {
  const client = useQueryClient();
  const [connection, setConnection] = useState<Connection | null>(() =>
    loadConnection(),
  );
  const [preferences, setPreferences] = useState<Preferences>(() =>
    loadPreferences(),
  );
  const [favorites, setFavorites] = useState<Favorites>(() => loadFavorites());
  const [daysOff, setDaysOff] = useState<string[]>(() => loadDaysOff());
  const [firstLoggedAt, setFirstLoggedAt] = useState(() =>
    loadFirstLoggedAt(),
  );
  const [view, setView] = useState<AppView>("today");
  const [selectedWeekStart, setSelectedWeekStart] = useState("");
  const [backfillDate, setBackfillDate] = useState<string | null>(null);
  const [copyWeekOpen, setCopyWeekOpen] = useState(false);
  const [copyingWeek, setCopyingWeek] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batching, setBatching] = useState(false);
  const [activeJql, setActiveJql] = useState(() => loadPreferences().defaultJql);
  const [searchInput, setSearchInput] = useState(() => loadPreferences().defaultJql);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [cursorKey, setCursorKey] = useState<string | null>(null);
  const [presetSeconds, setPresetSeconds] = useState<number | undefined>(undefined);
  const [presetNonce, setPresetNonce] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<
    "defaults" | "fixed" | "connection"
  >("defaults");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WorklogEntry | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [isNarrow, setIsNarrow] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const navButtonRef = useRef<HTMLButtonElement>(null);
  const detailOriginRef = useRef<HTMLElement | null>(null);
  const quickLogLock = useRef(false);
  const lastUndoRef = useRef<(() => void) | null>(null);
  const undoExpiryRef = useRef<number | null>(null);
  const copyLockRef = useRef(false);
  const previousCurrentWeekStartRef = useRef("");
  const resetTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const closeAtDesktop = () => {
      if (media.matches) setMobileNavOpen(false);
    };
    closeAtDesktop();
    media.addEventListener("change", closeAtDesktop);
    return () => media.removeEventListener("change", closeAtDesktop);
  }, []);

  useEffect(() => {
    const tick = () => setClock(Date.now());
    const interval = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", tick);
    };
  }, []);

  useEffect(() => {
    if (!connection) return;
    let timer: number;

    const scheduleMidnight = () => {
      const now = Date.now();
      const date = formatInTimeZone(
        new Date(now),
        connection.timeZone,
        "yyyy-MM-dd",
      );
      const tomorrow = addDays(date, 1);
      const { fromMs } = rangeBounds(
        tomorrow,
        tomorrow,
        connection.timeZone,
      );
      const delay = Math.max(1000, fromMs + 1000 - now);
      timer = window.setTimeout(() => {
        setClock(Date.now());
        scheduleMidnight();
      }, delay);
    };

    scheduleMidnight();
    return () => window.clearTimeout(timer);
  }, [connection]);

  useEffect(() => {
    if (!connection) return;
    setActiveJql((current) => current || preferences.defaultJql);
    setSearchInput((current) => current || preferences.defaultJql);
  }, [connection, preferences.defaultJql]);

  useEffect(() => {
    if (!connection) return;
    setSelectedWeekStart(
      startOfWeekInZone(connection.timeZone, preferences.weekStart),
    );
  }, [connection, preferences.weekStart]);

  const searchQuery = useInfiniteQuery<
    SearchResponse,
    Error,
    InfiniteData<SearchResponse>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: ["search", connection?.accountId, activeJql],
    queryFn: ({ pageParam }) => searchJql(activeJql, pageParam || undefined),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken || undefined,
    enabled: Boolean(connection && activeJql),
    staleTime: 30_000,
  });

  const tickets = useMemo(() => {
    const seen = new Set<string>();
    const result: Ticket[] = [];
    for (const page of searchQuery.data?.pages ?? []) {
      for (const ticket of page.issues) {
        if (seen.has(ticket.key)) continue;
        seen.add(ticket.key);
        result.push(ticket);
      }
    }
    return result;
  }, [searchQuery.data]);

  useEffect(() => {
    const error = searchQuery.error;
    if (
      !(error instanceof ApiClientError) ||
      error.code !== "JIRA_VALIDATION" ||
      !/next page token|invalid or expired/i.test(error.message)
    ) {
      resetTokenRef.current = null;
      return;
    }
    const errorKey = `${activeJql}:${error.message}`;
    if (resetTokenRef.current === errorKey) return;
    resetTokenRef.current = errorKey;
    void client.resetQueries({
      queryKey: ["search", connection?.accountId, activeJql],
      exact: true,
    });
  }, [
    searchQuery.error,
    client,
    connection?.accountId,
    activeJql,
  ]);

  const favoriteKeys = useMemo(
    () =>
      Array.from(
        new Set([
          ...favorites.fixed.map((fixed) => fixed.key),
          ...favorites.pins,
        ]),
      ),
    [favorites.fixed, favorites.pins],
  );
  const favoriteJql = favoriteKeys.length
    ? `key in (${favoriteKeys.join(",")}) ORDER BY updated DESC`
    : "";

  const favoritesQuery = useQuery({
    queryKey: ["favorites", connection?.accountId, favoriteKeys],
    queryFn: () => searchJql(favoriteJql, undefined, 100),
    enabled: Boolean(connection && favoriteJql),
    staleTime: 60_000,
  });

  const favoriteTickets = useMemo(
    () => favoritesQuery.data?.issues ?? [],
    [favoritesQuery.data],
  );

  const ticketsByKey = useMemo(() => {
    const map = new Map<string, Ticket>();
    for (const ticket of favoriteTickets) map.set(ticket.key, ticket);
    for (const ticket of tickets) map.set(ticket.key, ticket);
    return map;
  }, [favoriteTickets, tickets]);

  const today = useMemo(
    () => (connection ? todayInZone(connection.timeZone) : ""),
    [connection, clock],
  );
  const currentWeekStart = useMemo(
    () =>
      connection
        ? startOfWeekInZone(connection.timeZone, preferences.weekStart)
        : "",
    [connection, preferences.weekStart, clock],
  );
  const currentWeekEnd = currentWeekStart
    ? addDays(currentWeekStart, 6)
    : "";

  useEffect(() => {
    if (!currentWeekStart) return;
    const previous = previousCurrentWeekStartRef.current;
    if (!previous) {
      previousCurrentWeekStartRef.current = currentWeekStart;
      return;
    }
    if (previous !== currentWeekStart) {
      setSelectedWeekStart((current) =>
        current === previous || !current ? currentWeekStart : current,
      );
      previousCurrentWeekStartRef.current = currentWeekStart;
    }
  }, [currentWeekStart]);
  const effectiveWeekStart = selectedWeekStart || currentWeekStart;
  const selectedWeekEnd = effectiveWeekStart
    ? addDays(effectiveWeekStart, 6)
    : "";
  const previousWeekStart = currentWeekStart
    ? addDays(currentWeekStart, -7)
    : "";
  const previousWeekEnd = currentWeekStart
    ? addDays(currentWeekStart, -1)
    : "";
  const copySourceStart = effectiveWeekStart
    ? addDays(effectiveWeekStart, -7)
    : "";
  const copySourceEnd = effectiveWeekStart
    ? addDays(effectiveWeekStart, -1)
    : "";
  const selectedSummaryQuery = useQuery({
    queryKey: [
      "summary",
      connection?.accountId,
      connection?.timeZone,
      effectiveWeekStart,
      selectedWeekEnd,
    ],
    queryFn: () =>
      getWorklogSummary(effectiveWeekStart, selectedWeekEnd, {
        timeZone: connection!.timeZone,
        accountId: connection!.accountId,
      }),
    enabled: Boolean(
      connection && effectiveWeekStart && selectedWeekEnd,
    ),
    staleTime: 30_000,
  });

  const currentSummaryQuery = useQuery({
    queryKey: [
      "summary",
      connection?.accountId,
      connection?.timeZone,
      currentWeekStart,
      currentWeekEnd,
    ],
    queryFn: () =>
      getWorklogSummary(currentWeekStart, currentWeekEnd, {
        timeZone: connection!.timeZone,
        accountId: connection!.accountId,
      }),
    enabled: Boolean(
      connection &&
        currentWeekStart &&
        currentWeekEnd &&
        currentWeekStart !== effectiveWeekStart,
    ),
    staleTime: 30_000,
  });

  const previousSummaryQuery = useQuery({
    queryKey: [
      "summary",
      connection?.accountId,
      connection?.timeZone,
      previousWeekStart,
      previousWeekEnd,
    ],
    queryFn: () =>
      getWorklogSummary(previousWeekStart, previousWeekEnd, {
        timeZone: connection!.timeZone,
        accountId: connection!.accountId,
      }),
    enabled: Boolean(
      connection &&
        previousWeekStart &&
        previousWeekEnd &&
        previousWeekStart !== effectiveWeekStart,
    ),
    staleTime: 60_000,
  });

  const copySourceQuery = useQuery({
    queryKey: [
      "summary",
      connection?.accountId,
      connection?.timeZone,
      copySourceStart,
      copySourceEnd,
    ],
    queryFn: () =>
      getWorklogSummary(copySourceStart, copySourceEnd, {
        timeZone: connection!.timeZone,
        accountId: connection!.accountId,
      }),
    enabled: Boolean(
      connection &&
        copyWeekOpen &&
        copySourceStart &&
        copySourceEnd,
    ),
    staleTime: 30_000,
  });

  const selectedSummary = selectedSummaryQuery.data;
  const currentSummary =
    effectiveWeekStart === currentWeekStart
      ? selectedSummary
      : currentSummaryQuery.data;
  const currentSummaryLoading =
    effectiveWeekStart === currentWeekStart
      ? selectedSummaryQuery.isPending
      : currentSummaryQuery.isPending;
  const currentSummaryError =
    effectiveWeekStart === currentWeekStart
      ? selectedSummaryQuery.error
      : currentSummaryQuery.error;
  const selectedSummaryError = selectedSummaryQuery.error;
  const backfillWeekStart = backfillDate
    ? startOfWeekForDate(backfillDate, preferences.weekStart)
    : effectiveWeekStart;
  const backfillWeekEnd = backfillWeekStart
    ? addDays(backfillWeekStart, 6)
    : "";
  const backfillSummary =
    backfillWeekStart === currentWeekStart
      ? currentSummary
      : selectedSummary;

  const searchTicket = selectedKey
    ? tickets.find((ticket) => ticket.key === selectedKey)
    : undefined;
  const favoriteTicket = selectedKey
    ? favoriteTickets.find((ticket) => ticket.key === selectedKey)
    : undefined;

  const issueQuery = useQuery({
    queryKey: ["issue", connection?.accountId, selectedKey],
    queryFn: () => getIssue(selectedKey!),
    enabled: Boolean(connection && selectedKey),
    staleTime: 30_000,
  });

  const selectedTicket =
    issueQuery.data?.issue ?? searchTicket ?? favoriteTicket;

  const createMutation = useMutation({
    mutationFn: (input: CreateWorklogInput) => createWorklog(input),
    onSuccess: () => {
      markLoggingActivity();
      void client.invalidateQueries({ queryKey: ["summary"] });
      void client.invalidateQueries({ queryKey: ["issue"] });
      void client.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const quickLogMutation = useMutation({
    mutationFn: (input: CreateWorklogInput) => createWorklog(input),
    onSuccess: () => {
      markLoggingActivity();
      void client.invalidateQueries({ queryKey: ["summary"] });
      void client.invalidateQueries({ queryKey: ["issue"] });
      void client.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (entry: WorklogEntry) => deleteWorklog(entry.issueKey, entry.id),
    onSuccess: () => {
      toast.success("Worklog deleted");
      setPendingDelete(null);
      void client.invalidateQueries({ queryKey: ["summary"] });
      void client.invalidateQueries({ queryKey: ["issue"] });
      void client.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });


  function markLoggingActivity() {
    markHasLogged();
    setFirstLoggedAt((current) => current ?? new Date().toISOString());
  }

  function clearUndoExpiry() {
    if (undoExpiryRef.current) {
      window.clearTimeout(undoExpiryRef.current);
      undoExpiryRef.current = null;
    }
  }

  function registerUndo(action: () => void) {
    clearUndoExpiry();
    lastUndoRef.current = action;
    undoExpiryRef.current = window.setTimeout(() => {
      if (lastUndoRef.current === action) {
        lastUndoRef.current = null;
      }
      undoExpiryRef.current = null;
    }, 10_000);
  }

  function performUndo() {
    const action = lastUndoRef.current;
    lastUndoRef.current = null;
    clearUndoExpiry();
    action?.();
  }

  async function undoEntries(
    entries: WorklogEntry[],
    adjustEstimate: "leave" | "auto",
  ) {
    lastUndoRef.current = null;
    clearUndoExpiry();
    const results = await Promise.allSettled(
      entries.map((entry) =>
        deleteWorklog(entry.issueKey, entry.id, adjustEstimate),
      ),
    );
    const removed = results.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const failed = entries.filter(
      (_, index) => results[index].status === "rejected",
    );

    if (removed > 0) {
      void client.invalidateQueries({ queryKey: ["summary"] });
      void client.invalidateQueries({ queryKey: ["issue"] });
      void client.invalidateQueries({ queryKey: ["favorites"] });
    }

    if (removed === 0) {
      const retry = () => void undoEntries(entries, adjustEstimate);
      registerUndo(retry);
      toast.error(
        "Could not remove the worklog. It may already be deleted.",
        { action: { label: "Retry", onClick: retry } },
      );
      return;
    }

    if (failed.length > 0) {
      const retry = () => void undoEntries(failed, adjustEstimate);
      registerUndo(retry);
      toast.message(
        `Removed ${removed}; ${failed.length} could not be removed.`,
        { action: { label: "Retry", onClick: retry } },
      );
      return;
    }

    toast.success(
      `Removed ${removed} ${removed === 1 ? "worklog" : "worklogs"}.`,
    );
  }

  const authError = [
    searchQuery.error,
    favoritesQuery.error,
    selectedSummaryQuery.error,
    currentSummaryQuery.error,
    previousSummaryQuery.error,
    issueQuery.error,
  ].some(
    (error) => error instanceof ApiClientError && error.code === "JIRA_AUTH",
  );

  const searchError =
    !authError && searchQuery.error ? errorMessage(searchQuery.error) : null;
  const favoriteError =
    !authError && favoritesQuery.error ? errorMessage(favoritesQuery.error) : null;
  const summaryError =
    !authError && currentSummaryError
      ? errorMessage(currentSummaryError)
      : null;
  const issueError =
    !authError && issueQuery.error ? errorMessage(issueQuery.error) : null;
  const selectedSummaryErrorMessage =
    !authError && selectedSummaryError
      ? errorMessage(selectedSummaryError)
      : null;
  const visibleSummaryError = authError
    ? "Jira token rejected."
    : summaryError;
  const visibleSelectedSummaryError = authError
    ? "Jira token rejected."
    : selectedSummaryErrorMessage;

  const previousWeekStats = useMemo(() => {
    if (!previousSummaryQuery.data || !previousWeekStart) {
      return { days: 0, seconds: 0 };
    }
    const target = preferences.targetMinutesPerDay * 60;
    if (target <= 0) return { days: 0, seconds: 0 };

    let days = 0;
    let seconds = 0;
    for (const date of weekDates(previousWeekStart)) {
      if (isWeekend(date) || daysOff.includes(date)) continue;
      const total = previousSummaryQuery.data.byDay[date] ?? 0;
      if (total < target) {
        days += 1;
        seconds += target - total;
      }
    }
    return { days, seconds };
  }, [
    previousSummaryQuery.data,
    previousWeekStart,
    preferences.targetMinutesPerDay,
    daysOff,
  ]);

  const previousWeekEnabled = Boolean(
    connection &&
      previousWeekStart &&
      previousWeekStart !== effectiveWeekStart,
  );
  const previousWeekCheckError =
    !authError && previousWeekEnabled && previousSummaryQuery.error
      ? errorMessage(previousSummaryQuery.error)
      : null;

  const firstLoggedDate = firstLoggedAt?.slice(0, 10);
  const firstUseBeforePreviousWeek = Boolean(
    firstLoggedDate &&
      previousWeekStart &&
      firstLoggedDate <= previousWeekStart,
  );
  const hasWorklogHistory =
    (previousSummaryQuery.data?.totalSeconds ?? 0) > 0 ||
    firstUseBeforePreviousWeek;
  const visibleLastWeekUnderTarget = hasWorklogHistory
    ? previousWeekStats.days
    : 0;
  const visibleLastWeekShortSeconds = hasWorklogHistory
    ? previousWeekStats.seconds
    : 0;

  const batchSuggestions = useMemo(() => {
    if (!connection) return [];
    const suggestions = new Map<
      string,
      { key: string; summary?: string; minutes?: number; comment?: string }
    >();
    const loggedToday = new Set(
      (currentSummary?.entries ?? [])
        .filter(
          (entry) => worklogDay(entry.started, connection!.timeZone) === today,
        )
        .map((entry) => entry.issueKey),
    );

    for (const fixed of favorites.fixed) {
      if (loggedToday.has(fixed.key)) continue;
      suggestions.set(fixed.key, {
        key: fixed.key,
        summary: ticketsByKey.get(fixed.key)?.summary,
        minutes: fixed.minutes,
        comment: fixed.comment,
      });
    }
    for (const key of favorites.pins) {
      if (suggestions.has(key) || loggedToday.has(key)) continue;
      suggestions.set(key, {
        key,
        summary: ticketsByKey.get(key)?.summary,
      });
    }
    for (const entry of currentSummary?.entries ?? []) {
      if (
        suggestions.has(entry.issueKey) ||
        loggedToday.has(entry.issueKey)
      ) {
        continue;
      }
      suggestions.set(entry.issueKey, {
        key: entry.issueKey,
        summary: entry.issueSummary,
      });
      if (suggestions.size >= 10) break;
    }
    return Array.from(suggestions.values());
  }, [
    favorites.fixed,
    favorites.pins,
    ticketsByKey,
    currentSummary,
    connection,
    today,
  ]);

  const backfillSuggestions = useMemo(() => {
    const suggestions = new Map<
      string,
      { key: string; summary?: string; minutes?: number; comment?: string }
    >();
    for (const fixed of favorites.fixed) {
      suggestions.set(fixed.key, {
        key: fixed.key,
        summary: ticketsByKey.get(fixed.key)?.summary,
        minutes: fixed.minutes,
        comment: fixed.comment,
      });
    }
    for (const key of favorites.pins) {
      suggestions.set(key, {
        key,
        summary: ticketsByKey.get(key)?.summary,
      });
    }
    for (const entry of selectedSummary?.entries ?? []) {
      if (!suggestions.has(entry.issueKey)) {
        suggestions.set(entry.issueKey, {
          key: entry.issueKey,
          summary: entry.issueSummary,
        });
      }
    }
    for (const entry of currentSummary?.entries ?? []) {
      if (!suggestions.has(entry.issueKey)) {
        suggestions.set(entry.issueKey, {
          key: entry.issueKey,
          summary: entry.issueSummary,
        });
      }
    }
    return Array.from(suggestions.values());
  }, [
    favorites.fixed,
    favorites.pins,
    ticketsByKey,
    selectedSummary,
    currentSummary,
  ]);

  function handleConnect(next: Connection) {
    saveConnection(next);
    setConnection(next);
    const storedPreferences = loadPreferences();
    setPreferences(storedPreferences);
    setFavorites(loadFavorites());
    setDaysOff(loadDaysOff());
    setView("today");
    setActiveJql(storedPreferences.defaultJql);
    setSearchInput(storedPreferences.defaultJql);
    setSelectedKey(null);
    setPresetSeconds(undefined);
    toast.success("Connected to Jira");
  }

  function handleDisconnect() {
    clearConnection();
    client.clear();
    setConnection(null);
    setSelectedKey(null);
    setPresetSeconds(undefined);
    setSettingsOpen(false);
    setView("today");
  }

  function runSearch(jql?: string) {
    if (!connection) return;
    setCursorKey(null);
    let next = (jql ?? searchInput).trim() || preferences.defaultJql;
    const keyMatch = next.match(/^[A-Z][A-Z0-9_]+-\d+$/i);
    if (keyMatch) {
      next = `key = ${keyMatch[0].toUpperCase()}`;
    } else if (
      !/[=~<>]|\b[A-Za-z_][\w.]*\s+in\s*\(/i.test(next)
    ) {
      next = `text ~ "${next.replace(/"/g, '\\"')}"`;
    }
    setSearchInput(next);
    setView("search");
    setMobileNavOpen(false);
    if (next === activeJql) {
      void searchQuery.refetch();
    } else {
      setActiveJql(next);
    }
  }

  useEffect(() => {
    if (view !== "search") setCursorKey(null);
  }, [view]);

  useEffect(() => {
    if (cursorKey && !tickets.some((ticket) => ticket.key === cursorKey)) {
      setCursorKey(null);
    }
  }, [tickets, cursorKey]);

  function handleSelect(key: string) {
    detailOriginRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setCursorKey(key);
    setSelectedKey(key);
    setPresetSeconds(undefined);
    setPresetNonce((value) => value + 1);
    setMobileNavOpen(false);
  }

  async function handleQuickLog(
    key: string,
    seconds: number,
    comment?: string,
  ) {
    if (!connection || quickLogLock.current || quickLogMutation.isPending) {
      return;
    }
    setMobileNavOpen(false);
    quickLogLock.current = true;
    try {
      const actionToday = todayInZone(connection.timeZone);
      const { fromMs } = rangeBounds(
        actionToday,
        actionToday,
        connection.timeZone,
      );
      const elapsedMs = Date.now() - fromMs;
      if (seconds * 1000 > elapsedMs) {
        toast.error(
          `Only ${formatDuration(Math.max(0, elapsedMs / 1000))} has elapsed today. Use Log ticket for a past date or a shorter duration.`,
        );
        return;
      }
      const startMs = Date.now() - seconds * 1000;
      const started = buildSafeStarted(
        actionToday,
        formatInTimeZone(new Date(startMs), connection.timeZone, "HH:mm"),
        connection.timeZone,
      );
      const entry = await quickLogMutation.mutateAsync({
        issueKey: key,
        seconds,
        started,
        comment: comment?.trim() || undefined,
        adjustEstimate: preferences.adjustEstimate,
        notifyWatchers: preferences.notifyWatchers,
      });
      const undo = () => {
        if (lastUndoRef.current === undo) lastUndoRef.current = null;
        clearUndoExpiry();
        void undoEntries([entry], preferences.adjustEstimate);
      };
      registerUndo(undo);
      toast.success(`Logged ${formatDuration(seconds)} on ${key}`, {
        action: {
          label: "Undo",
          onClick: undo,
        },
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      quickLogLock.current = false;
    }
  }

  function handleChangeView(nextView: AppView) {
    setView(nextView);
    setMobileNavOpen(false);
  }

  function handlePrevWeek() {
    setSelectedWeekStart((current) =>
      addDays(current || currentWeekStart, -7),
    );
  }

  function handleNextWeek() {
    setSelectedWeekStart((current) => {
      const value = current || currentWeekStart;
      if (value >= currentWeekStart) return value;
      return addDays(value, 7);
    });
  }

  function handleThisWeek() {
    setSelectedWeekStart(currentWeekStart);
  }

  function handleOpenCurrentWeek() {
    setSelectedWeekStart(currentWeekStart);
    setView("week");
  }

  function handleReviewLastWeek() {
    setSelectedWeekStart(previousWeekStart);
    setView("week");
    setMobileNavOpen(false);
  }

  function handleBackfill(date: string) {
    setBackfillDate(date);
  }

  async function handleBackfillLog(input: CreateWorklogInput) {
    const entry = await createMutation.mutateAsync(input);
    const date = worklogDay(input.started, connection!.timeZone);
    if (view !== "today" || date !== today) {
      setSelectedWeekStart(startOfWeekForDate(date, preferences.weekStart));
      setView("week");
      window.setTimeout(() => {
        document.getElementById("week-heading")?.focus();
      }, 200);
    }
    const undo = () => {
      if (lastUndoRef.current === undo) lastUndoRef.current = null;
      void undoEntries([entry], preferences.adjustEstimate);
    };
    lastUndoRef.current = undo;
    toast.success(
      `Logged ${formatDuration(input.seconds)} on ${input.issueKey}`,
      {
        action: {
          label: "Undo",
          onClick: undo,
        },
      },
    );
  }

  async function handleBatchLog(inputs: CreateWorklogInput[]) {
    if (!connection) return;
    setBatching(true);
    let copied = 0;
    let failed = 0;
    const created: WorklogEntry[] = [];

    try {
      const totalSeconds = inputs.reduce(
        (total, input) => total + input.seconds,
        0,
      );
      const actionToday = todayInZone(connection.timeZone);
      const { fromMs } = rangeBounds(
        actionToday,
        actionToday,
        connection.timeZone,
      );
      const elapsedMs = Date.now() - fromMs;
      if (totalSeconds * 1000 > elapsedMs) {
        throw new Error(
          "Total time exceeds what has elapsed today. Use Backfill for past dates or shorten the durations.",
        );
      }
      let cursor = Date.now() - totalSeconds * 1000;

      for (const input of inputs) {
        try {
          const started = buildSafeStarted(
            actionToday,
            formatInTimeZone(new Date(cursor), connection.timeZone, "HH:mm"),
            connection.timeZone,
          );
          const entry = await createWorklog({ ...input, started });
          created.push(entry);
          cursor += input.seconds * 1000;
          copied += 1;
        } catch {
          failed += 1;
        }
      }

      void client.invalidateQueries({ queryKey: ["summary"] });
      void client.invalidateQueries({ queryKey: ["issue"] });
      void client.invalidateQueries({ queryKey: ["favorites"] });
      if (copied > 0) {
        markLoggingActivity();
      }

      if (copied > 0) {
        const undo = () => {
          if (lastUndoRef.current === undo) lastUndoRef.current = null;
          void undoEntries(created, preferences.adjustEstimate);
        };
        registerUndo(undo);
        toast.success(
          `Logged ${copied} ${copied === 1 ? "entry" : "entries"}.`,
          { action: { label: "Undo", onClick: undo } },
        );
        setBatchOpen(false);
      }
      if (failed > 0) {
        toast.message(`${failed} ${failed === 1 ? "entry" : "entries"} failed.`);
      }
      if (copied === 0) {
        throw new Error("Could not log any entries.");
      }
    } finally {
      setBatching(false);
    }
  }

  async function handleCopyWeek(entries: WorklogEntry[]) {
    if (!connection || copyLockRef.current) return;
    if (
      !selectedSummary ||
      selectedSummaryQuery.isPending ||
      selectedSummaryQuery.error
    ) {
      toast.error("Wait for this week’s totals before copying.");
      return;
    }
    copyLockRef.current = true;
    setCopyingWeek(true);
    const actionToday = todayInZone(connection.timeZone);
    let copied = 0;
    let failed = 0;
    let skipped = 0;
    const created: WorklogEntry[] = [];
    const existing = new Set(
      (selectedSummary?.entries ?? []).map(
        (entry) =>
          `${entry.issueKey}|${worklogDay(entry.started, connection.timeZone)}|${entry.seconds}|${entry.comment ?? ""}`,
      ),
    );

    try {
      for (const entry of entries) {
        const sourceDay = worklogDay(entry.started, connection.timeZone);
        const targetDate = addDays(sourceDay, 7);
        const sourceTime = formatWorklogTime(
          entry.started,
          connection.timeZone,
        );
        if (
          targetDate > actionToday ||
          (targetDate === actionToday &&
            sourceTime >
              formatInTimeZone(
                new Date(),
                connection.timeZone,
                "HH:mm",
              ))
        ) {
          skipped += 1;
          continue;
        }
        const duplicateKey = `${entry.issueKey}|${targetDate}|${entry.seconds}|${entry.comment ?? ""}`;
        if (existing.has(duplicateKey)) {
          skipped += 1;
          continue;
        }
        try {
          const started = buildSafeStarted(
            targetDate,
            formatWorklogTime(entry.started, connection.timeZone),
            connection.timeZone,
          );
          const createdEntry = await createWorklog({
            issueKey: entry.issueKey,
            seconds: entry.seconds,
            started,
            comment: entry.comment,
            adjustEstimate: preferences.adjustEstimate,
            notifyWatchers: preferences.notifyWatchers,
          });
          created.push(createdEntry);
          existing.add(duplicateKey);
          copied += 1;
        } catch {
          failed += 1;
        }
      }

      void client.invalidateQueries({ queryKey: ["summary"] });
      void client.invalidateQueries({ queryKey: ["issue"] });
      void client.invalidateQueries({ queryKey: ["favorites"] });
      if (created.length > 0) {
        markLoggingActivity();
      }

      const undo = () => {
        if (lastUndoRef.current === undo) lastUndoRef.current = null;
        void undoEntries(created, preferences.adjustEstimate);
      };
      if (created.length > 0) {
        registerUndo(undo);
      }
      if (failed > 0 || skipped > 0) {
        toast.message(
          `Copied ${copied}. ${failed} failed${skipped ? `, ${skipped} skipped (future/duplicate)` : ""}.`,
          created.length > 0
            ? { action: { label: "Undo", onClick: undo } }
            : undefined,
        );
      } else {
        toast.success(
          `Copied ${copied} ${copied === 1 ? "entry" : "entries"} into this week.`,
          created.length > 0
            ? { action: { label: "Undo", onClick: undo } }
            : undefined,
        );
      }
      if (copied > 0) {
        setCopyWeekOpen(false);
      } else {
        toast.error("No entries were copied.");
      }
    } finally {
      copyLockRef.current = false;
      setCopyingWeek(false);
    }
  }

  function handleToggleDayOff(date: string) {
    const wasOff = daysOff.includes(date);
    if (!wasOff && (selectedSummary?.byDay[date] ?? 0) > 0) {
      toast.error(
        "Remove logged time before marking this day off.",
      );
      return;
    }

    const apply = (value: boolean) => {
      setDaysOff((current) => {
        const next = value
          ? Array.from(new Set([...current, date]))
          : current.filter((item) => item !== date);
        saveDaysOff(next);
        return next;
      });
    };

    apply(!wasOff);
    const undo = () => {
      if (lastUndoRef.current === undo) lastUndoRef.current = null;
      clearUndoExpiry();
      apply(wasOff);
      toast.success(
        `${formatDayLong(date)} ${wasOff ? "is a day off again" : "is no longer a day off"}`,
      );
    };
    registerUndo(undo);
    toast.success(
      `${formatDayLong(date)} ${wasOff ? "is no longer a day off" : "marked as day off"}`,
      { action: { label: "Undo", onClick: undo } },
    );
  }

  function closeDetail() {
    const closingKey = selectedKey;
    setSelectedKey(null);
    setPresetSeconds(undefined);
    if (!closingKey) return;
    const origin = detailOriginRef.current;
    detailOriginRef.current = null;
    requestAnimationFrame(() => {
      const isVisible = (element: HTMLElement | null): element is HTMLElement =>
        Boolean(element?.isConnected && element.getClientRects().length);

      const candidates = [
        origin,
        document.querySelector<HTMLElement>(
          `main [data-ticket-key="${closingKey}"] button`,
        ),
        document.querySelector<HTMLElement>(
          `[data-ticket-key="${closingKey}"] button`,
        ),
      ];
      const target = candidates.find(isVisible);
      if (target) {
        target.focus();
        return;
      }
      const navigation = document.querySelector<HTMLElement>(
        'button[aria-label="Open navigation"]',
      );
      if (isVisible(navigation)) {
        navigation.focus();
        return;
      }
      const main = document.getElementById("main-content");
      if (isVisible(main)) main.focus();
    });
  }

  function togglePin(key: string) {
    const isPinned = favorites.pins.includes(key);
    if (
      !isPinned &&
      favorites.fixed.some((fixed) => fixed.key === key)
    ) {
      toast.message(`${key} is already a fixed ticket.`);
      return;
    }
    setFavorites((current) => {
      const pinned = current.pins.includes(key);
      const next: Favorites = {
        ...current,
        pins: pinned
          ? current.pins.filter((item) => item !== key)
          : [...current.pins, key],
      };
      saveFavorites(next);
      return next;
    });
  }

  function handleSaveSettings(
    nextPreferences: Preferences,
    fixedTickets: FixedTicket[],
  ) {
    setActiveJql((current) =>
      current === preferences.defaultJql ? nextPreferences.defaultJql : current,
    );
    setSearchInput((current) =>
      current === preferences.defaultJql ? nextPreferences.defaultJql : current,
    );
    setPreferences(nextPreferences);
    savePreferences(nextPreferences);
    setFavorites((current) => {
      const next: Favorites = { ...current, fixed: fixedTickets };
      saveFavorites(next);
      return next;
    });
    toast.success("Settings saved");
  }

  function openSettings(tab: "defaults" | "fixed" | "connection" = "defaults") {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }

  function handleReconnect() {
    clearConnection();
    client.clear();
    setConnection(null);
    setSelectedKey(null);
    setPresetSeconds(undefined);
    setView("today");
  }

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented) return;

      if (isEditableTarget(event.target)) {
        if (event.key === "Escape") {
          const target = event.target as HTMLElement;
          const inDetail = Boolean(target.closest("#ticket-detail"));
          const dialog = target.closest<HTMLElement>('[role="dialog"]');
          target.blur();
          if (inDetail) {
            document
              .querySelector<HTMLElement>(
                'button[aria-label="Close ticket detail"]',
              )
              ?.focus();
          } else if (dialog) {
            dialog
              .querySelector<HTMLElement>(
                'button[aria-label="Close dialog"]',
              )
              ?.focus();
          }
        }
        return;
      }

      if (
        settingsOpen ||
        pendingDelete ||
        mobileNavOpen ||
        backfillDate ||
        copyWeekOpen ||
        batchOpen
      ) {
        return;
      }

      if (event.key === "Escape") {
        if (selectedKey) closeDetail();
        return;
      }

      if (selectedKey && isNarrow) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        setView("search");
        requestAnimationFrame(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        });
        return;
      }

      if (event.key === "t") {
        event.preventDefault();
        setView("today");
        return;
      }

      if (event.key === "w") {
        event.preventDefault();
        setView("week");
        return;
      }

      if (event.key === "f" && view === "today") {
        event.preventDefault();
        setBatchOpen(true);
        return;
      }

      if (event.key === "p") {
        const pinKey =
          selectedKey ?? (view === "search" ? cursorKey : null);
        if (pinKey) {
          event.preventDefault();
          togglePin(pinKey);
          return;
        }
      }

      if (
        event.key === "Enter" &&
        view === "search" &&
        cursorKey &&
        !isInteractiveTarget(event.target)
      ) {
        event.preventDefault();
        handleSelect(cursorKey);
        return;
      }

      if (event.key === "u" && lastUndoRef.current) {
        event.preventDefault();
        performUndo();
        return;
      }

      if (event.key === "l" && selectedKey) {
        event.preventDefault();
        const duration = document.querySelector<HTMLInputElement>(
          'input[aria-label="Duration"]',
        );
        duration?.focus();
        duration?.select();
        return;
      }

      if (
        view === "search" &&
        (event.key === "j" || event.key === "k") &&
        tickets.length > 0
      ) {
        event.preventDefault();
        const index = cursorKey
          ? tickets.findIndex((ticket) => ticket.key === cursorKey)
          : -1;
        const nextIndex =
          event.key === "j"
            ? Math.min(index + 1, tickets.length - 1)
            : Math.max(index - 1, 0);
        const next = tickets[nextIndex];
        if (!next) return;
        setCursorKey(next.key);
        requestAnimationFrame(() => {
          document
            .querySelector(`main [data-ticket-key="${next.key}"]`)
            ?.scrollIntoView({ block: "nearest" });
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    tickets,
    selectedKey,
    cursorKey,
    settingsOpen,
    pendingDelete,
    mobileNavOpen,
    backfillDate,
    copyWeekOpen,
    batchOpen,
    favorites.pins,
    closeDetail,
    view,
    isNarrow,
  ]);

  if (!connection) {
    return (
      <>
        <ConnectScreen onConnect={handleConnect} />
        <Toaster
          theme="dark"
          position="bottom-left"
          closeButton={false}
          duration={10_000}
        />
      </>
    );
  }

  const searchInitialLoading = searchQuery.isPending;
  const searchRefreshing =
    searchQuery.isFetching &&
    !searchQuery.isFetchingNextPage &&
    !searchInitialLoading;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:border focus:border-border-strong focus:bg-bg-raised focus:px-3 focus:py-2 focus:text-[12px] focus:text-text"
      >
        Skip to main content
      </a>
      <p className="sr-only" role="status" aria-live="polite">
        {selectedKey ? `Ticket ${selectedKey} detail open` : ""}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {view === "search" && cursorKey ? `Selected ticket ${cursorKey}` : ""}
      </p>
      <div
        className="flex min-w-0 flex-1"
        inert={selectedKey && isNarrow ? true : undefined}
      >
      <Sidebar
        connection={connection}
        preferences={preferences}
        favorites={favorites}
        ticketsByKey={ticketsByKey}
        summary={currentSummary}
        summaryLoading={currentSummaryLoading}
        summaryError={visibleSummaryError}
        today={today}
        activeJql={activeJql}
        view={view}
        lastWeekUnderTarget={visibleLastWeekUnderTarget}
        onSelect={handleSelect}
        onQuickLog={handleQuickLog}
        onUnpin={togglePin}
        onView={runSearch}
        onChangeView={handleChangeView}
        onReviewLastWeek={handleReviewLastWeek}
        onOpenSettings={() => openSettings()}
        onOpenFixedSettings={() => openSettings("fixed")}
        onRetrySummary={() => void client.invalidateQueries({ queryKey: ["summary"] })}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col"
      >
        {authError ? (
          <div className="flex items-center justify-between gap-3 border-b border-danger/20 bg-danger/5 px-4 py-2 md:px-5">
            <p className="text-[11px] leading-5 text-danger">
              Jira rejected the saved token. Reconnect with a fresh API token.
            </p>
            <Button variant="subtle" size="sm" onClick={handleReconnect}>
              Reconnect
            </Button>
          </div>
        ) : null}

        {favoriteError && favoriteKeys.length > 0 ? (
          <div className="border-b border-warning/20 bg-warning/5 px-4 py-1.5 text-[10.5px] text-warning md:px-5">
            Could not refresh pinned tickets: {favoriteError}
          </div>
        ) : null}

        {view === "search" ? (
          <>
            <SearchHeader
              ref={searchRef}
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={() => runSearch()}
              loading={searchInitialLoading || searchRefreshing}
              count={tickets.length}
              error={searchError}
              warning={searchQuery.data?.pages.at(-1)?.warningMessages?.[0] ?? null}
              onOpenSettings={() => openSettings()}
              onOpenNav={() => setMobileNavOpen(true)}
              navOpen={mobileNavOpen}
              navButtonRef={navButtonRef}
            />
            <TicketList
              tickets={tickets}
              selectedKey={cursorKey}
              expandedKey={selectedKey}
              pins={new Set(favorites.pins)}
              loading={searchInitialLoading}
              loadingMore={searchQuery.isFetchingNextPage}
              failed={Boolean(searchQuery.error)}
              hasMore={Boolean(searchQuery.hasNextPage)}
              onSelect={handleSelect}
              onTogglePin={togglePin}
              onLoadMore={() => void searchQuery.fetchNextPage()}
              onRetry={() => void searchQuery.refetch()}
              onReset={() => runSearch(preferences.defaultJql)}
            />
          </>
        ) : null}

        {view === "today" ? (
          <TodayView
            connection={connection}
            preferences={preferences}
            favorites={favorites}
            ticketsByKey={ticketsByKey}
            summary={currentSummary}
            loading={currentSummaryLoading}
            error={visibleSummaryError}
            today={today}
            daysOff={daysOff}
            isQuickLogging={quickLogMutation.isPending}
            onQuickLog={handleQuickLog}
            onOpenTicket={handleSelect}
            onOpenWeek={handleOpenCurrentWeek}
            onOpenSearch={() => setView("search")}
            onOpenBatch={() => setBatchOpen(true)}
            onOpenAdHoc={() => setBackfillDate(today)}
            onOpenSettings={() => openSettings()}
            onOpenFixedSettings={() => openSettings("fixed")}
            onOpenNav={() => setMobileNavOpen(true)}
            navOpen={mobileNavOpen}
            navButtonRef={navButtonRef}
            lastWeekUnderTarget={visibleLastWeekUnderTarget}
            lastWeekShortSeconds={visibleLastWeekShortSeconds}
            previousWeekError={previousWeekCheckError}
            onReviewLastWeek={handleReviewLastWeek}
            onRetryLastWeek={() => void previousSummaryQuery.refetch()}
            onDeleteEntry={setPendingDelete}
            onRetry={() =>
              void client.invalidateQueries({ queryKey: ["summary"] })
            }
          />
        ) : null}

        {view === "week" ? (
          <WeekView
            connection={connection}
            preferences={preferences}
            weekStart={effectiveWeekStart}
            weekEnd={selectedWeekEnd}
            currentWeekStart={currentWeekStart}
            today={today}
            summary={selectedSummary}
            loading={selectedSummaryQuery.isPending}
            error={visibleSelectedSummaryError}
            daysOff={daysOff}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
            onThisWeek={handleThisWeek}
            onBackfill={handleBackfill}
            onToggleDayOff={handleToggleDayOff}
            onCopyPreviousWeek={() => setCopyWeekOpen(true)}
            onDeleteEntry={setPendingDelete}
            onOpenSearch={() => setView("search")}
            onOpenSettings={() => openSettings()}
            onOpenNav={() => setMobileNavOpen(true)}
            navOpen={mobileNavOpen}
            navButtonRef={navButtonRef}
            onRetry={() => void selectedSummaryQuery.refetch()}
          />
        ) : null}
      </main>
      </div>

      <Dialog.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim md:hidden" />
          <Dialog.Content
            className="fixed inset-y-0 left-0 z-50 w-[264px] border-r border-border bg-bg-raised focus:outline-none md:hidden"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (navButtonRef.current?.getClientRects().length) {
                navButtonRef.current.focus();
              } else {
                searchRef.current?.focus();
              }
            }}
          >
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">
              Pinned tickets, fixed tickets, views, and settings.
            </Dialog.Description>
            <Sidebar
              connection={connection}
              preferences={preferences}
              favorites={favorites}
              ticketsByKey={ticketsByKey}
              summary={currentSummary}
              summaryLoading={currentSummaryLoading}
              summaryError={visibleSummaryError}
              today={today}
              activeJql={activeJql}
              view={view}
              lastWeekUnderTarget={visibleLastWeekUnderTarget}
              onSelect={handleSelect}
              onQuickLog={handleQuickLog}
              onUnpin={togglePin}
              onView={(jql) => {
                setMobileNavOpen(false);
                runSearch(jql);
              }}
              onChangeView={handleChangeView}
              onReviewLastWeek={handleReviewLastWeek}
              onOpenSettings={() => {
                setMobileNavOpen(false);
                openSettings();
              }}
              onOpenFixedSettings={() => {
                setMobileNavOpen(false);
                openSettings("fixed");
              }}
              onRetrySummary={() =>
                void client.invalidateQueries({ queryKey: ["summary"] })
              }
              mobile
              onCloseMobile={() => setMobileNavOpen(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {selectedKey ? (
        <DetailPanel
          ticketKey={selectedKey}
          ticket={selectedTicket}
          loading={issueQuery.isFetching && !selectedTicket}
          error={!selectedTicket ? issueError : null}
          summary={currentSummary}
          summaryLoading={currentSummaryLoading}
          summaryError={visibleSummaryError}
          today={today}
          weekStart={currentWeekStart}
          preferences={preferences}
          connection={connection}
          pinned={favorites.pins.includes(selectedKey)}
          isSubmitting={createMutation.isPending}
          presetSeconds={presetSeconds}
          presetNonce={presetNonce}
          onClose={closeDetail}
          onTogglePin={() => togglePin(selectedKey)}
          onCreate={async (input) => {
            const entry = await createMutation.mutateAsync(input);
            const undo = () => {
              if (lastUndoRef.current === undo) lastUndoRef.current = null;
              void undoEntries([entry], input.adjustEstimate ?? "leave");
            };
            registerUndo(undo);
            toast.success("Worklog added", {
              action: { label: "Undo", onClick: undo },
            });
          }}
          onRequestDelete={setPendingDelete}
          onRetry={() => void issueQuery.refetch()}
          onRetrySummary={() =>
            void client.invalidateQueries({ queryKey: ["summary"] })
          }
        />
      ) : null}

      {batchOpen ? (
        <BatchLogDialog
          open
          onOpenChange={(open) => {
            if (!open) setBatchOpen(false);
          }}
          preferences={preferences}
          today={today}
          suggestions={batchSuggestions}
          isSubmitting={batching}
          onSubmit={handleBatchLog}
        />
      ) : null}

      {copyWeekOpen ? (
        <CopyWeekDialog
          open
          onOpenChange={(open) => {
            if (!open) setCopyWeekOpen(false);
          }}
          connection={connection}
          today={today}
          sourceWeekLabel={formatWeekRange(copySourceStart, copySourceEnd)}
          targetWeekLabel={formatWeekRange(effectiveWeekStart, selectedWeekEnd)}
          sourceSummary={copySourceQuery.data}
          loading={copySourceQuery.isPending}
          error={
            copySourceQuery.error ? errorMessage(copySourceQuery.error) : null
          }
          isSubmitting={copyingWeek}
          onRetry={() => void copySourceQuery.refetch()}
          onCopy={handleCopyWeek}
        />
      ) : null}

      {backfillDate ? (
        <BackfillDialog
          open
          onOpenChange={(open) => {
            if (!open) setBackfillDate(null);
          }}
          initialDate={backfillDate}
          weekLabel={formatWeekRange(backfillWeekStart, backfillWeekEnd)}
          weekStart={backfillWeekStart}
          weekEnd={backfillWeekEnd}
          dayTotalSeconds={backfillSummary?.byDay[backfillDate] ?? 0}
          dayTotals={backfillSummary?.byDay}
          targetSeconds={preferences.targetMinutesPerDay * 60}
          daysOff={daysOff}
          connection={connection}
          preferences={preferences}
          suggestions={backfillSuggestions}
          isSubmitting={createMutation.isPending}
          onLog={handleBackfillLog}
        />
      ) : null}

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        preferences={preferences}
        favorites={favorites}
        connection={connection}
        initialTab={settingsTab}
        onSave={handleSaveSettings}
        onDisconnect={handleDisconnect}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete worklog?"
        description={
          pendingDelete
            ? `${formatDuration(pendingDelete.seconds)} on ${pendingDelete.issueKey} will be removed from Jira. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete worklog"
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete);
        }}
      />

      <Toaster
        theme="dark"
        position="bottom-left"
        closeButton={false}
        duration={10_000}
      />
    </div>
  );
}

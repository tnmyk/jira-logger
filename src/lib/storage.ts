import type { Connection, Favorites, FixedTicket, Preferences } from "./types";

const CONNECTION_KEY = "jira-logger.connection.v1";
const PREFERENCES_KEY = "jira-logger.preferences.v1";
const FAVORITES_KEY = "jira-logger.favorites.v1";
const DAYS_OFF_KEY = "jira-logger.days-off.v1";
const FIRST_LOGGED_KEY = "jira-logger.first-logged-at.v1";

export const DEFAULT_JQL =
  "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";

export const DEFAULT_PREFERENCES: Preferences = {
  defaultJql: DEFAULT_JQL,
  startTime: "09:00",
  quickDurations: [15, 30, 60, 120, 480],
  weekStart: "monday",
  adjustEstimate: "auto",
  notifyWatchers: false,
  targetMinutesPerDay: 480,
  showWeekends: false,
  defaultDurationMinutes: 0,
  defaultComment: "",
};

export const EMPTY_FAVORITES: Favorites = {
  pins: [],
  fixed: [],
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readJson<T>(key: string): T | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be full or blocked. The UI keeps working in memory.
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function loadConnection(): Connection | null {
  const value = readJson<Partial<Connection>>(CONNECTION_KEY);
  if (
    !value ||
    typeof value.baseUrl !== "string" ||
    typeof value.email !== "string" ||
    typeof value.token !== "string" ||
    typeof value.accountId !== "string" ||
    typeof value.displayName !== "string" ||
    typeof value.timeZone !== "string"
  ) {
    return null;
  }

  return {
    baseUrl: value.baseUrl,
    deployment: "cloud",
    email: value.email,
    token: value.token,
    accountId: value.accountId,
    displayName: value.displayName,
    timeZone: value.timeZone,
  };
}

export function saveConnection(connection: Connection): void {
  writeJson(CONNECTION_KEY, connection);
}

export function clearConnection(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(CONNECTION_KEY);
}

export function loadPreferences(): Preferences {
  const value = readJson<Partial<Preferences>>(PREFERENCES_KEY);
  if (!value) return { ...DEFAULT_PREFERENCES };

  return {
    defaultJql:
      typeof value.defaultJql === "string" && value.defaultJql.trim()
        ? value.defaultJql
        : DEFAULT_PREFERENCES.defaultJql,
    startTime:
      typeof value.startTime === "string" && /^\d{2}:\d{2}$/.test(value.startTime)
        ? value.startTime
        : DEFAULT_PREFERENCES.startTime,
    quickDurations: Array.isArray(value.quickDurations)
      ? value.quickDurations
          .filter((item): item is number => Number.isFinite(item) && item > 0 && item <= 1440)
          .slice(0, 8)
      : [...DEFAULT_PREFERENCES.quickDurations],
    weekStart: value.weekStart === "sunday" ? "sunday" : "monday",
    adjustEstimate: value.adjustEstimate === "leave" ? "leave" : "auto",
    notifyWatchers: value.notifyWatchers === true,
    targetMinutesPerDay:
      typeof value.targetMinutesPerDay === "number" &&
      Number.isFinite(value.targetMinutesPerDay) &&
      value.targetMinutesPerDay >= 0 &&
      value.targetMinutesPerDay <= 1440
        ? value.targetMinutesPerDay
        : DEFAULT_PREFERENCES.targetMinutesPerDay,
    showWeekends: value.showWeekends === true,
    defaultDurationMinutes:
      typeof value.defaultDurationMinutes === "number" &&
      Number.isFinite(value.defaultDurationMinutes) &&
      value.defaultDurationMinutes >= 0 &&
      value.defaultDurationMinutes <= 1440
        ? value.defaultDurationMinutes
        : DEFAULT_PREFERENCES.defaultDurationMinutes,
    defaultComment:
      typeof value.defaultComment === "string"
        ? value.defaultComment
        : DEFAULT_PREFERENCES.defaultComment,
  };
}

export function savePreferences(preferences: Preferences): void {
  writeJson(PREFERENCES_KEY, preferences);
}

export function loadFavorites(): Favorites {
  const value = readJson<{
    pins?: unknown;
    fixed?: unknown;
  }>(FAVORITES_KEY);
  if (!value) return { ...EMPTY_FAVORITES };

  const fixed: FixedTicket[] = [];
  if (Array.isArray(value.fixed)) {
    for (const item of value.fixed) {
      if (typeof item === "string" && item) {
        fixed.push({ key: item, minutes: 15 });
        continue;
      }
      if (
        item &&
        typeof item === "object" &&
        "key" in item &&
        typeof item.key === "string" &&
        item.key
      ) {
        const minutes =
          "minutes" in item &&
          typeof item.minutes === "number" &&
          Number.isFinite(item.minutes)
            ? Math.max(1, Math.min(1440, Math.round(item.minutes)))
            : 15;
        const comment =
          "comment" in item && typeof item.comment === "string"
            ? item.comment
            : undefined;
        fixed.push({ key: item.key, minutes, comment });
      }
    }
  }

  return {
    pins: isStringArray(value.pins) ? value.pins.filter(Boolean) : [],
    fixed,
  };
}

export function saveFavorites(favorites: Favorites): void {
  writeJson(FAVORITES_KEY, favorites);
}

export function loadDaysOff(): string[] {
  const value = readJson<unknown>(DAYS_OFF_KEY);
  return isStringArray(value) ? value.filter(Boolean) : [];
}

export function saveDaysOff(daysOff: string[]): void {
  writeJson(DAYS_OFF_KEY, daysOff);
}

export function markHasLogged(): void {
  if (!readJson<string>(FIRST_LOGGED_KEY)) {
    writeJson(FIRST_LOGGED_KEY, new Date().toISOString());
  }
}

export function loadFirstLoggedAt(): string | null {
  const value = readJson<unknown>(FIRST_LOGGED_KEY);
  return typeof value === "string" ? value : null;
}

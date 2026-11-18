export const MAX_WORKLOG_SECONDS = 24 * 60 * 60;

export function parseDuration(input: string): number | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;

  if (/^\d+:\d{1,2}$/.test(value)) {
    const [hoursRaw, minutesRaw] = value.split(":");
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) {
      return null;
    }
    return normalizeSeconds(hours * 3600 + minutes * 60);
  }

  const combined = value.match(/^(\d+(?:\.\d+)?)h\s*(\d+)?m?$/);
  if (combined) {
    const hours = Number(combined[1]);
    const minutes = combined[2] ? Number(combined[2]) : 0;
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) {
      return null;
    }
    return normalizeSeconds(hours * 3600 + minutes * 60);
  }

  const minutesOnly = value.match(/^(\d+(?:\.\d+)?)m$/);
  if (minutesOnly) {
    const minutes = Number(minutesOnly[1]);
    return normalizeSeconds(minutes * 60);
  }

  const hoursOnly = value.match(/^(\d+(?:\.\d+)?)$/);
  if (hoursOnly) {
    const hours = Number(hoursOnly[1]);
    return normalizeSeconds(hours * 3600);
  }

  return null;
}

function normalizeSeconds(seconds: number): number | null {
  const rounded = Math.round(seconds);
  if (!Number.isFinite(rounded) || rounded <= 0 || rounded > MAX_WORKLOG_SECONDS) {
    return null;
  }
  return rounded;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function formatDurationCompact(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

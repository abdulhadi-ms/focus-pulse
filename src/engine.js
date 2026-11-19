export const MODES = Object.freeze({
  FOCUS: "focus",
  SHORT_BREAK: "shortBreak",
  LONG_BREAK: "longBreak",
});

export const DEFAULT_SETTINGS = Object.freeze({
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
});

export function clamp(value, min, max) {
  const num = Number(value);
  if (Number.isNaN(num)) return min;
  return Math.min(Math.max(Math.round(num), min), max);
}

export function validateSettings(input = {}) {
  return {
    focusMinutes: clamp(input.focusMinutes ?? DEFAULT_SETTINGS.focusMinutes, 1, 120),
    shortBreakMinutes: clamp(input.shortBreakMinutes ?? DEFAULT_SETTINGS.shortBreakMinutes, 1, 60),
    longBreakMinutes: clamp(input.longBreakMinutes ?? DEFAULT_SETTINGS.longBreakMinutes, 1, 90),
    cyclesBeforeLongBreak: clamp(
      input.cyclesBeforeLongBreak ?? DEFAULT_SETTINGS.cyclesBeforeLongBreak,
      2,
      8
    ),
  };
}

export function getDurationSeconds(mode, settings = DEFAULT_SETTINGS) {
  const safe = validateSettings(settings);
  switch (mode) {
    case MODES.SHORT_BREAK:
      return safe.shortBreakMinutes * 60;
    case MODES.LONG_BREAK:
      return safe.longBreakMinutes * 60;
    case MODES.FOCUS:
    default:
      return safe.focusMinutes * 60;
  }
}

export function getNextMode(currentMode, completedFocusCount, cyclesBeforeLongBreak = 4) {
  if (currentMode === MODES.FOCUS) {
    const nextCount = completedFocusCount + 1;
    return nextCount % cyclesBeforeLongBreak === 0 ? MODES.LONG_BREAK : MODES.SHORT_BREAK;
  }
  return MODES.FOCUS;
}

export function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function toDateKey(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function computeDailyStats(sessions = [], referenceDate = new Date(), days = 7) {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const buckets = new Map();
  const orderedKeys = [];
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(ref);
    d.setDate(ref.getDate() - i);
    const key = toDateKey(d);
    orderedKeys.push(key);
    buckets.set(key, {
      dateKey: key,
      label: weekdayFormatter.format(d),
      focusMinutes: 0,
      sessionsCount: 0,
    });
  }

  for (const session of sessions) {
    if (session.mode !== MODES.FOCUS) continue;
    const key = toDateKey(session.completedAt);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.focusMinutes += Number(session.durationMinutes) || 0;
      bucket.sessionsCount += 1;
    }
  }

  return orderedKeys.map((key) => buckets.get(key));
}

export function computeStreak(sessions = [], referenceDate = new Date()) {
  const focusDays = new Set(
    sessions
      .filter((s) => s.mode === MODES.FOCUS && s.completedAt)
      .map((s) => toDateKey(s.completedAt))
  );

  if (focusDays.size === 0) return 0;

  const cursor = new Date(referenceDate);
  cursor.setHours(0, 0, 0, 0);

  // If no session completed today yet, allow streak to continue from yesterday
  if (!focusDays.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!focusDays.has(toDateKey(cursor))) {
      return 0;
    }
  }

  let streak = 0;
  while (focusDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeSummary(sessions = [], referenceDate = new Date()) {
  const todayKey = toDateKey(referenceDate);
  const focusSessions = sessions.filter((s) => s.mode === MODES.FOCUS);

  let todayMinutes = 0;
  let todaySessions = 0;
  let totalMinutes = 0;

  for (const session of focusSessions) {
    const mins = Number(session.durationMinutes) || 0;
    totalMinutes += mins;
    if (toDateKey(session.completedAt) === todayKey) {
      todayMinutes += mins;
      todaySessions += 1;
    }
  }

  return {
    todayMinutes,
    todaySessions,
    totalMinutes,
    totalSessions: focusSessions.length,
    currentStreak: computeStreak(focusSessions, referenceDate),
  };
}

function escapeCSVField(value) {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportSessionsToCSV(sessions = []) {
  const headers = ["id", "mode", "duration_minutes", "task_title", "completed_at"];
  const rows = sessions.map((s) =>
    [
      escapeCSVField(s.id),
      escapeCSVField(s.mode),
      escapeCSVField(s.durationMinutes),
      escapeCSVField(s.taskTitle || ""),
      escapeCSVField(s.completedAt),
    ].join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

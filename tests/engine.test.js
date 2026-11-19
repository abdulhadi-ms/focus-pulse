import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  MODES,
  computeDailyStats,
  computeStreak,
  computeSummary,
  exportSessionsToCSV,
  formatTime,
  getDurationSeconds,
  getNextMode,
  validateSettings,
} from "../src/engine.js";

test("formatTime formats seconds into MM:SS safely", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(65), "01:05");
  assert.equal(formatTime(1500), "25:00");
  assert.equal(formatTime(-10), "00:00");
});

test("validateSettings clamps out-of-range and invalid values", () => {
  const result = validateSettings({
    focusMinutes: 999,
    shortBreakMinutes: -5,
    longBreakMinutes: "bad",
    cyclesBeforeLongBreak: 1,
  });

  assert.deepEqual(result, {
    focusMinutes: 120,
    shortBreakMinutes: 1,
    longBreakMinutes: 1,
    cyclesBeforeLongBreak: 2,
  });
});

test("getDurationSeconds returns mode duration in seconds", () => {
  assert.equal(getDurationSeconds(MODES.FOCUS, DEFAULT_SETTINGS), 1500);
  assert.equal(getDurationSeconds(MODES.SHORT_BREAK, DEFAULT_SETTINGS), 300);
  assert.equal(getDurationSeconds(MODES.LONG_BREAK, DEFAULT_SETTINGS), 900);
});

test("getNextMode cycles focus -> short/long break -> focus", () => {
  assert.equal(getNextMode(MODES.FOCUS, 0, 4), MODES.SHORT_BREAK);
  assert.equal(getNextMode(MODES.FOCUS, 2, 4), MODES.SHORT_BREAK);
  assert.equal(getNextMode(MODES.FOCUS, 3, 4), MODES.LONG_BREAK);
  assert.equal(getNextMode(MODES.SHORT_BREAK, 1, 4), MODES.FOCUS);
  assert.equal(getNextMode(MODES.LONG_BREAK, 4, 4), MODES.FOCUS);
});

test("computeStreak calculates consecutive active focus days", () => {
  const ref = new Date(2026, 10, 19, 12, 0, 0); // 2026-11-19 local
  const sessions = [
    { mode: MODES.FOCUS, durationMinutes: 25, completedAt: new Date(2026, 10, 19, 9, 0) },
    { mode: MODES.FOCUS, durationMinutes: 25, completedAt: new Date(2026, 10, 18, 15, 0) },
    { mode: MODES.FOCUS, durationMinutes: 25, completedAt: new Date(2026, 10, 17, 10, 0) },
    { mode: MODES.SHORT_BREAK, durationMinutes: 5, completedAt: new Date(2026, 10, 16, 10, 0) },
  ];

  assert.equal(computeStreak(sessions, ref), 3);
});

test("computeDailyStats and computeSummary aggregate focus sessions accurately", () => {
  const ref = new Date(2026, 10, 19, 14, 0, 0);
  const sessions = [
    { mode: MODES.FOCUS, durationMinutes: 25, completedAt: new Date(2026, 10, 19, 9, 0) },
    { mode: MODES.FOCUS, durationMinutes: 50, completedAt: new Date(2026, 10, 19, 11, 0) },
    { mode: MODES.SHORT_BREAK, durationMinutes: 5, completedAt: new Date(2026, 10, 19, 11, 55) },
    { mode: MODES.FOCUS, durationMinutes: 25, completedAt: new Date(2026, 10, 18, 10, 0) },
  ];

  const daily = computeDailyStats(sessions, ref, 7);
  assert.equal(daily.length, 7);
  assert.equal(daily[6].focusMinutes, 75);
  assert.equal(daily[6].sessionsCount, 2);
  assert.equal(daily[5].focusMinutes, 25);

  const summary = computeSummary(sessions, ref);
  assert.deepEqual(summary, {
    todayMinutes: 75,
    todaySessions: 2,
    totalMinutes: 100,
    totalSessions: 3,
    currentStreak: 2,
  });
});

test("exportSessionsToCSV escapes quotes and commas cleanly", () => {
  const csv = exportSessionsToCSV([
    {
      id: "sess_1",
      mode: "focus",
      durationMinutes: 25,
      taskTitle: 'Write "README", push repo',
      completedAt: "2026-11-19T06:00:00.000Z",
    },
  ]);

  const lines = csv.split("\n");
  assert.equal(lines[0], "id,mode,duration_minutes,task_title,completed_at");
  assert.equal(
    lines[1],
    'sess_1,focus,25,"Write ""README"", push repo",2026-11-19T06:00:00.000Z'
  );
});

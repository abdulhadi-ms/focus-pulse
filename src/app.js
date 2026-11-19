import {
  DEFAULT_SETTINGS,
  MODES,
  computeDailyStats,
  computeSummary,
  exportSessionsToCSV,
  formatTime,
  getDurationSeconds,
  getNextMode,
  validateSettings,
} from "./engine.js";
import { SoundEngine } from "./audio.js";

const STORAGE_KEYS = {
  SETTINGS: "focuspulse.settings.v1",
  TASKS: "focuspulse.tasks.v1",
  SESSIONS: "focuspulse.sessions.v1",
  THEME: "focuspulse.theme.v1",
};

const MODE_LABELS = {
  [MODES.FOCUS]: "Deep Focus",
  [MODES.SHORT_BREAK]: "Short Break",
  [MODES.LONG_BREAK]: "Long Break",
};

const RING_RADIUS = 106;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const soundEngine = new SoundEngine();

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
}

const state = {
  settings: validateSettings(loadJSON(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS)),
  tasks: loadJSON(STORAGE_KEYS.TASKS, []),
  sessions: loadJSON(STORAGE_KEYS.SESSIONS, []),
  theme: loadJSON(STORAGE_KEYS.THEME, "dark"),
  activeTaskId: null,
  mode: MODES.FOCUS,
  completedFocusCount: 0,
  totalSeconds: 0,
  remainingSeconds: 0,
  isRunning: false,
  endTimestamp: null,
  timerId: null,
};

state.totalSeconds = getDurationSeconds(state.mode, state.settings);
state.remainingSeconds = state.totalSeconds;
if (state.tasks.length > 0) {
  const firstOpen = state.tasks.find((t) => !t.completed);
  state.activeTaskId = firstOpen ? firstOpen.id : state.tasks[0].id;
}

// DOM Elements
const els = {
  modeTabs: document.querySelectorAll(".mode-tab"),
  progressCircle: document.getElementById("progressCircle"),
  modeLabel: document.getElementById("modeLabel"),
  timeDisplay: document.getElementById("timeDisplay"),
  cycleDisplay: document.getElementById("cycleDisplay"),
  activeTaskTitle: document.getElementById("activeTaskTitle"),
  startPauseBtn: document.getElementById("startPauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  skipBtn: document.getElementById("skipBtn"),
  soundPills: document.querySelectorAll(".sound-pills .pill"),
  volumeSlider: document.getElementById("volumeSlider"),
  taskForm: document.getElementById("taskForm"),
  taskInput: document.getElementById("taskInput"),
  taskEstimate: document.getElementById("taskEstimate"),
  taskList: document.getElementById("taskList"),
  taskCounter: document.getElementById("taskCounter"),
  kpiTodayMins: document.getElementById("kpiTodayMins"),
  kpiStreak: document.getElementById("kpiStreak"),
  kpiTotalSessions: document.getElementById("kpiTotalSessions"),
  weeklyChart: document.getElementById("weeklyChart"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  themeBtn: document.getElementById("themeBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsDialog: document.getElementById("settingsDialog"),
  settingsForm: document.getElementById("settingsForm"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  resetDefaultsBtn: document.getElementById("resetDefaultsBtn"),
  focusMinutesInput: document.getElementById("focusMinutesInput"),
  shortBreakMinutesInput: document.getElementById("shortBreakMinutesInput"),
  longBreakMinutesInput: document.getElementById("longBreakMinutesInput"),
  cyclesInput: document.getElementById("cyclesInput"),
  toast: document.getElementById("toast"),
};

els.progressCircle.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;

let toastTimer = null;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("visible");
  }, 2600);
}

function applyTheme(theme) {
  state.theme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", state.theme);
  els.themeBtn.textContent = state.theme === "dark" ? "Light Mode" : "Dark Mode";
  saveJSON(STORAGE_KEYS.THEME, state.theme);
}

function getActiveTask() {
  return state.tasks.find((t) => t.id === state.activeTaskId) || null;
}

function renderTimer() {
  document.documentElement.setAttribute("data-mode", state.mode);
  const formatted = formatTime(state.remainingSeconds);
  els.timeDisplay.textContent = formatted;
  els.modeLabel.textContent = MODE_LABELS[state.mode];

  const cyclePos = (state.completedFocusCount % state.settings.cyclesBeforeLongBreak) + 1;
  els.cycleDisplay.textContent = `Cycle ${cyclePos} of ${state.settings.cyclesBeforeLongBreak}`;

  const progress = state.totalSeconds > 0 ? state.remainingSeconds / state.totalSeconds : 0;
  els.progressCircle.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));

  els.startPauseBtn.textContent = state.isRunning
    ? "Pause"
    : state.mode === MODES.FOCUS
      ? "Start Focus"
      : "Start Break";

  els.modeTabs.forEach((tab) => {
    const active = tab.dataset.mode === state.mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  const activeTask = getActiveTask();
  els.activeTaskTitle.textContent = activeTask ? activeTask.title : "No task selected";

  document.title = state.isRunning
    ? `${formatted} • ${MODE_LABELS[state.mode]} — FocusPulse`
    : "FocusPulse — Deep-Work Timer & Analytics";
}

function renderTasks() {
  els.taskList.innerHTML = "";
  const openCount = state.tasks.filter((t) => !t.completed).length;
  els.taskCounter.textContent = `${openCount} active · ${state.tasks.length} total`;

  if (state.tasks.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.textContent = "Add a task above to track focused pomodoros.";
    els.taskList.appendChild(li);
    return;
  }

  for (const task of state.tasks) {
    const li = document.createElement("li");
    li.className = `task-item${task.id === state.activeTaskId ? " active" : ""}${
      task.completed ? " completed" : ""
    }`;

    const main = document.createElement("div");
    main.className = "task-main";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(task.completed);
    checkbox.ariaLabel = `Mark "${task.title}" completed`;
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      saveJSON(STORAGE_KEYS.TASKS, state.tasks);
      renderTasks();
    });

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;

    main.append(checkbox, title);

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const chip = document.createElement("span");
    chip.className = "pomo-chip";
    chip.textContent = `${task.completedPomos}/${task.estimate}`;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-btn";
    delBtn.title = "Delete task";
    delBtn.ariaLabel = `Delete "${task.title}"`;
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      if (state.activeTaskId === task.id) {
        state.activeTaskId = state.tasks[0]?.id ?? null;
      }
      saveJSON(STORAGE_KEYS.TASKS, state.tasks);
      renderTasks();
      renderTimer();
    });

    meta.append(chip, delBtn);
    li.append(main, meta);

    li.addEventListener("click", () => {
      state.activeTaskId = task.id;
      renderTasks();
      renderTimer();
    });

    els.taskList.appendChild(li);
  }
}

function renderAnalytics() {
  const summary = computeSummary(state.sessions, new Date());
  els.kpiTodayMins.textContent = `${summary.todayMinutes}m`;
  els.kpiStreak.textContent = `${summary.currentStreak}d`;
  els.kpiTotalSessions.textContent = String(summary.totalSessions);

  const daily = computeDailyStats(state.sessions, new Date(), 7);
  const maxMins = Math.max(25, ...daily.map((d) => d.focusMinutes));

  els.weeklyChart.innerHTML = "";
  for (const day of daily) {
    const col = document.createElement("div");
    col.className = "bar-col";
    col.title = `${day.dateKey}: ${day.focusMinutes} min (${day.sessionsCount} sessions)`;

    const val = document.createElement("span");
    val.className = "bar-value";
    val.textContent = day.focusMinutes > 0 ? `${day.focusMinutes}m` : "";

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.height = `${Math.round((day.focusMinutes / maxMins) * 100)}%`;

    track.appendChild(fill);

    const label = document.createElement("span");
    label.className = "bar-day";
    label.textContent = day.label;

    col.append(val, track, label);
    els.weeklyChart.appendChild(col);
  }
}

function pauseTimer() {
  state.isRunning = false;
  state.endTimestamp = null;
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  renderTimer();
}

function switchMode(newMode) {
  pauseTimer();
  state.mode = newMode;
  state.totalSeconds = getDurationSeconds(newMode, state.settings);
  state.remainingSeconds = state.totalSeconds;
  renderTimer();
}

function completeCurrentSession({ skipped = false } = {}) {
  const finishedMode = state.mode;
  pauseTimer();

  if (!skipped) {
    soundEngine.playChime();
    const activeTask = getActiveTask();
    const durationMinutes = Math.round(state.totalSeconds / 60);

    state.sessions.push({
      id: `sess_${Date.now()}`,
      mode: finishedMode,
      durationMinutes,
      taskTitle: activeTask ? activeTask.title : "",
      completedAt: new Date().toISOString(),
    });
    saveJSON(STORAGE_KEYS.SESSIONS, state.sessions);

    if (finishedMode === MODES.FOCUS) {
      if (activeTask) {
        activeTask.completedPomos += 1;
        saveJSON(STORAGE_KEYS.TASKS, state.tasks);
      }
      showToast(`Focus session complete (+${durationMinutes}m logged)`);
    } else {
      showToast("Break finished — ready for deep focus!");
    }
  }

  const nextMode = getNextMode(
    finishedMode,
    state.completedFocusCount,
    state.settings.cyclesBeforeLongBreak
  );

  if (finishedMode === MODES.FOCUS && !skipped) {
    state.completedFocusCount += 1;
  }

  switchMode(nextMode);
  renderTasks();
  renderAnalytics();
}

function startTimer() {
  if (state.isRunning) return;
  state.isRunning = true;
  state.endTimestamp = Date.now() + state.remainingSeconds * 1000;

  state.timerId = setInterval(() => {
    const diff = Math.ceil((state.endTimestamp - Date.now()) / 1000);
    if (diff <= 0) {
      state.remainingSeconds = 0;
      renderTimer();
      completeCurrentSession({ skipped: false });
      return;
    }
    if (diff !== state.remainingSeconds) {
      state.remainingSeconds = diff;
      renderTimer();
    }
  }, 250);

  renderTimer();
}

function toggleTimer() {
  if (state.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  pauseTimer();
  state.totalSeconds = getDurationSeconds(state.mode, state.settings);
  state.remainingSeconds = state.totalSeconds;
  renderTimer();
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Event Listeners
els.startPauseBtn.addEventListener("click", toggleTimer);
els.resetBtn.addEventListener("click", resetTimer);
els.skipBtn.addEventListener("click", () => completeCurrentSession({ skipped: true }));

els.modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchMode(tab.dataset.mode));
});

els.soundPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    els.soundPills.forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    soundEngine.setAmbient(pill.dataset.sound);
  });
});

els.volumeSlider.addEventListener("input", (e) => {
  soundEngine.setVolume(e.target.value);
});

els.taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = els.taskInput.value.trim();
  if (!title) return;
  const estimate = Math.min(Math.max(Number(els.taskEstimate.value) || 1, 1), 12);

  const newTask = {
    id: `task_${Date.now()}`,
    title,
    estimate,
    completedPomos: 0,
    completed: false,
  };

  state.tasks.unshift(newTask);
  state.activeTaskId = newTask.id;
  saveJSON(STORAGE_KEYS.TASKS, state.tasks);

  els.taskInput.value = "";
  els.taskEstimate.value = "2";
  renderTasks();
  renderTimer();
});

els.exportCsvBtn.addEventListener("click", () => {
  const csv = exportSessionsToCSV(state.sessions);
  downloadFile("focuspulse-sessions.csv", csv, "text/csv;charset=utf-8");
  showToast("Exported sessions as CSV");
});

els.exportJsonBtn.addEventListener("click", () => {
  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      tasks: state.tasks,
      sessions: state.sessions,
    },
    null,
    2
  );
  downloadFile("focuspulse-backup.json", payload, "application/json;charset=utf-8");
  showToast("Exported backup as JSON");
});

els.themeBtn.addEventListener("click", () => {
  applyTheme(state.theme === "dark" ? "light" : "dark");
});

function openSettings() {
  els.focusMinutesInput.value = String(state.settings.focusMinutes);
  els.shortBreakMinutesInput.value = String(state.settings.shortBreakMinutes);
  els.longBreakMinutesInput.value = String(state.settings.longBreakMinutes);
  els.cyclesInput.value = String(state.settings.cyclesBeforeLongBreak);
  els.settingsDialog.showModal();
}

els.settingsBtn.addEventListener("click", openSettings);
els.closeSettingsBtn.addEventListener("click", () => els.settingsDialog.close());

els.resetDefaultsBtn.addEventListener("click", () => {
  els.focusMinutesInput.value = String(DEFAULT_SETTINGS.focusMinutes);
  els.shortBreakMinutesInput.value = String(DEFAULT_SETTINGS.shortBreakMinutes);
  els.longBreakMinutesInput.value = String(DEFAULT_SETTINGS.longBreakMinutes);
  els.cyclesInput.value = String(DEFAULT_SETTINGS.cyclesBeforeLongBreak);
});

els.settingsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  state.settings = validateSettings({
    focusMinutes: els.focusMinutesInput.value,
    shortBreakMinutes: els.shortBreakMinutesInput.value,
    longBreakMinutes: els.longBreakMinutesInput.value,
    cyclesBeforeLongBreak: els.cyclesInput.value,
  });
  saveJSON(STORAGE_KEYS.SETTINGS, state.settings);
  els.settingsDialog.close();
  resetTimer();
  showToast("Settings saved");
});

document.addEventListener("keydown", (e) => {
  if (els.settingsDialog.open) return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  if (e.code === "Space") {
    e.preventDefault();
    toggleTimer();
  } else if (e.key === "r" || e.key === "R") {
    resetTimer();
  } else if (e.key === "n" || e.key === "N") {
    completeCurrentSession({ skipped: true });
  }
});

// Initial Render
applyTheme(state.theme);
renderTimer();
renderTasks();
renderAnalytics();

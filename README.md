# FocusPulse

> A zero-dependency, offline-first Pomodoro timer, task queue, procedural Web Audio ambient soundscape generator, and deep-work analytics dashboard.

![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![Vanilla JS](https://img.shields.io/badge/JavaScript-ES2023-f7df1e?logo=javascript&logoColor=000)
![Tests](https://img.shields.io/badge/tests-node%3Atest-339933?logo=node.js&logoColor=fff)
![License](https://img.shields.io/badge/license-MIT-blue)

## Why use FocusPulse?

Most productivity timers require sign-ups, subscriptions, bloated frameworks, or stream heavy audio files. **FocusPulse** runs 100% locally in your browser with **zero npm dependencies**, synthesizes ambient focus audio on the fly with the **Web Audio API**, and keeps all your focus logs private in `localStorage` with one-click CSV/JSON export.

## Features

- **Drift-Free Pomodoro Timer** — Timestamp-based countdown (`Date.now()`) with an animated SVG progress ring, automatic Focus / Short Break / Long Break cycling, and customizable intervals.
- **Procedural Ambient Soundscapes** — Real-time Web Audio API synthesis for **Brown Noise**, **Soft Rain**, and **Focus Hum** (plus a harmonic completion chime) — no external `.mp3` files required.
- **Task Queue with Estimates** — Add tasks with estimated pomodoros, select the active focus task, track completed sessions per task, and mark tasks done.
- **Deep-Work Analytics** — Track today's focus minutes, consecutive daily streak, total sessions, and a 7-day focus activity bar chart.
- **Data Portability** — Export your full session history to **CSV** (RFC-4180 escaped) or **JSON** anytime.
- **Dark & Light Themes** — Responsive glassmorphic UI with mode-aware accent colors and keyboard shortcuts.
- **Tested Core Engine** — Pure ES module timer/analytics engine verified with Node.js's built-in test runner (`node --test`).

## Quick Start

### Option 1: Run locally with Node.js (zero installs needed)

```bash
git clone https://github.com/abdulhadi-ms/focus-pulse.git
cd focus-pulse
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Option 2: Run unit tests

```bash
npm test
```

### Option 3: Deploy to GitHub Pages

Because FocusPulse is pure HTML, CSS, and ES Modules with no build step, you can publish it immediately:
1. Go to your repository **Settings → Pages**.
2. Set **Source** to `Deploy from a branch` (`main` / `/ (root)`).
3. Save — your live app will be available at `https://abdulhadi-ms.github.io/focus-pulse/`.

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Start / Pause timer |
| `R` | Reset current session |
| `N` | Skip to next phase |

## Project Structure

```text
focus-pulse/
├── index.html          # Semantic, accessible app shell & settings dialog
├── styles.css          # Dark/light theme variables, responsive grid & SVG ring styles
├── server.js           # Zero-dependency Node.js static file server
├── src/
│   ├── engine.js       # Pure timer state, streak, 7-day analytics & CSV export logic
│   ├── audio.js        # Procedural Web Audio API soundscapes & completion chime
│   └── app.js          # UI controller, drift-free clock, tasks & localStorage sync
├── tests/
│   └── engine.test.js  # Unit tests powered by node:test & node:assert
├── package.json
└── LICENSE
```

## License

MIT © [abdulhadi-ms](https://github.com/abdulhadi-ms)

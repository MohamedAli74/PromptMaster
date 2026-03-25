# Prompt Master — CLAUDE.md

## Project Overview

**Prompt Master** is a Chrome Extension (Manifest V3) that acts as a real-time prompt linter and expansion engine for AI chat platforms (ChatGPT, Claude, Gemini). It scores user prompts against the R.C.T.C.F. standard and can expand raw text into structured prompts using Chrome's built-in `window.ai` (Gemini Nano) — fully local, no server.

**Current version:** 0.1.0 (MVP — Design/Build Phase)

---

## Architecture

```
manifest.json                  <- MV3 extension manifest
background/service_worker.js   <- Cross-tab state, storage init, message routing
content/content.js             <- Injected into AI platforms; detects input, injects sidebar + FAB
content/content.css            <- Content script styles
sidebar/sidebar.html           <- Sidebar UI (injected as iframe)
sidebar/sidebar.js             <- Linter logic + render; receives PROMPT_UPDATE messages
sidebar/sidebar.css            <- Sidebar styles
```

### Supported Platforms & Input Selectors

| Platform | Selector |
|---|---|
| `chatgpt.com` | `#prompt-textarea` |
| `claude.ai` | `[contenteditable="true"]` |
| `gemini.google.com` | `.ql-editor` |

---

## Key Concepts

- **R.C.T.C.F.** — the 5-part prompt quality standard: Role, Context, Task, Constraint, Format
- **Linter Sidebar** — scores a prompt 0–100 in real time, flags missing components
- **Magic Wand FAB** — floating button that calls `window.ai` to expand a raw prompt in-place
- **Zero-Server Architecture** — all AI inference runs locally via `window.ai` (Gemini Nano)
- **`chrome.storage.sync`** — stores user templates and preferences (sidebar toggle, auto-expand)

### Message Flow

```
content.js  →  chrome.runtime.sendMessage({ type: 'PROMPT_UPDATE', text })
                          ↓
            service_worker.js  (routes to sidebar)
                          ↓
            sidebar.js  →  lintPrompt(text)  →  renderScore()
```

---

## Development Notes

- No build step — plain JS/HTML/CSS loaded directly by Chrome
- Load the extension in Chrome via `chrome://extensions` > "Load unpacked"
- `window.ai` requires Chrome 127+ with the Gemini Nano flag enabled
- `chrome.storage.sync` limits: 100KB total, 8KB per key — keep templates small
- DOM selectors for AI platforms break frequently; test after platform updates

---

## Agile PM

This project uses the `/agile-pm` skill for sprint and ticket management.

Sprint files live in:
```
docs/
  sprints/
    active.md
    backlog.md
    archive/
```

Run `/agile-pm` to create tickets, plan sprints, or close a sprint.

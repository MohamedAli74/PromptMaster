# Prompt Master — Project Anchor

**Version:** 1.0 (MVP)
**Status:** Design Phase / Conceptual Anchor
**Core Value Prop:** A UI/UX upgrade for the AI era — transforms raw user intent into high-performance, structured prompts using local browser intelligence.

---

## The Vision

In 2026, the bottleneck in AI productivity is not the model — it is the human input. Most users interact with LLMs using "Search Engine Logic" (vague, one-line queries). Prompt Master is a Chrome Extension that bridges this gap: a real-time linter and expansion engine that ensures every prompt meets the 5-part engineering standard:

R.C.T.C.F: **Role · Context · Task · Constraint · Format**

---

## Core UX

### A. The Linter Sidebar
- Slides out when a text area on a supported AI platform is focused
- Displays a real-time Prompt Quality Score (0–100) that updates as the user types
- Visual indicators per missing component (e.g. "Missing Persona", "No Format Specified")

### B. The Magic Wand FAB
- One-click floating action button near the chat input
- Uses Chrome's built-in Gemini Nano (`window.ai`) to expand raw text into a structured prompt — locally, no server

---

## Feature Set (MVP)

| Feature | Description |
| --- | --- |
| Variable Templates | `/` command injects pre-defined structures with tab-stop fields |
| Constraint Checklist | Toggles for "No Jargon", "Table Format", "Under 200 Words", etc. |
| Reasoning Trigger | Auto-injects "Think step-by-step" / "Self-critique" logic |
| Persona Injector | Context-aware role suggestions (e.g. "Senior DevOps", "Legal Litigator") |

---

## Technical Architecture

- **Platform:** Chrome Extension — Manifest V3
- **AI Logic:** Local-first via `window.ai` (Gemini Nano) — Zero-Server Architecture
- **Storage:** `chrome.storage.sync` for templates and preferences
- **DOM:** `MutationObserver` targets dynamic chat inputs without breaking native UI
- **Privacy:** No prompt data leaves the machine for linting purposes

### Supported Platforms
- `chatgpt.com`
- `claude.ai`
- `gemini.google.com`

---

## Target Personas

1. **The Busy Executive** — needs high-quality output from 5-word inputs
2. **The Content Machine** — uses templates to maintain brand voice across 50+ daily prompts
3. **The Non-Tech Professional** — knows what they want, not the "dark art" of prompting

---

## To Do (MVP)

- [ ] Linter: implement 5-component detection heuristics in `sidebar/sidebar.js`
- [ ] Linter: integrate `window.ai` for smarter component detection
- [ ] Content script: inject sidebar iframe into supported pages
- [ ] Content script: inject Magic Wand FAB and wire up click handler
- [ ] Content script: stream input keystrokes to sidebar via `chrome.runtime.sendMessage`
- [ ] Magic Wand: call `window.ai` to expand raw prompt, replace input value
- [ ] Templates: implement `/` command trigger and tab-stop navigation
- [ ] Constraint toggles: build UI and append to prompt on toggle
- [ ] Persona injector: build suggestion list and inject on select
- [ ] Icons: design and export icon set (16, 48, 128px)
- [ ] Test on ChatGPT, Claude, and Gemini for DOM selector accuracy
- [ ] Publish to Chrome Web Store

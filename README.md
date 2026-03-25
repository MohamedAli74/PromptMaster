# Prompt Master

A Chrome Extension that acts as a real-time prompt linter and expansion engine for AI chat platforms — helping you write better prompts, instantly.

Developer: Mohamed Ali 

## What it does

Prompt Master sits alongside ChatGPT, Claude, and Gemini as you type. It insures that every prompt is following the **R.C.T.C.F.** standard (Role, Context, Task, Constraint, Format) and shows you exactly what's missing. A floating "Magic Wand" button can expand a rough idea into a fully structured prompt — entirely on-device, no server required.

## Features

- **R.C.T.C.F. checklist** — flags which of the 5 components are missing
- **Magic Wand FAB** — expands raw prompts in-place.
- **Zero-server architecture** — all AI inference runs locally, nothing leaves your browser
- **Currently Supported Browsers** — Google Chrome
- **Currently Supported AI platforms** — ChatGPT, Claude, Gemini

## The R.C.T.C.F. Standard

| Component | What it means |
|---|---|
| **Role** | The persona or expertise the AI should adopt |
| **Context** | Background information relevant to the task |
| **Task** | The specific action or output you want |
| **Constraint** | Limitations, rules, or boundaries to follow |
| **Format** | How the output should be structured |

A prompt that hits all five components scores 100/100.

## Installation (Developer Mode)
- currently unavailable

### Requirements

- Chrome 127 or later
- Gemini Nano enabled for the Magic Wand feature:
  - Go to `chrome://flags/#optimization-guide-on-device-model`
  - Set to **Enabled BypassPerfRequirement**
  - Relaunch Chrome

## Project Structure

```
manifest.json                  # MV3 extension manifest
background/service_worker.js   # Cross-tab state, storage init, message routing
content/content.js             # Injected into AI platforms; detects input, injects sidebar + FAB
content/content.css            # Content script styles
sidebar/sidebar.html           # Sidebar UI (injected as iframe)
sidebar/sidebar.js             # Linter logic + render
sidebar/sidebar.css            # Sidebar styles
```

## Status

Version **0.1.0** — MVP under active development. Core scaffold is in place; linter heuristics, sidebar UI, and Magic Wand expansion are being built out.

---

A MASSS product.
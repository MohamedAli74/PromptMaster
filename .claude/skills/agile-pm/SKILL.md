---
name: agile-pm
description: Manages software development using Agile sprints and atomic tickets tracked in Markdown files. Handles ticket creation, sprint planning, backlog triage, and versioning.
when_to_use: When planning work, creating or updating tickets, starting a sprint, discussing a new feature idea, closing a sprint, or managing the project version.
---

# Agile PM System

## File Structure

```
docs/
  sprints/
    active.md              <- current sprint (always check this first)
    backlog.md             <- work not yet pulled into a sprint
    archive/
      sprint-XX_vX.X.X.md <- completed sprints
```

## Active Sprint Format (`active.md`)

```markdown
# Sprint XX — Target: vX.X.X
**Start:** YYYY-MM-DD | **Target End:** YYYY-MM-DD | **Status:** Active

## Tickets

| ID | Title | Status |
|----|-------|--------|
| TICK-XXX | Short title | Pending / In Progress / Done |

---

### TICK-XXX: Title
**Status:** Pending
**Definition of Done:** [specific, verifiable condition]

**Technical Breakdown:**
1. ...
2. ...
3. ...
```

## Backlog Format (`backlog.md`)

```markdown
# Backlog

| ID | Title | Priority | Notes |
|----|-------|----------|-------|
| TICK-XXX | Short title | High / Medium / Low | Brief context |
```

## Workflow Rules

### Before writing any code
1. Check `docs/sprints/active.md` for the relevant ticket.
2. If no ticket exists, create one — or ask the user if it should be backlogged instead.
3. Mark the ticket **In Progress** in `active.md`.
4. Present a 3–5 step technical breakdown and confirm with the user before starting.

### When a new feature is suggested mid-sprint
- If it's not in the active sprint: tell the user and offer to add it to `backlog.md`.
- Do not start implementation until it's pulled into a sprint.

### After completing a ticket
1. Mark the ticket **Done** in `active.md` (both in the summary table and the detail section).

### Closing a sprint
1. Rename `active.md` → `archive/sprint-XX_vX.X.X.md`.
2. Bump the project version (wherever it lives in the codebase).
3. Create a fresh `active.md` for the next sprint, pulling tickets from `backlog.md`.

## Ticket ID Convention

- IDs are sequential and never reused: `TICK-001`, `TICK-002`, ...
- Backlog tickets keep their ID when pulled into a sprint.
- Assign the next available ID by checking the highest existing ID across both `active.md` and `backlog.md`.

## Version Management

- Format: `MAJOR.MINOR.PATCH`
  - PATCH: bug fixes, small improvements
  - MINOR: new user-facing features
  - MAJOR: architectural changes or major milestones
- Version is bumped when a sprint closes, not per-ticket.
- The sprint archive filename reflects the version it targeted: `sprint-XX_vX.X.X.md`.

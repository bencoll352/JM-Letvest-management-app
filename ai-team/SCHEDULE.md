# JM Letvest Operations: Schedule (`Europe/London` GMT / BST)

All JM Letvest operational routines evaluate wall-clock time in **`Europe/London`** (automatically adjusting between **GMT `UTC+00:00`** in winter and **BST `UTC+01:00`** during British Summer Time).

All routines ship **inactive (`off`)** until explicitly enabled by the Owner.

## 1. Schedule Table

| routine | days | fire | window_start | window_end | key | budget | browser |
|---|---|---|---|---|---|---|---|
| `jm-daily-briefing` | `off` | 07:30 | 07:15 | 10:30 | `YYYY-MM-DD` | 10 min | never |
| `jm-compliance-check` | `off` | 08:00 | 07:45 | 11:00 | `YYYY-MM-DD` | 10 min | never |
| `jm-monday-arrears` | `off` | 08:30 | 08:15 | 12:00 | `YYYY-Www` | 15 min | never |
| `jm-friday-scoreboard` | `off` | 16:00 | 15:45 | 19:00 | `YYYY-Www` | 15 min | never |

### Target Cadences When Enabled by Owner
- `jm-daily-briefing`: change `off` -> `mon-fri` (Role: `chief-of-staff`, 07:30 `Europe/London`)
- `jm-compliance-check`: change `off` -> `mon-fri` (Role: `compliance-officer`, 08:00 `Europe/London`)
- `jm-monday-arrears`: change `off` -> `mon` (Role: `rent-finance-controller`, Monday 08:30 `Europe/London`)
- `jm-friday-scoreboard`: change `off` -> `fri` (Role: `chief-of-staff`, Friday 16:00 `Europe/London`)

## 2. UK Time (`Europe/London` DST), Missed Runs & Overlap Rules

1. **UK Timezone & Daylight Saving Time (GMT / BST)**:
   - `scripts/guard.mjs` resolves `jm-*` routines against `Europe/London` using `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ... })`.
   - On the last Sunday of March (clocks forward `01:00 GMT` -> `02:00 BST`) and the last Sunday of October (clocks back `02:00 BST` -> `01:00 GMT`), fire times (`07:30`, `08:00`, `08:30`, `16:00`) remain anchored to UK local wall-clock time without manual table edits.
2. **Missed Runs & Catch-Up Windows**:
   - Each routine has a generous catch-up window (`07:15–10:30`, `07:45–11:00`, `08:15–12:00`, `15:45–19:00`).
   - If a trigger fires >15 minutes after its scheduled `fire` time (e.g. host machine woke up at `09:10`) or if `state/<id>.json` shows a missed prior eligible period, `guard.mjs` flags `missedRunDetected: true` in the verdict notes and runs once for the current period key (`YYYY-MM-DD` or `YYYY-Www`), never replaying a burst of stale historical runs.
   - If a trigger arrives after `window_end` without a completed run for the current period, `guard.mjs` returns `skipped-out-of-window` with `missedWindow: true` so the missed run is logged in `runlog.jsonl` and surfaced in the next briefing.
3. **Overlap Prevention**:
   - Staggered fire times (`07:30`, `08:00`, `08:30`, `16:00`) and hard budgets (`10–15 min`) prevent schedule collisions.
   - If an earlier `jm-*` routine is still holding an active unexpired lease in `state/run-leases/jm-*.json`, `guard.mjs` blocks the overlapping routine with `verdict: "skipped-already-ran"` (`overlapWith: "<active-routine-id>"`).

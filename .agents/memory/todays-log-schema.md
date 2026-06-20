---
name: Today's Log extended schema
description: daily_logs table was extended with new health tracking fields in June 2026.
---

The `daily_logs` table in `lib/db/src/schema/logs.ts` was extended with:
- `sleep_at`, `woke_at` (text, time strings like "23:00") — auto-compute `sleep_hours`
- `body_check_morning/afternoon/evening/night` (text) — mood/energy per time-of-day
- `food_morning/afternoon/evening/night` (text) — food by meal
- `junk_sugar_intake` (text, optional)
- `is_completed` (boolean, default false) — In Progress vs Completed status
- `custom_sections` (text, JSON string) — dynamic user-defined sections

API routes added to `artifacts/api-server/src/routes/logs.ts`:
- `PATCH /api/logs/today` — upsert today's log
- `GET /api/logs/dates?days=N` — list dates with log status (for calendar)
- `GET /api/logs/date/:date` — get log for any date
- `PATCH /api/logs/:id` — update log by id

**Why:** The "Today's Log" feature requested detailed daily health tracking beyond the original simple fields.

**How to apply:** Any new log-saving code should use `PATCH /api/logs/today` for today's data (upsert) and `PATCH /api/logs/:id` for historical edits.

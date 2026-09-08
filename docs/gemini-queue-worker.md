# Gemini queue worker (Hobby plan — external scheduler)

WhatsApp inbound messages are **enqueued** (`conversation_jobs` + pgmq `gemini_messages`) and processed by `POST/GET /api/worker`.

Vercel **Hobby** only allows one cron per day, so **do not** rely on `vercel.json` minute crons. Use an external scheduler.

## 1. Apply SQL

1. Ensure you already ran `supabase-cola-agente-ia.sql` (pgmq + `queue_send` / `queue_read` / `queue_delete`).
2. Run migration `supabase/migrations/20260907180000_gemini_queue_worker_runs.sql` in the Supabase SQL editor (creates `worker_runs` and ensures job tables).

## 2. Environment variables

Set these in Vercel Project Settings → Environment Variables (and locally in `.env`):

```bash
CRON_SECRET=generate-a-long-random-string
GEMINI_MAX_CONCURRENCY=5
GEMINI_MAX_RETRIES=5
GEMINI_QUEUE_BATCH_SIZE=10
GEMINI_QUEUE_VT_SECONDS=60
# optional
SLACK_ALERTS_WEBHOOK_URL=
```

## 3. External scheduler (every minute)

Point a scheduler at:

```http
POST https://YOUR_DOMAIN/api/worker
Authorization: Bearer YOUR_CRON_SECRET
```

`GET` with the same Bearer header also works.

### Option A — cron-job.org

1. Create a job → URL `https://YOUR_DOMAIN/api/worker`
2. Method: `POST`
3. Schedule: every 1 minute
4. Header: `Authorization: Bearer YOUR_CRON_SECRET`

### Option B — GitHub Actions

```yaml
name: gemini-worker
on:
  schedule:
    - cron: "* * * * *"
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Call worker
        run: |
          curl -fsS -X POST "$WORKER_URL" \
            -H "Authorization: Bearer $CRON_SECRET"
        env:
          WORKER_URL: ${{ secrets.GEMINI_WORKER_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

### Option C — Upstash QStash Schedules

Create a schedule that POSTs to `/api/worker` every minute and include the Bearer secret in headers.

## 4. Verify

1. Send a WhatsApp text to the bot.
2. Confirm a row in `conversation_jobs` with `status = queued` then `processing` / `completed`.
3. Confirm a row in `worker_runs` after the scheduler fires.
4. Watch logs for `[GEMINI_WORKER] batch_finished` and `queueDepthAfter`.

## Tuning

- If `queueDepthAfter` grows: raise `GEMINI_QUEUE_BATCH_SIZE` carefully (stay under `maxDuration=60`) or fire the scheduler more often / add a second worker ping.
- If Gemini 429s: lower `GEMINI_MAX_CONCURRENCY`.
- After Pro upgrade you may switch to a native Vercel cron; keep the same Bearer auth.

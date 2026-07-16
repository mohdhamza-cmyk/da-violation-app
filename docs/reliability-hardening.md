# Reliability hardening (round 1)

This round fixes the "Apps Script failures / overloads / capture fails a lot"
symptoms **without new infrastructure** — same Netlify + CodeSandbox + Google
Apps Script stack. Changes are split across `frontend/src/App.tsx` and
`apps-script/Code.gs`.

## Root causes addressed

1. **Top-of-hour thundering herd → 30-execution ceiling.** Every store was
   nudged to submit at `:00`, and each submission fired many requests, and every
   device's background retry ran on the *same* fixed 30s tick. Hundreds of
   devices hit Apps Script in lockstep. Consumer Google accounts allow only
   **30 simultaneous executions** and **90 min/day** total runtime.
2. **Resend-everything feedback loop.** When the server file count lagged (which
   it does under load), the client re-uploaded **all** files, adding more load,
   making the count lag more. A single slow file caused a full re-upload.
3. **Videos too heavy for Apps Script.** Large clips were split into dozens of
   base64 text chunks and reassembled in memory server-side, blowing the
   6-minute / memory limits so the upload retried forever.
4. **O(n) Drive scans on the hot path.** `addFile` listed every file in the hour
   folder on every call to check idempotency.
5. **Weak idempotency key** — `id: Date.now()` could collide across devices in
   the same millisecond.

## What changed

### Frontend (`frontend/src/App.tsx`)
- **Targeted resend.** `getServerPresence()` now asks the server *which* file
  indices already landed; the retry loop resends **only the missing** files
  (was: resend all). Exponential backoff (2.5s → 4s → 6.4s), 3 rounds max.
  Falls back safely to count-based retries if the backend hasn't been redeployed
  yet, so deploy order doesn't matter.
- **De-synchronized background retries.** The sync engine now runs on a
  **jittered** interval (25–45s, randomized per device) with a staggered first
  run (0–8s) instead of a fixed 30s tick, spreading load across time.
- **Video size cap (25 MB).** Oversized clips are rejected at capture with a
  clear message, eliminating the multi-chunk assembly failures.
- **Stronger record ID** — `Date.now()` + random suffix.

### Backend (`apps-script/Code.gs`)
- `?fileCount` also returns `indices` (the present file indices) to drive the
  targeted resend above.
- `addFile` idempotency now uses an **O(1) `getFilesByName`** lookup instead of
  scanning the whole hour folder.

## Redeploy steps

1. **Apps Script**: paste `apps-script/Code.gs` into the script project →
   Deploy → **Manage deployments** → edit the existing Web App deployment →
   **New version** → Deploy. (Editing the existing deployment keeps the same
   `/exec` URL, so no frontend change is needed.)
2. **Frontend**: update `src/App.tsx` in CodeSandbox → let Netlify rebuild.
3. Deploy order is safe either way (frontend degrades gracefully on the old
   backend). Redeploying the backend first is recommended.

## Known ceiling / recommended next step

Even fully hardened, consumer Apps Script + Drive has a hard concurrency ceiling
that synchronized hourly bursts across ~200 stores can still approach. The
durable fix is to move file storage + data to **Supabase** (Postgres + Storage):
direct browser uploads, atomic inserts, RLS-scoped dashboard reads, and no
30-execution limit. That is scoped as a follow-up, not part of this round.

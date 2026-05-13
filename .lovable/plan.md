## What I found

- Edge function logs for `heygen-generate-video` only show boot lines — no `console.error` or `console.log` from any submit attempt was captured.
- `generation_logs` for your user is empty, which means the submit never reached the insert step (it happens *after* a successful HeyGen response). So either:
  1. HeyGen returned a non-OK response and we returned 502 without logging it visibly, **or**
  2. The function aborted at our 60s `AbortController` timeout and returned 504, **or**
  3. The browser's `supabase.functions.invoke` call itself timed out / dropped before the function replied.
- The dialog "reset to original" matches the client `catch` branch firing — `toast.error(e.message)` would briefly appear and then submit/polling state both go false.
- Separately, the console is flooded with Postgres `57014 statement timeout` errors on `/rest/v1/stories` — that's the community-shelf load, unrelated to video, but it confirms the backend is under load right now.

## Plan — instrument and surface the actual cause

Goal: next attempt produces a clear error message in the UI **and** persistent logs you can read.

### 1. `supabase/functions/heygen-generate-video/index.ts`
- Add `console.log` at the top of the submit branch with: storyId, scene count, dimension, payload size in bytes.
- Log right before and right after the HeyGen `fetch` with elapsed ms.
- On the `AbortError` path, return a structured 504 with `{ error: "HeyGen submit timed out after 60s", elapsed_ms }`.
- On non-OK responses, log full `res.status`, `res.headers.get("x-trace-id")` if present, and the raw body (already done — verify it surfaces).
- Increase the internal AbortController timeout from 60s → 120s (HeyGen v2 generate can be slow when it has to fetch many large background images).
- Add a `console.log("submit ok", { video_id })` before returning success.

### 2. `src/components/GenerateVideoDialog.tsx`
- In the `catch` of `handleGenerate`, also `console.error(e)` with the full error object so it lands in the browser console next time, and show the `heygen_status` / `heygen_body` from the function's JSON response in the toast (currently we only show `e.message` which truncates).
- Make the toast `duration: 10000` so it doesn't disappear before you can read it.

### 3. After deploying
- You retry "Generate".
- I'll re-pull edge function logs and the browser console to read the exact HeyGen failure (status code + body) and tell you whether it's:
  - a quota/billing issue on HeyGen,
  - an image-URL fetch failure on HeyGen's side (signed URL expired / not reachable),
  - or a function/runtime timeout.

### Out of scope for this plan
- I'm **not** switching to the async-job pattern (DB row + background `EdgeRuntime.waitUntil` + client polling) yet — that's the real fix if the submit itself is what's timing out, but let's confirm the cause first with the logging above before doing that larger refactor.
- I'm not touching the unrelated `stories` query timeout.

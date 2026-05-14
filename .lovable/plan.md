# Add Standard Pause Between Pages in HeyGen Video Generation

## Goal
Add a configurable pause duration that is applied to every page/scene in the HeyGen-generated video, so each image stays on screen for a silent beat after the narration finishes.

## Changes

### 1. UI — `GenerateVideoDialog.tsx`
- Add a `pauseDuration` slider state (default `0`, range `0–5` seconds, step `0.5`).
- Place the slider in the existing 2-column settings grid (e.g., below **Speed**).
- Pass `pauseDuration` in the request body to the `heygen-generate-video` edge function.

### 2. Backend — `supabase/functions/heygen-generate-video/index.ts`
- Read `pauseDuration` from the request body (clamp to `0–10`).
- Append `pause: { duration: pauseDuration }` to every object in the `video_inputs` array before submitting to HeyGen.

### 3. Deploy
- Re-deploy the `heygen-generate-video` edge function so the new field is honored.

## Technical Notes
- HeyGen v2 API supports a `pause` object (with a `duration` in seconds) inside each `video_input`. This keeps the background image visible while the avatar is silent.
- Because the avatar is already scaled to `0.001` and offset off-canvas, the pause is effectively a silent hold on the current background image.
- No database schema changes are needed.

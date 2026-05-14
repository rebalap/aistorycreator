## Problem

The 2-second pause is being submitted but HeyGen ignores it. Our edge function adds `pause: { duration }` to each `video_inputs[]` entry, but HeyGen v2's `video_inputs` schema has no `pause` field at the scene level — that property is silently dropped, which is why the rendered video has no gaps between pages.

## Fix

Insert pauses as their own scenes between page scenes using HeyGen's supported **silence voice** (`voice.type = "silence"`), which is the documented way to produce a quiet gap of N seconds in v2.

### Changes in `supabase/functions/heygen-generate-video/index.ts`

1. Stop adding the unsupported `pause: { duration }` field to each scene.
2. After building the `video_inputs` array, when `pauseDuration > 0`, splice a silence scene **between** every pair of consecutive scenes (not after the last one). Each silence scene reuses the previous scene's background image and the placeholder avatar, with:
   ```
   voice: { type: "silence", duration: pauseDuration }
   ```
3. Cap the total scenes (silences included) at `MAX_SCENES` (20) — if adding silences would exceed, drop trailing silences first, then trailing page scenes, so we never silently truncate page content unexpectedly. Log when we trim.
4. Clamp `pauseDuration` to HeyGen's allowed silence range (1.0–100.0s); if the user passes 0, do not insert silences. Update the existing clamp accordingly.

### Verification

- Submit a test video with `pauseDuration: 2`, confirm `video_inputs.length === 2*scenes - 1` in the submit log.
- Poll status until completed and verify the rendered video has ~2s gaps between pages.

No frontend changes required — `GenerateVideoDialog` already sends `pauseDuration`.

### Files

- `supabase/functions/heygen-generate-video/index.ts`

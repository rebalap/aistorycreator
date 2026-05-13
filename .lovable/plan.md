## Problems

1. HeyGen receives the raw Gemini image (left half only), not the full 1920×1080 page that `Download` produces (image left, text right on cream background).
2. The avatar character appears in every scene; you have to delete it manually in HeyGen.

## Plan

### 1. Send the full composited page to HeyGen

Reuse the same canvas composition that `handleDownload` already uses in `src/pages/Index.tsx` (lines ~590–691) — image on left, text on right.

- Extract `renderPageToBlob` (and the cover equivalent) into a small shared helper `src/lib/renderStoryPage.ts` so both Download and the video flow use identical output.
- In `GenerateVideoDialog.handleGenerate`, before invoking the edge function:
  1. For each page (and cover if `includeCover`), render the composite blob on the client.
  2. Upload each blob to the existing `story-images` bucket under `video-frames/{storyId}/{pageNumber}-{ts}.png` (public bucket, so HeyGen can fetch).
  3. Build `framesByPage: { pageNumber: publicUrl }` and `coverFrameUrl`, send them in the invoke body.
- In `supabase/functions/heygen-generate-video/index.ts`:
  - Accept optional `framesByPage` and `coverFrameUrl` in the submit body.
  - When present, use those URLs as the scene `background.url` instead of `story.cover_image_url` / `page.image_url`.
  - Fall back to the raw image URL if a frame is missing (defensive).

Show a small `Preparing pages…` progress message in the dialog while uploading.

### 2. Remove the avatar from the video

HeyGen v2 `video/generate` requires a `character` in each `video_input`. To produce a video that visually has no avatar, switch the character to an audio-only mode by:

- Replacing each scene's `character` with `{ type: "avatar", avatar_id, avatar_style: "normal", scale: 0.0001, offset: { x: -10, y: -10 } }` is unreliable.
- Better: use HeyGen's documented audio-only path — set `video_inputs[].character` to a minimal placeholder and use `dimension` + `background` + `voice` only by omitting the avatar layer. Per HeyGen v2 docs the character object is required, but `scale: 0` with `offset` outside the frame is rejected.
- Cleanest path that actually works: drop the avatar selector from the UI, and on the server build the payload with **no `character`** and add `"caption": false`. HeyGen accepts this when you pass a `voice` block that includes `voice_id` and `input_text`; the resulting render is background + narration only. If HeyGen rejects the payload, retry with a synthetic 1×1 transparent `talking_photo` placeholder positioned off-canvas (`scale: 0.001, offset: { x: 1, y: 1 }`) so it's invisible.

UI changes:
- Remove the entire "Avatar (small corner narrator)" picker and `avatarId` requirement from `GenerateVideoDialog.tsx`.
- Remove `avatarId` from the request body.
- The edge function no longer requires `avatarId`.

### 3. Out of scope

- Not changing storage bucket, RLS, or the polling / status flow.
- Not changing the download composition itself — only sharing it.

## Technical notes

- Composited frames are 1920×1080 PNGs (~500KB–1.5MB each). At 20 max scenes that's ≤30MB upload — acceptable; uploads run in parallel with `Promise.all` and a concurrency cap of 4.
- Frames are uploaded under a `video-frames/{storyId}/` prefix so they're easy to clean up later if needed.
- The edge function's payload size is unaffected (URLs only, not blobs).

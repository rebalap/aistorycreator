## Goal

Update Generate Video defaults and add directional slide options (HeyGen `slide_left`, `slide_right`, `slide_up`, `slide_down`), defaulting to `slide_left`.

## Changes

### 1. `src/components/GenerateVideoDialog.tsx` — defaults + directional slide UI

- `useState` defaults:
  - `speed` → `0.8` (was `1`)
  - `styleTemplate` → `"classic"` (was `"playful"`)
  - `transition` → `"slide_left"` (was `"fade"`)
- Widen the `transition` state type to:
  `"cut" | "fade" | "slide_left" | "slide_right" | "slide_up" | "slide_down"`
- Replace the single `slide` option in the Transition `Select` with four directional items:
  - Cut
  - Fade
  - Slide Left  (`slide_left`)
  - Slide Right (`slide_right`)
  - Slide Up    (`slide_up`)
  - Slide Down  (`slide_down`)

### 2. `supabase/functions/heygen-generate-video/index.ts` — accept new transition values + forward to HeyGen

- Update the `SubmitBody.transition` type to include `slide_left | slide_right | slide_up | slide_down`.
- Add scene-level `transition` to each non-final `video_inputs[]` entry inside `buildSceneInput` / the assembly loop:
  ```ts
  // attach to every scene EXCEPT the last; HeyGen applies the transition
  // between this scene and the next.
  if (i < scenes.length - 1) {
    sceneInput.transition = { type: body.transition ?? "slide_left" };
  }
  ```
  (Silence pause scenes get the same treatment so the slide plays into the next page.)
- Log the chosen transition once at submit time for debugging.

### Notes

- `slide_left` is the user-confirmed HeyGen value. The other three directions follow HeyGen's standard naming (`slide_right`, `slide_up`, `slide_down`). If HeyGen ignores any of them at runtime, we'll see it in the submit log and can narrow the dropdown.
- HeyGen historically silently ignores unknown scene-level fields (same behavior we already saw with `pause`), so the worst case is "no transition applied" — no submit failure.
- Verification: submit a 3-page video with `slide_left`, check edge-function logs for the transition payload, confirm the rendered video shows a left slide between pages.

### Files

- `src/components/GenerateVideoDialog.tsx`
- `supabase/functions/heygen-generate-video/index.ts`
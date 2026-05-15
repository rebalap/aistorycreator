## Goal

Make `/shelf` (My Stories + Community) load noticeably faster. Full story content (pages, images, translations) should only load when a story is opened — which is already the behavior, but the list queries currently pull a lot of unused data.

## What's slow today

In `src/hooks/useStories.tsx` `fetchStories()`:
1. `select("*")` on `stories` returns every column for every row, including `background_image_urls` (array of full URLs), `character_image_url`, `video_url`, `video_thumbnail_url`, `heygen_video_id`, `title_en/ar/te`. None of these are used by `StoryCard`.
2. Community query fetches up to 100 rows with the same wide `select("*")`.
3. `profiles` query pulls every profile row instead of only the user_ids actually shown.

In `src/pages/Shelf.tsx`:
4. After stories arrive, a second round-trip fetches every `story_pages` row (just the `story_id` column) for all stories to compute page counts. With 363 pages this is fine now but grows linearly.
5. Every navigation back to `/shelf` re-runs all of the above from scratch — no caching.

## Changes

### 1. Trim `stories` select to only what cards need
`src/hooks/useStories.tsx` — replace `select("*")` in both the own-stories and community queries with:
```
id, user_id, title, cover_image_url, updated_at, created_at, language
```
Keep `select("*")` only inside `getStoryWithPages` (used when opening a story). Update the realtime handler to merge partial payloads into existing rows instead of replacing them.

### 2. Only fetch profiles for the user_ids we'll display
After the two story queries resolve, build the union of `user_id`s and pass `.in("id", ids)` to the profiles query. Avoids returning every profile in the database.

### 3. Replace per-page count query with one aggregated call
`src/pages/Shelf.tsx` — instead of `select("story_id")` over all pages and counting client-side, create a Postgres RPC `get_story_page_counts(story_ids uuid[])` that returns `(story_id, count)` using a `GROUP BY`. One small response instead of one row per page. (Acceptable fallback if RPC creation is undesired: keep client-side count but only run it once stories are visible.)

### 4. Cache shelf data across navigations
The project already has `@tanstack/react-query` mounted. Convert `useStories` to use `useQuery` keyed by `user.id` with a `staleTime` of ~30s, so returning to `/shelf` from the editor renders instantly from cache while a background refetch runs. Realtime subscription stays as-is and updates the cache via `queryClient.setQueryData`.

### 5. Confirm "open story" path is unchanged
`getStoryWithPages` already loads the full story + pages on demand — no change needed. This plan ensures that's the only place heavy data is fetched.

## Out of scope

- No UI/visual changes to `StoryCard` or shelf layout.
- No changes to editor, autosave, or video generation flows.
- No pagination of community stories yet (current 100-row cap is fine after the column trim); can revisit if growth requires it.

## Expected impact

Payload for the initial shelf request drops from ~all columns × 139 rows to ~6 small columns × 139 rows. Profiles response drops from full table to only displayed authors. Returning to `/shelf` from the editor becomes instant due to React Query cache.

## Performance Optimization Plan

### Issues found

1. **Shelf page page-count N+1**: `Shelf.tsx` loops over every story (own + community) and runs a separate `story_pages` count query for each. With 50 stories that's 50 round-trips.
2. **`useStories` fetches every community story**: pulls ALL stories from every user with no pagination/limit. Will degrade as the table grows.
3. **`useUsageStats` double query**: runs a `count` query and then a separate `select story_id` query on `generation_logs` — can be a single query.
4. **Missing DB indexes** on hot filter columns:
   - `stories.user_id` (used in every fetch + RLS-style filters)
   - `stories.updated_at` (used in `ORDER BY` for both lists)
   - `story_pages.story_id` already covered by unique key — OK.
   - `generation_logs(user_id, story_id)` composite for stats.
5. **Realtime subscription** in `useStories` only listens to the current user's stories but the Shelf also shows community stories — those won't update live (minor, optional).

### Changes

**Database (migration)**
- Add indexes:
  - `idx_stories_user_id` on `stories(user_id)`
  - `idx_stories_updated_at` on `stories(updated_at DESC)`
  - `idx_generation_logs_user_story` on `generation_logs(user_id, story_id)`

**`src/pages/Shelf.tsx`**
- Replace the per-story count loop with a **single** query:
  ```ts
  supabase.from("story_pages").select("story_id").in("story_id", allIds)
  ```
  then tally counts client-side in one pass. One round-trip instead of N.

**`src/hooks/useStories.tsx`**
- Limit community stories to the most recent 100 (`.limit(100)`) to bound payload.
- Select only the columns Shelf actually renders (`id, user_id, title, cover_image_url, updated_at`) instead of `*` for the list views — keeps payload small. Detail view (`getStoryWithPages`) keeps `*`.

**`src/hooks/useUsageStats.tsx`**
- Collapse the two queries into a single `select("story_id")` and derive both `totalGenerations` (length) and `storiesWithGenerations` (unique set) from one response.

### Out of scope
- No UI changes.
- No changes to edge functions or auth.
- Realtime for community stories left as-is unless you want it.

### Technical notes
- All index creates use `IF NOT EXISTS`, no destructive changes.
- Column-narrowed selects keep `Story` type compatible because optional fields stay `undefined`.

# Fix "Cannot coerce the result to a single JSON object" on save

## Root cause
The story you're editing (`Taking turns in games`) was created by another user. The current RLS UPDATE policies on `stories` and `story_pages` only allow the **owner** to update:

```
USING (auth.uid() = user_id)
```

So when you switch to Arabic and autosave/save runs `UPDATE … RETURNING *`, the database returns **0 rows** (filtered by RLS). The client uses `.single()`, which then throws PGRST116 — `Cannot coerce the result to a single JSON object`.

This contradicts the project rule: *"Any authenticated user can edit any story, but only the owner can delete."*

## Plan

1. **Migration** — relax the UPDATE policies so any authenticated user can edit:
   - `stories`: drop `Users can update own stories`, create `Authenticated users can update all stories` with `USING (true) WITH CHECK (true)`.
   - `story_pages`: drop `Users can update own story pages`, create `Authenticated users can update all story pages` with `USING (true) WITH CHECK (true)`.
   - Same for INSERT on `story_pages` (currently owner-only), so non-owners can also add/replace pages during save. Keep INSERT on `stories` owner-only (creating a new story is still a personal action).
   - DELETE policies stay owner-only (unchanged).
2. **No client code changes needed** — `updateStory`/`saveStoryPages` will simply succeed once the policy lets the row through.

## Out of scope
- No UI changes, no autosave/editor logic changes, no shelf changes.
- Delete behavior unchanged (still owner-only).

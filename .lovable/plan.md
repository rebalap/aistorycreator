

## Plan: Two Shelves with Community Story Editing

### Overview

Add a tabbed interface on the Shelf page: "My Stories" (current behavior) and "Community" (all stories from all users). Users can open and edit any community story.

### 1. Database Changes — RLS Policy Updates

**Table: `stories`**

Current policies only allow users to access their own stories. We need to add:
- A new SELECT policy allowing all authenticated users to read all stories
- A new UPDATE policy allowing all authenticated users to update any story

We will replace the existing restrictive SELECT/UPDATE policies:

```sql
-- Allow all authenticated users to view all stories
DROP POLICY "Users can view own stories" ON public.stories;
CREATE POLICY "Authenticated users can view all stories"
  ON public.stories FOR SELECT TO authenticated
  USING (true);

-- Allow all authenticated users to update any story
DROP POLICY "Users can update own stories" ON public.stories;
CREATE POLICY "Authenticated users can update all stories"
  ON public.stories FOR UPDATE TO authenticated
  USING (true);
```

Keep INSERT (own only) and DELETE (own only) as-is — users should only create and delete their own stories.

**Table: `story_pages`**

Same pattern — open SELECT and UPDATE to all authenticated users:

```sql
DROP POLICY "Users can view own story pages" ON public.story_pages;
CREATE POLICY "Authenticated users can view all story pages"
  ON public.story_pages FOR SELECT TO authenticated
  USING (true);

DROP POLICY "Users can update own story pages" ON public.story_pages;
CREATE POLICY "Authenticated users can update all story pages"
  ON public.story_pages FOR UPDATE TO authenticated
  USING (true);

-- Also need INSERT for saving pages on others' stories
DROP POLICY "Users can create own story pages" ON public.story_pages;
CREATE POLICY "Authenticated users can create all story pages"
  ON public.story_pages FOR INSERT TO authenticated
  WITH CHECK (true);

-- Keep DELETE open too since saveStoryPages deletes then re-inserts
DROP POLICY "Users can delete own story pages" ON public.story_pages;
CREATE POLICY "Authenticated users can delete all story pages"
  ON public.story_pages FOR DELETE TO authenticated
  USING (true);
```

### 2. Hook Changes — `useStories.tsx`

Add a `fetchAllStories` function that queries all stories without the `user_id` filter. Add state for `communityStories` and expose it. Return both `stories` (user's own) and `communityStories` (all others).

### 3. UI Changes — `Shelf.tsx`

- Add tabs using Radix Tabs component: "My Stories" and "Community"
- "My Stories" tab shows current behavior (user's own stories, with delete option)
- "Community" tab shows all other users' stories (no delete option, only open/download)
- Search filters within the active tab

### 4. StoryCard Adjustments

- Add an optional `hideDelete` prop to `StoryCard` to hide the delete option for community stories (since users can only delete their own)

### Files to Modify
1. **Database migration** — Update RLS policies on `stories` and `story_pages`
2. **`src/hooks/useStories.tsx`** — Add `fetchAllStories`, `communityStories` state
3. **`src/pages/Shelf.tsx`** — Add tabs for My Stories / Community
4. **`src/components/StoryCard.tsx`** — Add `hideDelete` prop


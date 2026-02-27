

## Remove Authentication Requirement

Make the app publicly accessible so anyone can use the story creator without signing in. The app will work as a portfolio piece.

### Changes

**1. `src/pages/Index.tsx`**
- Remove the auth redirect (`useEffect` that navigates to `/auth` when not logged in)
- Remove the Sign In / Sign Out buttons from the header
- Make save functionality gracefully handle unauthenticated users (show a toast saying "Sign in to save" or just disable save)
- Keep `useAuth` import for optional features but don't gate the editor behind it

**2. `src/pages/Shelf.tsx`**
- Remove the auth redirect that navigates to `/auth`
- Remove the sign out button or make it conditional
- Allow browsing community stories without login

**3. `src/App.tsx`**
- Keep the `/auth` route available (users can still optionally sign in to save stories) but it won't be forced

### What stays
- The Auth page remains accessible at `/auth` for users who want to sign in to save stories
- `useAuth` hook and `AuthProvider` remain so logged-in users still get save/load functionality
- Edge functions keep their auth checks (generation works without user auth since the edge functions use the anon key)

### What gets removed
- Forced redirects to `/auth` from Index and Shelf pages
- Sign In button in the header (replaced with nothing, or optionally a subtle "Sign in to save" link)
- Sign Out button when not needed

### Technical Details

**`Index.tsx` changes:**
- Delete lines 175-180 (auth redirect useEffect)
- Lines 1024-1035: Remove the auth button block (Sign In / Sign Out), or make save-related buttons conditional on `user` being present
- Line 251-254: Instead of redirecting to auth, show a toast "Sign in to save your stories"

**`Shelf.tsx` changes:**
- Delete lines 20-24 (auth redirect useEffect)
- Make sign out button conditional on `user` being present


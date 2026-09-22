# Create a Product Requirements Document (PRD)

## Goal
Produce a detailed requirements document for the AI Story Creator app, delivered as a Word (.docx) file in Files, based on the features actually implemented in the product.

## Document structure

1. **Overview** — product purpose, target users (families/educators creating illustrated children's stories), key value props.
2. **Functional requirements**
   - **Authentication** — email sign-up/sign-in, Google OAuth, remember-me, default route to `/auth` for signed-out users.
   - **Story editor** — page-by-page text entry, AI page image generation (8:9 portrait), character/background reference image upload for consistency, per-page image editing via AI.
   - **Cover page** — 16:9 AI-generated cover, composited title overlay with customizable font, size, color, position; cover setup panel; cover download (individual or bulk).
   - **Multilingual support** — English, Arabic (RTL, Noto Naskh), Telugu (Noto Sans Telugu); per-language text/title caching in DB (`text_en/ar/te`, `title_en/ar/te`); on-demand translation with stale-cache invalidation.
   - **Save system** — 2s local debounce autosave, 30s database autosave, smart save flow for new vs existing stories, `?new=true` clean-slate mode, unsaved-changes warning.
   - **Shelf & community shelf** — story cards with page counts, community sharing (any authenticated user can edit, owner-only delete), optimized lazy loading of full story on open.
   - **Video generation (HeyGen)** — voice picker filtered by language, speed (default 0.8x), style (Classic), slide-left transition, 2s pause between pages via silence scenes, WYSIWYG narration in selected language, composited 1920×1080 frames matching the Download output, video URL saved to `stories.video_url` (not stored in app storage).
   - **Usage tracking** — generation logs, quota checks, 402 redirect on credits exhausted.
   - **Offline support** — real-time offline banner.
3. **Non-functional requirements** — performance (lazy shelf loading, indexes, query caching), security (RLS, owner-only delete, edge function auth, input validation, HIBP), multi-device sync.
4. **Business rules** — e.g. shared-editing model, image constraints (no text in AI images, aspect ratios), base64 conversion before AI calls.
5. **Out of scope / known limitations** — avatar required in HeyGen scenes (hidden placeholder), public image bucket by design.

## Format
- Word document (.docx), US Letter, styled headings, tables for requirement IDs (e.g. FR-01…), saved to Files.

## Technical details
- Built with docx-js; validated after generation; content sourced from implemented features (memory + codebase), not aspirational items.

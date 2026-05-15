## Revert Top Bar & Remove Template Video Generation

### What changed
Recently added:
1. A **DropdownMenu** on "Generate Video" with two options: "Custom (Scenes)" and "Quick (Template)".
2. A new dialog component `GenerateVideoTemplateDialog.tsx` for the template flow.
3. A `mode: "template"` branch in the `heygen-generate-video` edge function.
4. Imports for `DropdownMenu`, `ChevronDown`, `Wand2`, and `GenerateVideoTemplateDialog` in `Index.tsx`.

### What to revert
- `src/pages/Index.tsx`:
  - Replace the "Generate Video" **DropdownMenu** with the original **single Button** that opens `GenerateVideoDialog`.
  - Remove imports: `GenerateVideoTemplateDialog`, `DropdownMenu`/`DropdownMenuContent`/`DropdownMenuItem`/`DropdownMenuTrigger`, `ChevronDown`, `Wand2`.
  - Remove `showVideoTemplateDialog` state and its setter.
  - Remove the `GenerateVideoTemplateDialog` JSX mount.
  - Keep all other UI exactly as-is (subtitle text, save status chips with text labels, usage stats, etc.).

- `supabase/functions/heygen-generate-video/index.ts`:
  - Remove the entire `mode === "template"` branch (lines ~185–274).
  - Remove `mode` from the `SubmitBody` interface.

- Delete `src/components/GenerateVideoTemplateDialog.tsx` entirely.

### What stays untouched
- The existing "Custom (Scenes)" video generation flow.
- All save/autosave logic.
- All other header buttons (My Shelf, Save, Download All, Reset, Sign out).
- `HEYGEN_TEMPLATE_ID` secret can remain in secrets; it simply won't be read.
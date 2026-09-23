# UX Contract

## Product context

- Audience: desktop Markdown authors.
- Primary jobs: create, open, edit, save, organize, and export local Markdown documents.
- Target markets: global desktop users.
- Active locales: simplified Chinese and English.
- Accessibility target: WCAG 2.2 AA where webview and platform APIs permit.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Product capabilities | `README.md` | Maintained product documentation | 2026-09-21 |
| File lifecycle | `src/store/app.ts`, `src-tauri/src/cmd/file.rs` | Current implementation contract | 2026-09-21 |
| Local preferences | `src-tauri/src/db/mod.rs` | Current storage contract | 2026-09-21 |

No separate PRD, ADR, permission policy, retention policy, billing flow, or legal-copy source is currently maintained in the repository.

## Visual contract

- Project `DESIGN.md`: `DESIGN.md`.
- Token ownership: existing runtime tokens are canonical; `DESIGN.md` mirrors them.
- Runtime sources: `src/theme/style`, `src/theme/index.ts`, and `src/styles.css`.
- Supported themes: light, dark, and schema-valid custom themes.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Scrollbar | Element Plus editor/sidebar scroll surfaces | `src/components/Layout.vue`, `src/components/Folder.vue` | geometry exceptions | desktop smoke test |
| Toast/notification | Tauri notification and dialog plugins | shared menu/store actions | success / error | desktop smoke test |
| Document transition | `useAppStore.guardUnsavedChanges` | `src/store/app.ts` | save / discard / cancel Save As | unit + desktop flow |
| File mutation | `useAppStore.save` and Rust `save_md` | frontend store + Tauri command | existing path / Save As | unit + integration |
| Large-file editing | `useEditorStore` segmented document model | `src/store/editor.ts` | current-segment WYSIWYG | build + desktop smoke test |

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| New document | File menu | unsaved guard | blank editor | title resets | current document remains | editor | `src/store/menu.ts` |
| Open document | picker, recent item, folder item | unsaved guard + loading | selected document | title/path update | current document remains | editor | menu/folder stores |
| Save | menu, shortcut, auto-save | one serialized save | current editor | saved state | document remains dirty; error dialog | editor | `src/store/app.ts` |
| Navigate large file | segment bar buttons or user scrolling at an edge, according to preference | commit current segment, reset segment history | adjacent WYSIWYG segment | segment position updates | current segment remains visible | editor | `src/store/editor.ts` |
| Close/quit | window or menu | unsaved guard | application/window closes | platform close | cancellation keeps window open | editor | `src/store/app.ts` |

## Navigation and responsive behavior

- Document title reflects the active file path.
- The editor is the focus destination after opening, cancelling, or completing an editing action.
- Sidebar selection must not replace an unsaved document without the canonical transition guard.

## Overlays and feedback

- Dialog primitive: Tauri dialog plugin.
- Unsaved changes: Save is the safe path; Discard is explicit. Cancelling the Save As picker cancels the pending transition.
- Save failure: retain dirty state, preserve editor contents, log the error, and show a localized error dialog.

## Async and resilience

- File saves are pessimistic and serialized; only the revision actually written may become saved.
- Files at or above 512 KiB are split at safe Markdown block boundaries. Only the current segment enters the WYSIWYG document; untouched segments retain their original Markdown and are joined during save.
- Segment navigation commits an edited segment before loading the next one and resets editor plugin history so Undo cannot cross document segments.
- Segment navigation defaults to Previous/Next buttons. The alternate setting switches on a downward scroll at the bottom or an upward scroll at the top. It responds to wheel, touch, Page Up/Down, and scrollbar input, not programmatic editor scrolling; it is saved across windows. The next segment opens at its top, and the previous segment opens at its bottom.
- Auto-save waits 600ms after the latest edit and shares the manual-save queue.
- Duplicate saves wait for the active save instead of racing it.
- Failed and cancelled saves never permit a guarded document transition.
- Rust writes stage and sync complete content before replacing the target, retaining a backup during replacement.

## Validation

- Tauri command responses are checked for both transport failure and non-zero response codes.
- Malformed image data/configuration returns an error instead of panicking.
- File picker cancellation is a normal, non-error state.

## Verification

- Required commands: `yarn build`; Rust formatting/test compile when a Rust toolchain is installed.
- Canonical sibling flows: recent-file open and folder-file open.
- Required desktop matrix: new/open/recent/folder/close/quit with saved, unsaved-save, unsaved-discard, Save As cancellation, save failure, and auto-save states.

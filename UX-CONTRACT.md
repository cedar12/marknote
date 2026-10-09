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
| File lifecycle | `src/store/app.ts`, `src-tauri/src/cmd/file.rs` | Current implementation contract | 2026-10-08 |
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
| Content loading | Shared `v-loading` Skeleton directive | `src/directives/loading` | document / compact folder; animated / reduced motion | browser loading lifecycle + theme checks |
| Image export | `useImageExportStore` and static document renderer | `src/store/imageExport.ts`, `src/utils/imageExport.ts`, Rust `export_image` | PNG / JPEG, 1× / 2×, theme / white / PNG transparency | export flow + canvas pixel browser tests + Rust write tests |
| Toast/notification | Tauri notification and dialog plugins | shared menu/store actions | success / error | desktop smoke test |
| Document transition | `useAppStore.guardUnsavedChanges` | `src/store/app.ts` | save / discard / cancel Save As | unit + desktop flow |
| File mutation | `useAppStore.save` and Rust `save_md` | frontend store + Tauri command | existing path / Save As | unit + integration |
| Document outline | `useEditorStore` and `Toc` | `src/store/editor.ts`, `src/utils/outline.ts` | full-document index / current-segment embedded outline | outline tests + browser flow |
| Large-file editing | `useEditorStore` segmented document model | `src/store/editor.ts` | current-segment WYSIWYG | build + desktop smoke test |
| Editor font | `usePreferencesStore` and Editor settings panel | localStorage `editorFontPreferences` + document CSS variables | font categories / installed font name / 12–32px size / restore default | real-browser settings, persistence, sync, error and editor history checks |
| Markdown preferences | `usePreferencesStore` and Markdown settings panel | SQLite `markdown_preferences` JSON + editor runtime | parsing / output / clipboard | unit + browser + Rust module tests |
| Theme management | Theme catalog and Tauri theme commands | app data `themes` directory + immutable bundled resources | built-in / bundled / installed | browser + Rust file lifecycle tests |
| Code-block copy | `CodeBlockWrapper` and Tauri clipboard-manager | node text + desktop clipboard write capability | code / Mermaid source / read-only | component browser flow + desktop smoke test |

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| New document | File menu | unsaved guard | blank editor | title resets | current document remains | editor | `src/store/menu.ts` |
| Open document | picker, recent item, folder item | unsaved guard + loading | selected document | title/path update | current document remains | editor | menu/folder stores |
| Save | menu, shortcut, auto-save | one serialized save | current editor | saved state | document remains dirty; error dialog | editor | `src/store/app.ts` |
| Export image | File > Export > Image | settings dialog, native save picker, render snapshot, write once | current document | notification after confirmed write | settings and original document retained; localized Retry; picker cancellation is silent | editor after closing dialog | `src/store/imageExport.ts` |
| Navigate large file | segment bar buttons or user scrolling at an edge, according to preference | commit current segment, reset segment history | adjacent WYSIWYG segment | segment position updates | current segment remains visible | editor | `src/store/editor.ts` |
| Jump to heading | outline heading click, Enter, or Space | commit current segment, load target segment; prevent concurrent navigation | target heading in the editor | heading selection and scroll into view | localized inline retry message; current document remains | editor | `src/store/editor.ts` |
| Copy code block | button click, Enter, or Space | one clipboard write | current document | localized inline status and copied icon | localized failure status; retry from same button | retain selection and keyboard button focus | `src/extensions/wrapper/CodeBlockWrapper.vue` |
| Change editor font | font select, custom name Enter, size input, Restore default font | disable font controls during save/broadcast | same settings panel and document | live preview and localized saved status | failed local save keeps current value; inline Retry; persisted broadcast failure offers sync Retry | preserve editor content, selection and undo history | `src/store/preferences.ts`, `src/utils/editorFont.ts` |
| Change Markdown setting | switch or list marker select | disable inputs during database read/write | same settings panel and document | localized saved status | retain previous value on failed write; inline Retry; distinguish saved-but-sync-failed | keep input focus and current editor selection/history | `src/store/preferences.ts` |
| Install theme | Install theme file | single JSON picker, validation and copy; prevent duplicate actions | theme list with new installed entry | localized installed status | picker cancellation is silent; local error explains invalid/duplicate/inaccessible file | return to install control | `src/components/preferences/Theme.vue`, `src-tauri/src/cmd/theme.rs` |
| Uninstall theme | removable theme Uninstall button | named native confirmation and deletion; prevent duplicate actions | theme list; current deleted theme falls back to built-in of same type | localized uninstalled status | cancellation retains theme; deletion failure retains selection; post-mutation refresh failure retains success and offers refresh Retry | native dialog restores focus; next available control after removal | theme panel and commands |
| Close/quit | window or menu | unsaved guard | application/window closes | platform close | cancellation keeps window open | editor | `src/store/app.ts` |

## Navigation and responsive behavior

- Document title reflects the active file path.
- The editor is the focus destination after opening, cancelling, or completing an editing action.
- Sidebar selection must not replace an unsaved document without the canonical transition guard.

## Overlays and feedback

- Dialog primitive: Tauri dialog plugin. Theme uninstall names the target and explains the active-theme fallback; Cancel preserves the installed theme.
- Preferences navigation uses keyboard-focusable buttons. Markdown toggles/selects expose labels and hints. Theme selection exposes the current theme through text and `aria-pressed`; protected entries have no uninstall action. Status areas reserve space, and theme previews wrap within the settings scroll surface.
- Unsaved changes: Save is the safe path; Discard is explicit. Cancelling the Save As picker cancels the pending transition.
- Save failure: retain dirty state, preserve editor contents, log the error, and show a localized error dialog.

## Async and resilience

- Editor fonts are validated and remembered with the existing local editor preferences. Startup, native cross-window events, and storage events apply only document CSS variables; application chrome and code font families stay consistent. Custom names identify one installed font and fall back to the system stack. A local save failure retains the current font, while a broadcast failure after persistence is reported as a synchronization failure. Changing typography does not dispatch editor transactions or alter document selection/history. Static image exports inherit the selected document typography.
- Markdown settings are loaded once with retry, saved pessimistically to SQLite, then applied in place and broadcast. Future parsing/output and clipboard behavior read live settings; changed parsing options reindex non-current large-file headings while keeping the current document intact; current content, selection and undo history remain. A broadcast failure after persistence is reported as synchronization failure, never as a failed save.
- Edit-menu and context-menu Paste share the native editor paste pipeline. Pure text obeys the Markdown conversion switch; rich HTML retains its supplied format. If browser clipboard access fails, Tauri text access is used. Empty clipboards are silent, errors retain content/selection with a localized dialog, and a delayed read cannot insert into a document changed during the read.\n- Theme lists are reactive and shared by startup, refresh, and cross-window events. A newer catalog prevents an older read from overwriting it. Install/uninstall applies the completed mutation before refreshing; a refresh failure offers retry without misreporting the mutation as failed. Deleted current themes revert to Light/Dark of the same type in every window.
- Image export snapshots the entire Markdown document, including edited and untouched large-file segments, and renders once into a temporary static surface. Export options are validated and remembered locally after success. The editor content, selection, history, scroll and native window resizability remain untouched. One export may be pending at a time; PNG transparency is unavailable for JPEG. Dimensions are checked before allocating the canvas; oversized or unavailable image resources produce recoverable errors. The selected extension, MIME and encoded bytes must agree, and native save-path confirmation is preserved.
- File saves are pessimistic and serialized; only the revision actually written may become saved.
- Files at or above 512 KiB are split at safe Markdown block boundaries. Only the current segment enters the WYSIWYG document; untouched segments retain their original Markdown and are joined during save.
- The outline indexes headings in every segment without loading the full document into WYSIWYG. Edits refresh the current segment index. Filtering searches folded descendants; clearing restores disclosure states. The filter is transient per sidebar session. Search stays fixed while the remaining outline panel owns its scrollbar.
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
- Theme files are UTF-8 JSON up to 1 MiB, with all schema fields and 14 valid hex colors. Theme IDs use 1–128 ASCII letters/digits/hyphens/underscores, are unique ignoring case, and reserve Light/Dark. Installed files live under the application data directory; uninstall validates the directory, identity and canonical path, rejects links/reparse points, and cannot remove bundled resources.

## Verification

- Required commands: `yarn build`, `yarn test:large-file`, `yarn test:outline`, `yarn test:markdown-preferences`; `yarn test:outline:browser`, `yarn test:preferences:browser`, `yarn test:editor-font:browser`, `yarn test:image-export:browser`, and `yarn test:image-capture:browser` when Playwright and Chromium are available. Rust formatting/test compile when a Rust toolchain is installed.
- Canonical sibling flows: recent-file open and folder-file open.
- Required desktop matrix: new/open/recent/folder/close/quit with saved, unsaved-save, unsaved-discard, Save As cancellation, save failure, and auto-save states.

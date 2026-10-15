---
version: alpha
name: "MarkNote"
description: "A compact, document-first desktop Markdown editor with native-window restraint."
colors:
  primary: "#2e3a62"
  primary-hover: "#334789"
  accent: "#1e9fca"
  surface-light: "#ffffff"
  surface-dark: "#282828"
  text-light: "#3e3e3e"
  text-dark: "#cbcbcb"
  border-light: "#babec1"
  border-dark: "#9b9b9b"
typography:
  sans:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  mono:
    fontFamily: "JetBrainsMono, ui-monospace, monospace"
rounded:
  DEFAULT: "4px"
spacing:
  titlebar-height: "30px"
  sidebar-default-width: "220px"
components:
  editor: {}
  menu: {}
  dialog: {}
  sidebar: {}
---

# MarkNote Design System

## Overview

### Creative North Star

MarkNote should feel like a focused desktop writing surface: the document is visually dominant, while application chrome stays compact and quiet. The expressive signature is the live WYSIWYG rendering of Markdown structure, not decorative shell UI.

### Product context and register

- **Audience and primary job:** people writing and maintaining local Markdown documents on Windows, macOS, and Linux.
- **Target markets and evidence:** global desktop distribution with Chinese and English interfaces, as documented in `README.md` and `src/i18n`.
- **Locales:** simplified Chinese and English; new owned interface copy must exist in both locale files.
- **Usage scene:** keyboard-heavy desktop editing, often for long documents and local folders.
- **Register:** product utility.
- **Memorable signature:** Markdown syntax and rendered content coexist in one direct editing surface.
- **Restraint:** file safety, editor focus, and predictable native behavior take priority over animation or decorative effects.
- **Anti-references:** browser-like dashboards, card-heavy layouts, hidden editing state, and transient controls that obscure the document.
- **Token ownership/runtime mapping:** runtime theme objects in `src/theme/style` and CSS variables in `src/styles.css` are canonical. This document mirrors their stable semantic roles; token changes must update both locations together.

## Colors

Light and dark themes preserve the same hierarchy: primary chrome, content surface, readable content text, borders, and cyan interaction accents. Color must not be the sole indicator of saved, disabled, selected, or error state.

Code highlighting follows the active application theme type for built-in and custom themes, including startup, system changes and cross-window events. `src/utils/codeTheme.ts` owns the supported palette catalog and counterpart mapping; `setTheme` owns the reactive active type, and `useEditorStore.activeCodeTheme` supplies the effective palette to layout, previews and export. GitHub, Atom One, NNFX and legacy default/dark use their matching variants. Unpaired palettes fall back to GitHub in the opposite mode and restore the saved choice on switching back. The editor settings show the effective palette and offer only palettes matching the active mode; localStorage `codeTheme` remains the user's saved style choice.

## Typography

Application chrome uses the platform system stack for native rendering across supported operating systems and Chinese/Latin scripts. Editor prose defaults to the same stack at 16px; the shared editor preferences allow system, sans-serif, serif, monospace, or a single installed font name, and a 12–32px body size. `--editorFontFamily` and `--editorFontSize` in `src/styles.css` map to the document surface and static image export; unavailable custom fonts fall back to `--fontFamily`. Code retains the established monospace stack. Controls use sentence-style labels from the active locale.

## Layout

The title bar is 30px and the sidebar defaults to 220px. The editor owns the remaining viewport and its scroll surface. Loading, saving, search, and error states must not resize the document viewport or move primary controls.

## Elevation & Depth

Hierarchy is primarily tonal and border-based. Menus and overlays may use the established translucent surface and border; static editor and sidebar surfaces stay flat.

## Shapes

Menus and compact controls use the established 4px radius. Large pills and decorative cards are outside the product's visual language.

## Components

### Foundational visual states

Interactive controls require clear default, hover, keyboard-focus, active, disabled, busy, and error behavior. Busy state keeps control geometry stable. Unsaved and save-failed states remain recoverable and cannot be communicated only through color.

### Buttons and actions

Use explicit action labels. Destructive choices such as discarding edits are separated from the safe Save path and use the real verb rather than a generic confirmation label.

Mermaid and block math share compact source-toggle and copy buttons above the focused block. Their source editors use the same `hljs` code theme, editor code font, and `src/extensions/wrapper/blockSource.scss` spacing; copy feedback uses the shared `BlockSourceActions` component. Empty math blocks open the source editor for immediate input.
Code blocks use one flat, 4px-radius frame in the selected syntax theme, with a subtle toolbar tint and divider derived from its foreground. Ordinary code keeps its language selector and copy action visible; Mermaid keeps its focused source controls. The toolbar has a stable 34px minimum height and shrinks its language field before the actions. Code source uses equal 12px top/bottom padding, 16px horizontal padding, .875em type and 1.6 line height; the complete block has equal 1em top/bottom margins. Source has no additional preformatted-block margin, so focus and copy feedback cannot move it. Shared preformatted typography in `src/scss/editor.scss` also applies to split preview and export; `CodeBlockWrapper` owns the integrated code frame. Math retains its separate symmetric 14px source padding and toolbar layout.

Block math previews render one native MathML formula. The raw formula source appears only in the dedicated source editor.
Math previews have no hover border. Clicking focuses the block with a collapsed caret and leaves the rendered formula unselected; hidden source keeps DOM focus on the preview. Keyboard focus remains visible, and opening source or an empty formula focuses its editable content.

### Navigation and data display

Opening a recent file, a folder item, or a file picker uses the same document-transition contract. The sidebar remains secondary to the current document.

Document windows reopen at the last closed window's remembered width and height, fitting the current display when required. The sidebar retains its visible/hidden preference and user-selected width. Temporary responsive narrowing preserves the preferred width; restoration does not introduce a new dialog or alter document protection.

Disk conflicts use one persistent, theme-aware notice with Review differences, Reload, Save As and Overwrite. Reload and Overwrite require native confirmations naming the file; pending actions keep the notice geometry stable. The read-only comparison uses line numbers, explicit add/remove symbols and localized partial-result feedback. Folder filters identify their loaded-item scope, with compact empty/error/retry states. Sidebar controls are real buttons; its resize separator exposes keyboard instructions and current width. Titlebar statistics display whole-document word and character quantities, including every large-file segment, without a range badge or selector.

Choose Rendered, Source or Split preview in Preferences > Editor > Editor mode, using the existing labeled settings select and stable save/synchronization feedback. The editing surface has no mode-switch strip. The saved preference is restored on startup and shared across document windows; a busy window applies it after its current operation or input composition ends. Source is the complete Markdown document in a labeled, theme-aware textarea with independent undo, selection and scroll. Split preview shares the code and content typography, remains read-only and stacks vertically in narrow windows; bounded previews identify the visible line range. Source and Split preview statistics count the complete Markdown buffer. Rendered formatting actions explain their disabled state while source is active.

The search sidebar has a labeled document/workspace scope, literal query, case switch, cancellable status and a scrollable list of escaped snippets with file and line/column labels. Whole-document replacement previews examples before explicit confirmation; workspace search remains read-only. Search limits, stale results, skipped files and retries remain visible. Replacement and conflict dialogs trap focus, isolate background controls and return focus to the initiating surface.

### Forms and overlays

Draft recovery reuses the theme-aware Element Plus dialog and overlay level of image export. A compact list shows the document name, original path and localized time. Later is initially focused; Restore copy opens an unsaved copy, and Discard draft requires an explicit inline confirmation. A persistent, compact notice offers review or retry without changing the editor viewport. Recovery and asynchronous operations keep actions visible in narrow or short windows and restore editor focus after closing.

Image export uses a compact, theme-aware Element Plus dialog above the application title bar. Options use labeled radio groups, a bounded document-width control, and JPEG quality; the default 1× resolution prioritizes speed, with explicit 2× output available. Rendering and writing retain the dialog footprint, with localized status and recoverable inline errors.

Settings reuse Element Plus switches, selects, bounded number inputs, and explicit buttons. Editor font controls include a localized live sample and Restore default font, with persistent save/synchronization feedback in the existing settings scroll surface. Group parsing, output, and clipboard settings within the existing desktop scroll surface; use compact labeled theme previews only where choosing colors needs a visual sample. Keep status space stable and identify built-in, bundled, installed, and selected themes in text. Use Tauri/Element Plus application dialogs rather than browser-native alert APIs. Dialog copy is localized and preserves editor focus after cancellation.

### Iconography

Use the existing IconPark family. Icons support text labels for file and editing actions unless the meaning is universally established.

### Motion

Motion is minimal and state-driven. Respect reduced-motion preferences; routine file operations do not need decorative animation.

Content loading uses the shared `v-loading` directive in `src/directives/loading`: document-shaped Skeleton placeholders with a restrained 1.8s shimmer. The document mask stays inside the content viewport and preserves the title bar and sidebar; folder surfaces use the compact variant. Skeleton surfaces derive from `--contentBackgroundColor` and `--contentBackgroundColorActive`, so built-in and custom themes use the same runtime token mapping. Reduced motion shows static placeholders.

### Content and data visualization

Copy is direct and operational. Errors name the failed action and preserve the document so the user can retry.

## Do's and Don'ts

- **Do:** keep the document and its saved state authoritative and visible.
- **Do:** reuse one transition guard for every action that can replace an unsaved document.
- **Don't:** add screen-local save, confirmation, or error behavior.
- **Don't:** trade file safety or keyboard focus for visual novelty.

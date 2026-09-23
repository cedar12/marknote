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

## Typography

Application chrome and prose use the platform system stack for native rendering across supported operating systems and Chinese/Latin scripts. Code uses the established monospace stack. Controls use sentence-style labels from the active locale.

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

### Navigation and data display

Opening a recent file, a folder item, or a file picker uses the same document-transition contract. The sidebar remains secondary to the current document.

### Forms and overlays

Use Tauri/Element Plus application dialogs rather than browser-native alert APIs. Dialog copy is localized and preserves editor focus after cancellation.

### Iconography

Use the existing IconPark family. Icons support text labels for file and editing actions unless the meaning is universally established.

### Motion

Motion is minimal and state-driven. Respect reduced-motion preferences; routine file operations do not need decorative animation.

### Content and data visualization

Copy is direct and operational. Errors name the failed action and preserve the document so the user can retry.

## Do's and Don'ts

- **Do:** keep the document and its saved state authoritative and visible.
- **Do:** reuse one transition guard for every action that can replace an unsaved document.
- **Don't:** add screen-local save, confirmation, or error behavior.
- **Don't:** trade file safety or keyboard focus for visual novelty.

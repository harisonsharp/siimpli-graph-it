# SiimpliGraphIt — Project Guide

## Project Overview

**SiimpliGraphIt** is a scientific data analysis and visualization module, part of the broader **SiimpliMineit** ecosystem. It is built as a cross-platform desktop app (Tauri 2 + React 19 + D3.js) with three operational modes: Manual, Batch Processing, and Filename Decoder.

### Tech Stack
- **Frontend:** React 19, D3.js 7.9, Lucide React icons
- **Desktop:** Tauri 2 (Rust backend, native file system access)
- **Build:** Vite 7
- **Styling:** Pure CSS with custom CSS variables (no CSS framework)
- **Export:** ExcelJS (Excel), PNG via D3/canvas
- **Architecture:** Context API (`ConfigContext`, `ErrorContext`), headless core via `@siimpli/graph-it-core`

---

## Design Context

### Users
Mixed audience of **academic researchers** (scientists analyzing experimental data in labs) and **industrial analysts** (engineers/QA processing measurement data). Users are often familiar with tools like OriginLab, Excel, or MATLAB — they value accuracy and control, but benefit from an interface that doesn't make simple tasks feel complex. The primary job-to-be-done is: **load data → configure a graph → export a publication-ready chart.**

### Brand Personality
**Modern and approachable.** The tool should feel capable without being intimidating. Three words: **Clear. Capable. Trustworthy.** The emotional goal is *confidence* — users should feel the tool is in control and so are they. Avoid looking like legacy scientific software (cluttered, gray, Windows 98-era) but also avoid trendy SaaS aesthetics that feel out of place in a research context.

### Aesthetic Direction
- **Light mode only** — no dark mode planned.
- **Reference:** No single app reference — target a polished, consistent aesthetic that fits the Siimpli brand.
- **Anti-references:** Avoid legacy scientific software (OriginLab, old MATLAB) aesthetics — no heavy chrome, crowded toolbars, or flat gray UI.
- The current blue primary (`#2563eb`) is well-chosen — neutral, professional, accessible.
- Prefer **rounded corners, soft shadows, and generous whitespace** over rigid or dense layouts.
- Typography uses **Inter** (with system-ui fallback) — keep it clean and legible at small sizes since form labels dominate the UI.

### Design Tokens (Source of Truth: `src/App.css`)
```
--primary-color: #2563eb
--secondary-color: #059669 (green)
--warning-color: #d97706
--danger-color: #dc2626
--background-color: #f8fafc
--surface-color: #ffffff
--text-color: #1e293b
--text-secondary: #475569
--text-muted: #64748b
--border-color: #e2e8f0
--border-radius: 12px
--spacing base unit: 8px (xs:4, sm:8, md:16, lg:24, xl:32, 2xl:48)
--transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)
--font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif
```

> **Note:** Several components still use hardcoded colors (`#1976d2`, `#d81b60`, `#333`, Bootstrap reds/yellows). When modifying those components, migrate hardcoded values to CSS variables.

### Design Principles

1. **Data first, chrome second.** The graph is the hero. UI controls should recede — use subtle borders, muted labels, and compact form elements so the visualization gets visual priority.

2. **Approachable complexity.** The app has many configuration options. Surface the essentials first; use progressive disclosure (collapsible sections, secondary panels) to avoid overwhelming new users while keeping power-user features accessible.

3. **Consistent visual language.** Use the established `.card`, `.btn`, `.form-group` patterns throughout. Avoid one-off inline styles. All colors must come from CSS variables — never hardcode hex values in new code.

4. **Trustworthy feedback.** Scientific users need to feel confident the tool is working correctly. Loading states, error messages, and success notifications should be clear, calm, and specific — never vague or alarming.

5. **Desktop-native feel.** The app runs in Tauri (not a browser tab). Interactions should feel snappy (`0.2s` transitions), focus states should be visible and precise, and the layout should comfortably fill a desktop window without excessive max-width constraints.

---

## Component Conventions

- **Cards:** `.card > .card-header + .card-body + .card-footer` — standard container pattern
- **Buttons:** `.btn.btn-{primary|secondary|success|warning|danger|outline}` with `.btn-sm` / `.btn-lg` modifiers
- **Forms:** `.form-group > .form-label + .form-input` — 2px border, blue focus ring
- **Icons:** Lucide React at 16px (inline/compact) or 20–24px (primary actions)
- **Transitions:** Always use `var(--transition)` — never add custom durations
- **Hover lifts:** `translateY(-1px)` + increased shadow — established button/card pattern

## Key Files
- `src/App.css` — all design tokens and global component styles
- `src/components/GraphApp.jsx` — main app shell with mode routing
- `src/components/GraphRenderer.jsx` — D3 rendering orchestration
- `src/components/CurveFittingPanel.jsx` — most recently modified component
- `src/context/` — ConfigContext and ErrorContext
- `src-tauri/` — Rust backend (file system, native dialog bridges)

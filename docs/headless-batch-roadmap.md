# Headless Batch Graph Generation — Roadmap

> **Goal:** Given a JSON config file + one or many CSV files → produce graph images (PNG/SVG) without any UI, browser, or Tauri dependency, runnable from a Node.js CLI or server process.

---

## Current State Assessment

### What Already Works

| Asset | Status | Notes |
|---|---|---|
| **Graph config schema** | ✅ Ready | [graph-config.schema.json](graph-config.schema.json) fully describes the input contract |
| **Rendering primitives** | ✅ Framework-agnostic | `GraphCompositionRenderer`, `ScaleFactory`, all `ChartRenderers`, `LegendRenderer`, `DataTableRenderer`, etc. are pure D3 classes with no React dependency |
| **Validation** | ✅ Usable | `ConfigValidator` + `DataValidator` work in any JS runtime |
| **CSV parsing** | ✅ Usable | `parseCSV()` is a pure function — no browser/Tauri dependency |
| **Batch orchestrator** | ⚠️ Partially usable | `BatchProcessingService` accepts dependency injection, but currently depends on React-produced `generateGraph` and DOM refs |
| **`batchConfigAdapter`** | ✅ Ready | Bridges legacy flat configs to series-array format |

### What Blocks True Headless Execution

| Blocker | Severity | Detail |
|---|---|---|
| **`useGraphRenderer` is a React hook** | 🔴 Critical | The *only* complete rendering orchestrator is wrapped in `useCallback` and expects a React ref (`svgRef.current`). All the pure renderers beneath it are fine, but the glue layer is React-bound. |
| **DOM required for D3** | 🔴 Critical | D3 manipulates `<svg>` elements via standard DOM APIs (`document.createElementNS`, `setAttribute`, `appendChild`). Node.js has no DOM. |
| **PNG rasterization uses browser Canvas** | 🟡 High | `canvas.toBlob()`, `new Image()`, `URL.createObjectURL()` don't exist in Node. Needed only for PNG output (SVG output could bypass this). |
| **File I/O is Tauri-only** | 🟡 High | `readTextFile`, `writeFile` go through Tauri IPC. Must be swapped for Node `fs`. |
| **`HeadlessGraphService` is incomplete** | 🟠 Medium | It re-implements a mini renderer instead of reusing the full pipeline. Missing: dual axes, legends, color grading, contouring, histograms, dynamic sizing, tables, annotations. |
| **No CLI entry point** | 🟠 Medium | No `bin` script, no `main` field in package.json pointing to a headless-safe path. |
| **Config schema not validated at runtime** | 🟡 Low | The JSON schema exists in docs but no code validates input against it. |

---

## Roadmap

### Phase 0 — Foundation & I/O Abstraction *(~2-3 days)*

**Goal:** Decouple file I/O from Tauri so the same code works in Node.js, Tauri, and browser.

| # | Task | Detail |
|---|---|---|
| 0.1 | **Create `IOProvider` interface** | Define `readFile(path): string`, `writeFile(path, data)`, `readDir(path): string[]`, `exists(path): bool`. |
| 0.2 | **Implement `NodeIOProvider`** | Wraps Node `fs/promises`. |
| 0.3 | **Implement `TauriIOProvider`** | Wraps existing `@tauri-apps/plugin-fs` calls (preserves current behavior). |
| 0.4 | **Refactor `FileService`** | Accept an `IOProvider` instead of calling Tauri directly. Keep `parseCSV` as-is (already pure). |
| 0.5 | **Unit tests** | Verify both providers pass identical read/write tests. |

**Deliverable:** `FileService` works identically in Node and Tauri.

---

### Phase 1 — Extract Rendering Orchestrator from React *(~3-5 days)*

**Goal:** Create a pure-function equivalent of `useGraphRenderer.generateGraph()` that accepts plain objects instead of React refs.

| # | Task | Detail |
|---|---|---|
| 1.1 | **Create `renderGraph(svgElement, config, data, options)` function** | Port the orchestration logic from `useGraphRenderer.generateGraph()` into a standalone function in `core/`. Replace every `useCallback` with a plain function call. Accept a raw `SVGSVGElement` instead of a React ref. |
| 1.2 | **Signature design** | `renderGraph({ svg, csvData, graphConfig, globalSettings, curveFits?, logoImage?, colorSchemes? }) → void` — mutates the SVG DOM. |
| 1.3 | **Keep `useGraphRenderer` as a thin wrapper** | Refactor the hook to call `renderGraph()` internally, preserving the existing React API so the UI keeps working with zero regressions. |
| 1.4 | **Integration tests** | Using jsdom, create an `<svg>` element, call `renderGraph()`, and snapshot the output. Verify axes, series groups, and title elements are present. |

**Deliverable:** A single importable function `renderGraph()` with no React, Tauri, or browser dependency beyond standard DOM.

---

### Phase 2 — Synthetic DOM for Node.js *(~2-3 days)*

**Goal:** Make D3's SVG manipulation work in Node.js via jsdom.

| # | Task | Detail |
|---|---|---|
| 2.1 | **Add `jsdom` as a production dependency** of the core package | Already in devDependencies for tests. |
| 2.2 | **Create `DOMEnvironment` utility** | `createSVG(width, height)` → creates a jsdom `document` + root `<svg>` element. `serialize(svg)` → returns clean SVG string via `XMLSerializer`. |
| 2.3 | **Handle `document.createElement('canvas')` calls** | The rendering pipeline uses an offscreen canvas for `ctx.measureText()` in curve-fit legends. Provide a `node-canvas` or `@napi-rs/canvas` shim, or replace with a font-metrics lookup table for text measurement. |
| 2.4 | **Validate all D3 operations** | Run the Phase 1 integration tests under Node with jsdom. Fix any remaining browser-only API calls (e.g., `getBoundingClientRect` → compute from attributes). |

**Deliverable:** `renderGraph()` produces a valid SVG string in pure Node.js.

---

### Phase 3 — SVG & PNG Export in Node.js *(~2-3 days)*

**Goal:** Produce final output files (SVG and PNG) without a browser.

| # | Task | Detail |
|---|---|---|
| 3.1 | **SVG file export** | Trivial — `DOMEnvironment.serialize(svg)` → write to disk via `NodeIOProvider`. This is the fast, lossless path. |
| 3.2 | **PNG rasterization** | Options (choose one): |
|  | a) **`@napi-rs/canvas`** | Fast native Canvas for Node. Replace browser `Image` + `canvas.toBlob()` with `loadImage()` + `canvas.toBuffer('image/png')`. |
|  | b) **`resvg-js`** | Direct SVG→PNG via Rust (no Canvas needed). Simplest integration: `render(svgString) → PNGBuffer`. |
|  | c) **`sharp` + `resvg`** | SVG→PNG via resvg, with sharp for post-processing (resize, watermark). |
| 3.3 | **Watermark overlay** | Port `WATERMARK_CONFIG` tiling logic to work with the chosen rasterizer. Add a `--no-watermark` flag. |
| 3.4 | **`ExportService` refactor** | Abstract browser canvas calls behind a `RasterProvider` interface. Implement `BrowserRasterProvider` (existing logic) and `NodeRasterProvider` (from 3.2). |

**Deliverable:** `exportGraph(svg, format, outputPath)` writes PNG or SVG files on Node.js.

---

### Phase 4 — CLI Entry Point *(~2-3 days)*

**Goal:** A runnable CLI that takes a config JSON + CSV(s) and writes graph(s) to an output directory.

| # | Task | Detail |
|---|---|---|
| 4.1 | **Create `cli/index.js`** | Entry point using `commander` or `yargs`. |
| 4.2 | **Command: `graph-it render`** | |
|  | Flags | `--config <path>` (required), `--data <path|glob>` (CSV file or directory), `--output <dir>` (default: `./output`), `--format <png|svg|both>` (default: `png`), `--width`, `--height`, `--no-watermark` |
|  | Behavior | Reads config → validates against schema → loads CSV(s) → calls `renderGraph()` → exports. |
| 4.3 | **Command: `graph-it validate`** | Validates a config JSON against the schema and reports errors. |
| 4.4 | **Add `bin` field to `package.json`** | `"bin": { "graph-it": "./cli/index.js" }` |
| 4.5 | **Structured output** | Print JSON summary to stdout: `{ graphs: [{ file, status, duration_ms }], total, failed }` |

**Example usage:**
```bash
# Single graph
graph-it render --config graph-config.json --data copper.csv --output ./graphs

# Batch: one config, many CSVs
graph-it render --config graph-config.json --data ./csvs/ --output ./graphs

# SVG output, custom size
graph-it render --config graph-config.json --data copper.csv --format svg --width 1200 --height 800
```

**Deliverable:** `npx @siimpli/graph-it-core render --config ... --data ...` works end-to-end.

---

### Phase 5 — One Config, Many CSVs (Batch Mode) *(~3-5 days)*

**Goal:** The core use case — a single config file applied to a folder of CSVs, producing one graph per CSV (or per CSV×series combination).

| # | Task | Detail |
|---|---|---|
| 5.1 | **Design batch semantics** | Define how config + multiple CSVs interact: |
|  | Mode A: **1 config → N CSVs → N graphs** | Config `dataBindings.datasets[0].file` is treated as a *pattern*; each CSV in the input folder is substituted in. Column IDs like `tc_usd_per_dmt::copper.csv` become `tc_usd_per_dmt::*.csv` (wildcard) or are resolved by column name alone. |
|  | Mode B: **Config matrix** | A `batch` section in the config lists parameter overrides per CSV (e.g., different titles, colors, series). |
| 5.2 | **Extend the config schema** | Add optional `"batch"` top-level property: |
| | | ```json { "batch": { "mode": "per-csv", "dataDir": "./csvs/", "outputDir": "./output/", "filePattern": "*.csv", "overrides": [ { "file": "gold.csv", "graph.title": "Gold Prices" } ] } }``` |
| 5.3 | **Implement `BatchRunner`** | Iterates CSVs, resolves column IDs (stripping `::filename` and re-binding to current file), calls `renderGraph()` per file, collects results. |
| 5.4 | **Parallel execution** | Use `p-limit` or worker threads to render N graphs concurrently. Each jsdom instance is isolated. |
| 5.5 | **Output naming** | Default: `<csv-filename>_<timestamp>.png`. Configurable via template: `{csvName}_{title}_{date}.{ext}`. |
| 5.6 | **Progress reporting** | Emit progress events: `{ current, total, file, status }`. CLI prints a progress bar via `ora` or `cli-progress`. |

**Example:**
```bash
graph-it render --config concentrate-tc.json --data ./concentrates/*.csv --output ./reports/
# Produces: copper.png, zinc.png, lead.png, ... (one per CSV)
```

**Deliverable:** True 1:N batch generation with progress reporting.

---

### Phase 6 — Config Schema Validation & Transformation *(~2 days)*

**Goal:** Runtime validation of the graph-config schema, plus adapters for legacy formats.

| # | Task | Detail |
|---|---|---|
| 6.1 | **Add `ajv` dependency** | JSON Schema validator. |
| 6.2 | **`SchemaValidator.validate(config)`** | Validates against `graph-config.schema.json`. Returns `{ valid, errors }`. |
| 6.3 | **Config version migration** | If a config has no `version` field, assume legacy format → run through `batchConfigAdapter` → wrap in the new schema envelope. |
| 6.4 | **Column ID resolution** | When batch mode rebinds a config to a different CSV, `resolveColumnIds(config, newFileName)` rewrites `"col::old.csv"` → `"col::new.csv"`. |

**Deliverable:** Invalid configs produce clear, actionable error messages before any rendering is attempted.

---

### Phase 7 — Advanced Features *(~5-8 days, parallelizable)*

| # | Feature | Detail |
|---|---|---|
| 7.1 | **PDF export** | Use `pdfkit` or `svg-to-pdfkit` to produce vector PDFs (no raster loss). |
| 7.2 | **Multi-graph pages** | Combine multiple graphs onto a single PDF/PNG sheet (grid layout). |
| 7.3 | **Programmatic Node.js API** | Publish a clean API: `import { renderGraph, createBatch } from '@siimpli/graph-it-core'` for embedding in other Node apps/scripts. |
| 7.4 | **Watch mode** | `graph-it render --watch` — re-renders when config or CSV files change (via `chokidar`). Useful during report authoring. |
| 7.5 | **Config generation from CSV** | `graph-it init --data copper.csv` — auto-generates a starter config by inspecting column types (numeric vs date vs categorical). |
| 7.6 | **Template configs** | Built-in templates: `graph-it render --template timeseries --data prices.csv`. Templates provide sensible defaults for common graph types. |
| 7.7 | **Diff/comparison mode** | Overlay two CSVs on one graph (e.g., actual vs forecast). |

---

## Architecture After Phase 5

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLI (Phase 4)                            │
│  graph-it render --config X --data Y --output Z --format png    │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                ┌──────────▼───────────┐
                │     BatchRunner      │  ← Phase 5
                │  (1 config × N CSVs) │
                └──────────┬───────────┘
                           │  for each CSV:
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
    │ Validate   │  │ Load CSV   │  │ Resolve    │
    │ Config     │  │ parseCSV() │  │ Column IDs │
    │ (Phase 6)  │  │ (existing) │  │ (Phase 6)  │
    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
          └────────────────┼────────────────┘
                           │
                ┌──────────▼───────────┐
                │  DOMEnvironment      │  ← Phase 2
                │  (jsdom + SVG root)  │
                └──────────┬───────────┘
                           │
                ┌──────────▼───────────┐
                │    renderGraph()     │  ← Phase 1 (extracted from useGraphRenderer)
                │                      │
                │  ScaleFactory        │  ── existing, unchanged
                │  GraphComposition    │  ── existing, unchanged
                │  ChartRenderers      │  ── existing, unchanged
                │  LegendRenderer      │  ── existing, unchanged
                │  AnnotationRenderer  │  ── existing, unchanged
                └──────────┬───────────┘
                           │
              ┌────────────┼────────────┐
              │ SVG string │ PNG buffer │
              │ (Phase 3)  │ (Phase 3)  │
              └─────┬──────┘─────┬──────┘
                    │            │
              ┌─────▼────────────▼──────┐
              │   NodeIOProvider        │  ← Phase 0
              │   writeFile(path, data) │
              └─────────────────────────┘
```

---

## Suggested Execution Order

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
  (I/O)    (extract)    (jsdom)    (export)     (CLI)      (batch)
                                                    │
                                                    ├──► Phase 6 (validation)
                                                    └──► Phase 7 (advanced)
```

- **Phases 0-3** are sequential — each builds on the prior.
- **Phase 4** (CLI) is the first user-visible milestone.
- **Phase 5** (batch) is the primary goal.
- **Phases 6-7** can be parallelized or deferred.

---

## Estimated Timeline

| Phase | Effort | Cumulative |
|---|---|---|
| Phase 0 — I/O Abstraction | 2-3 days | 2-3 days |
| Phase 1 — Extract Renderer | 3-5 days | 5-8 days |
| Phase 2 — Synthetic DOM | 2-3 days | 7-11 days |
| Phase 3 — Node Export | 2-3 days | 9-14 days |
| Phase 4 — CLI | 2-3 days | 11-17 days |
| Phase 5 — Batch Mode | 3-5 days | 14-22 days |
| Phase 6 — Schema Validation | 2 days | 16-24 days |
| Phase 7 — Advanced | 5-8 days | 21-32 days |

**MVP (single config + single CSV → PNG):** ~2-3 weeks (Phases 0-4)
**Full batch (one config × many CSVs):** ~3-4 weeks (through Phase 5)

---

## Key Decisions to Make Early

| Decision | Options | Recommendation |
|---|---|---|
| **PNG rasterizer** | `@napi-rs/canvas` vs `resvg-js` vs `sharp+resvg` | **`resvg-js`** — single dependency, SVG→PNG directly, no Canvas complexity, excellent quality. Falls back to `@napi-rs/canvas` only if we need Canvas for text measurement. |
| **Batch column resolution** | Wildcard (`col::*.csv`) vs name-only (`col`) vs explicit override | **Name-only** for batch mode: strip `::filename` suffix, match by column name alone. Override list for edge cases. |
| **Output format default** | PNG vs SVG | **SVG** as default (fastest, lossless, no native deps). PNG on request. |
| **Where does the CLI live?** | In `graph-it-core` vs new `graph-it-cli` package | **In `graph-it-core`** initially (simpler). Extract to a separate package later if the core needs to stay lean. |
| **jsdom scope** | Per-render vs shared | **Per-render** — avoids cross-contamination between batch runs, minimal overhead (~5ms per instance). |

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| `getBoundingClientRect()` not available in jsdom | Text measurement fails → wrong legend/label positioning | Replace with attribute-based calculation or `node-canvas` `measureText()` |
| D3 implicit `document` references | Crash in Node | Create global `document` via jsdom before any D3 import; or use `d3.create('svg:svg')` which works with jsdom |
| Large CSV performance | Slow rendering for 100K+ rows | Stream-parse CSVs, downsample for scatter plots, use Web Workers or Node worker threads for parallel batch |
| SVG font rendering inconsistency | PNG output differs from browser | Bundle a standard font (e.g., Inter) and set it explicitly in SVG styles; or use `resvg-js` with font config |
| Tauri regression in UI app | Refactoring breaks the existing desktop app | Phase 1 keeps `useGraphRenderer` as a thin wrapper around `renderGraph()` — existing API surface is preserved |

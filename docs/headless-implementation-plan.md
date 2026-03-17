# Headless Batch Graph Generation — Definitive Implementation Plan

> **Goal:** JSON config + CSV(s) → graph images (PNG/SVG), no UI, no browser, no Tauri. Runnable from Node.js CLI.
>
> **Audience:** An agentic coding assistant (AI) executing each ticket, with a human developer reviewing at phase gates.

---

## Locked Decisions

All design questions have been resolved. These are final and should not be revisited during implementation.

| # | Decision | Resolution |
|---|---|---|
| D1 | **Column resolution** | Hybrid: default is name-only (strip `::filename`). Also accept `[N]` index syntax (0-indexed) resolved at runtime against the CSV's header row. |
| D2 | **Graphs per CSV** | 1-to-1. One CSV → one graph. Multiple graphs require multiple config runs. |
| D3 | **Batch error handling** | Skip and report. Continue the batch; write `batch-summary.json` with `{ file, status, error }` per input. |
| D4 | **Output format** | Default PNG via `resvg-js`. `--format svg` for SVG. `--format both` for both. |
| D5 | **Watermark** | Applied by default for PNG. `--no-watermark` flag disables. No watermark in SVG output. |
| D6 | **Graph dimensions** | Post-render crop: render onto an oversized canvas, then use `resvg-js`/`sharp` to crop to content bounding box. |
| D7 | **Package structure** | Separate packages from day one: `@siimpli/graph-it-core` (React + UI), `@siimpli/graph-it-headless` (pure Node, no React). Shared rendering primitives live in core; headless imports them. CI/CD automation keeps versions in sync. |
| D8 | **IOProvider pattern** | Injected per call via `options.io`. A `createNodeRuntime()` factory provides pre-configured defaults. |
| D9 | **Logo handling** | Logo rendering enabled from Phase 2. `--logo <path>` reads file, base64-encodes, injects as SVG `<image>`. Config can also embed `logo.dataUri`. |
| D10 | **CLI location** | Starts in `graph-it-core` under `cli/`. May split to `graph-it-cli` later. |
| D11 | **Config → CSV path** | `--data <path\|glob>` overrides config's `file` field. If `--data` is a directory, all CSVs are matched. If omitted, CSV is resolved relative to config file's directory. |
| D12 | **stdin config** | `--config -` reads from stdin. Relative paths resolved from `cwd`. |
| D13 | **Column mismatch** | Hard error on missing `xAxis` (fatal). Soft warning + skip on missing `series[n].yAxis` (partial render). Print available columns in both cases. |
| D14 | **CLI verbosity** | Normal by default (one line per graph + summary). `--quiet` for summary-only. `--verbose` for full debug trace. |
| D15 | **Feature scope** | See MVP Feature Matrix below. |
| D16 | **Curve fits** | Recompute at render time (pure math, no browser deps). Embedded coefficients deferred to later phase. |
| D17 | **PNG rasterizer** | `resvg-js` |
| D18 | **Synthetic DOM** | `jsdom`, per-render instance |
| D19 | **Schema validation** | `ajv` against `graph-config.schema.json` |
| D20 | **Batch concurrency** | `p-limit` |

---

## MVP Feature Matrix

Every feature is classified. The agent must implement "Must have" features within the phase they're first needed. "Nice to have" features are implemented only after all "Must have" items in the phase are green. "Defer" items are not touched.

| Feature | Priority | First Phase |
|---|---|---|
| Scatter / Line / Bar charts | **Must have** | Phase 1 |
| Histogram | **Must have** | Phase 1 |
| Dual Y-axis | **Must have** | Phase 1 |
| Curve fits (trend lines) | **Must have** | Phase 1 |
| Filter expressions per series | **Must have** | Phase 1 |
| Legend rendering | **Must have** | Phase 1 |
| Join X-axis mode | **Must have** | Phase 1 |
| Dual units (USD/dmt ↔ USD/lb) | **Must have** | Phase 1 |
| Unified table (legend + values) | **Must have** | Phase 3 |
| Bias table | **Must have** | Phase 3 |
| Logo injection (SVG `<image>`) | **Must have** | Phase 2 |
| Color grading | Nice to have | Phase 5 |
| Contouring | Nice to have | Phase 5 |
| Confidence intervals on bars | Nice to have | Phase 5 |
| Annotations | Nice to have | Phase 5 |

---

## Development Cycle — How to Use This Plan with an Agent

Every phase below follows the same iterative cycle. This is the workflow the developer and agent repeat for each phase.

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                     PER-PHASE CYCLE                             │
 │                                                                 │
 │  1. ORIENT        Read the phase spec. Identify every file      │
 │                   that will be created or modified.             │
 │                                                                 │
 │  2. SCAFFOLD      Create new files/dirs with stub exports.      │
 │                   Update package.json, index.js exports.        │
 │                   Commit: "phase N: scaffold"                   │
 │                                                                 │
 │  3. TEST-FIRST    Write failing tests for every ticket in the   │
 │                   phase. Tests define the acceptance criteria.   │
 │                   Commit: "phase N: tests"                      │
 │                                                                 │
 │  4. IMPLEMENT     Implement each ticket in sequence until all   │
 │                   tests pass. One commit per ticket.            │
 │                                                                 │
 │  5. INTEGRATE     Run the full test suite (all prior phases).   │
 │                   Fix regressions. Run the UI app if the phase  │
 │                   touched shared code (Phase 1 especially).     │
 │                                                                 │
 │  6. GATE          Human reviews the diff, runs a manual smoke   │
 │                   test, approves. Phase is locked.              │
 │                                                                 │
 └─────────────────────────────────────────────────────────────────┘
```

**Rules for the agent at each step:**

| Step | Agent does | Agent does NOT do |
|---|---|---|
| ORIENT | Read every file referenced in the ticket; list all imports that need changing | Skip ahead to implementation |
| SCAFFOLD | Create directory structures, empty files with JSDoc signatures, update `exports` | Write implementation logic |
| TEST-FIRST | Write unit/integration tests using vitest that assert the ticket's acceptance criteria | Write the production code yet |
| IMPLEMENT | Write production code until tests pass; run `npm test` after each file change | Modify tests to make them pass; change the spec |
| INTEGRATE | Run full `npm test`; search for regressions in shared modules | Proceed if any test fails |
| GATE | Summarize changes, list files modified, print test results | Merge or release |

---

## Phase 0 — New Package Scaffold + I/O Abstraction

**Goal:** Create `@siimpli/graph-it-headless` as a new package. Abstract file I/O away from Tauri.

**New package path:** `siimpli-graph-it-headless/` (sibling to `siimpli-graph-it-core/`)

### Tickets

#### 0.1 — Package skeleton

- **Create:** `siimpli-graph-it-headless/package.json`
  - `name`: `@siimpli/graph-it-headless`
  - `type`: `module`
  - `main`: `src/index.js`
  - `dependencies`: `@siimpli/graph-it-core` (local path or registry), `jsdom`, `resvg-js`
  - `devDependencies`: `vitest`
  - No React in dependencies or peerDependencies
- **Create:** `siimpli-graph-it-headless/src/index.js` — empty, will grow
- **Create:** `siimpli-graph-it-headless/vitest.config.js`
- **Acceptance:** `npm install` succeeds; `npm test` runs (0 tests, 0 failures)

#### 0.2 — IOProvider interface + NodeIOProvider

- **Create:** `siimpli-graph-it-headless/src/io/IOProvider.js`
  ```
  /** @interface */
  readFile(path) → Promise<string>
  writeFile(path, data: string | Buffer) → Promise<void>
  readDir(path) → Promise<string[]>
  exists(path) → Promise<boolean>
  mkdir(path, { recursive }) → Promise<void>
  ```
- **Create:** `siimpli-graph-it-headless/src/io/NodeIOProvider.js` — wraps `node:fs/promises`
- **Create:** `siimpli-graph-it-headless/src/io/index.js` — re-exports both
- **Tests:** Write `NodeIOProvider.test.js` — create temp dir, write file, read it back, verify content. Test `readDir`, `exists`, `mkdir`.
- **Acceptance:** All tests green.

#### 0.3 — TauriIOProvider (in graph-it-core)

- **Create:** `siimpli-graph-it-core/src/io/TauriIOProvider.js` — wraps `@tauri-apps/plugin-fs`
- **Create:** `siimpli-graph-it-core/src/io/IOProvider.js` — same interface, re-exported
- **Refactor:** `FileService.js` — add optional `ioProvider` parameter. If provided, use it for file operations. If not, fall back to existing Tauri calls (backward compatible).
- **Acceptance:** Existing UI app still works unchanged. `FileService` with explicit `TauriIOProvider` behaves identically.

#### 0.4 — CI/CD sync script

- **Create:** `scripts/sync-versions.js` — reads version from `graph-it-core/package.json`, writes matching version + dependency to `graph-it-headless/package.json`
- **Acceptance:** Running `node scripts/sync-versions.js` updates the headless package version.

---

## Phase 1 — Extract `renderGraph()` from React

**Goal:** A pure function `renderGraph()` that accepts a DOM SVGElement + config + data → mutates the SVG. No React. No Tauri. The full rendering pipeline (all "Must have" features).

### Tickets

#### 1.1 — Extract orchestration into `renderGraph()`

- **Create:** `siimpli-graph-it-core/src/core/renderGraph.js`
- **Port** the entire body of `useGraphRenderer.generateGraph()` into a standalone function:
  ```js
  export function renderGraph({
    svg,          // SVGSVGElement (raw DOM, not a ref)
    csvData,      // Array<Object>
    graphConfig,  // graph-config.schema.json → graph section
    globalSettings,
    curveFits = [],
    logoDataUri = null,
    colorSchemes = COLOR_SCHEMES,
    isBatchMode = false,
  }) → { success: boolean, error?: string }
  ```
- Replace every `useCallback` wrapper with a plain function call.
- Replace `svgRef.current` access with the `svg` parameter directly.
- Replace `logoImage` (browser `Image` object) with `logoDataUri` (string) — embed as `<image href="data:...">` in SVG.
- Skip `CanvasSizer.ensureFit()` — headless mode does post-render crop instead.
- Skip `DataTableRenderer.renderInteractionLayer()` — interactive feature, not needed headless.
- **Must support:** scatter, line, bar, histogram, dual Y-axis, curve fits, filter expressions, legend, join X-axis, dual units, unified table, bias table.
- **Acceptance:** Function exists, exports cleanly, has JSDoc for every parameter.

#### 1.2 — Refactor `useGraphRenderer` to delegate to `renderGraph()`

- **Modify:** `siimpli-graph-it-core/src/hooks/useGraphRenderer.js`
- The hook's `generateGraph` callback should now call `renderGraph()` internally, converting `svgRef.current` → `svg`, `logoImage` → `logoDataUri`, etc.
- Add `CanvasSizer` and `renderInteractionLayer` calls *after* `renderGraph()` returns (they're UI-only concerns).
- **Acceptance:** The existing UI app produces identical graphs. All existing tests pass.

#### 1.3 — Column resolution with name + index support

- **Create:** `siimpli-graph-it-headless/src/utils/columnResolver.js`
  ```js
  resolveColumnId(columnId, csvHeaders, targetFileName)
  ```
  - If `columnId` is `"colName::file.csv"` → strip `::file.csv`, find `colName` in `csvHeaders`
  - If `columnId` is `"[3]::file.csv"` or `"[3]"` → return `csvHeaders[3]`
  - If not found by name → error with available columns listed
  - Returns `"resolvedColName::targetFileName"`
- **Create:** `resolveConfigColumns(graphConfig, csvHeaders, targetFileName)` — walks `xAxis`, `series[].yAxis`, `colorGrading`, `contouring`, `filterColumn` and resolves each.
- **Tests:** Test name match, index match, missing column error, edge cases (empty headers, index out of bounds).
- **Acceptance:** All column ID formats resolve correctly.

#### 1.4 — Integration tests for `renderGraph()`

- **Create:** `siimpli-graph-it-core/src/core/renderGraph.test.js`
- Use `jsdom` to create `document` + `<svg>` element.
- Test cases:
  - Scatter chart: verify `<circle>` elements exist
  - Line chart: verify `<path>` elements with `d` attribute
  - Bar chart: verify `<rect>` elements
  - Histogram: verify bin rects
  - Dual Y-axis: verify two axis `<g>` groups
  - Legend: verify legend group exists
  - Title: verify `<text>` with title content
  - Curve fit: verify trend line `<path>`
  - Filter: verify only matching data points rendered
  - Join X-axis: verify unified axis
  - Dual units: verify secondary axis label
- Use real CSV data from `siimpli-graph-it-copy/data/` for realistic tests.
- **Acceptance:** All tests pass under `vitest` with jsdom environment.

#### 1.5 — Export `renderGraph` from core's public API

- **Modify:** `siimpli-graph-it-core/src/index.js` — add `export { renderGraph } from './core/renderGraph.js'`
- **Acceptance:** Importable as `import { renderGraph } from '@siimpli/graph-it-core'`

---

## Phase 2 — Synthetic DOM + Logo + SVG Export

**Goal:** `renderGraph()` works in pure Node.js. SVG string output works. Logo renders.

### Tickets

#### 2.1 — DOMEnvironment utility

- **Create:** `siimpli-graph-it-headless/src/dom/DOMEnvironment.js`
  ```js
  export class DOMEnvironment {
    constructor(width = 2400, height = 1800) // oversized for post-crop
    get document()   // jsdom document
    get svg()        // root SVGSVGElement
    serialize()      // → clean SVG string via XMLSerializer
    destroy()        // cleanup jsdom window
  }
  ```
- Create a fresh JSDOM instance per `DOMEnvironment`. Set `url: 'http://localhost'` and `pretendToBeVisual: true`.
- Provide global `document` and `window` shims for D3's implicit usage.
- **Tests:** Create env, append a `<circle>` to svg, serialize, verify XML contains `<circle`.
- **Acceptance:** D3 operations work inside the jsdom SVG.

#### 2.2 — Handle `getBoundingClientRect` and `measureText`

- **Create:** `siimpli-graph-it-headless/src/dom/domShims.js`
- Patch jsdom's `SVGElement.prototype.getBoundingClientRect` to return a bbox computed from `x`, `y`, `width`, `height` attributes (or zeros for text).
- For `canvas.getContext('2d').measureText()`: provide a rough character-width estimator (average `0.6 * fontSize` per character) or integrate `@napi-rs/canvas` if precision is needed.
- **Tests:** Call `getBoundingClientRect()` on an SVG rect with known attributes, verify returns match.
- **Acceptance:** All Phase 1.4 integration tests pass in a Node environment (no browser).

#### 2.3 — Logo injection via data URI

- **Create:** `siimpli-graph-it-headless/src/utils/logoLoader.js`
  ```js
  export async function loadLogoAsDataUri(filePath, io) → string  // "data:image/png;base64,..."
  ```
- Reads the file via `IOProvider`, detects MIME type from extension, base64-encodes.
- In `renderGraph()`, when `logoDataUri` is provided, inject `<image href="${logoDataUri}" ...>` into the SVG at the standard logo position.
- **Tests:** Load a small test PNG, verify the data URI starts with correct prefix.
- **Acceptance:** Logo appears in serialized SVG output.

#### 2.4 — SVG file export

- **Create:** `siimpli-graph-it-headless/src/export/SvgExporter.js`
  ```js
  export async function exportSvg(domEnv, outputPath, io)
  ```
- Calls `domEnv.serialize()` → `io.writeFile(outputPath, svgString)`
- **Tests:** Render a simple graph, export SVG, read file back, verify it starts with `<svg` and contains expected elements.
- **Acceptance:** `.svg` files written to disk are valid SVG.

#### 2.5 — End-to-end SVG smoke test

- **Create:** `siimpli-graph-it-headless/tests/e2e/svgExport.test.js`
- Full pipeline: read config JSON + CSV → resolve columns → create DOMEnvironment → `renderGraph()` → `exportSvg()` → verify file on disk.
- Use the attached `graph-config-2026-03-06T20-41-43-759Z.json` config and a copper CSV from the data directory.
- **Acceptance:** One passing end-to-end test that proves SVG headless export works.

---

## Phase 3 — PNG Export + Post-Render Crop + Tables

**Goal:** PNG output with automatic cropping. Unified table and bias table render.

### Tickets

#### 3.1 — PNG rasterization via resvg-js

- **Create:** `siimpli-graph-it-headless/src/export/PngExporter.js`
  ```js
  export async function exportPng(domEnv, outputPath, io, options = {})
  ```
- `options`: `{ scale: 3, crop: true, watermark: true }`
- Uses `@resvg/resvg-js` `Resvg` class: `new Resvg(svgString, { fitTo: { mode: 'width', value: width * scale } })` → `.render().asPng()`.
- **Tests:** Render a scatter chart, export as PNG, verify file is a valid PNG (magic bytes `\x89PNG`), verify dimensions are reasonable.
- **Acceptance:** PNG files are generated.

#### 3.2 — Post-render crop

- **Create:** `siimpli-graph-it-headless/src/export/cropSvg.js`
  ```js
  export function cropSvgToContent(svgString) → string
  ```
- Strategy: Set `viewBox` to the largest extent of axis groups + legend group, computed from the known margin/dimension parameters passed to `renderGraph`. This is simple, reliable, and avoids fragile attribute scanning.
- **Tests:** Render a graph on a 2400×1800 canvas, crop, verify the resulting viewBox is smaller.
- **Acceptance:** Exported PNGs and SVGs have no excessive whitespace.

#### 3.3 — Watermark overlay

- **Create:** `siimpli-graph-it-headless/src/export/watermark.js`
  ```js
  export function applyWatermark(svgString, watermarkConfig) → string
  ```
- Inject SVG `<pattern>` + `<rect>` overlay with the watermark text, matching existing `WATERMARK_CONFIG` from constants.
- Applied to the SVG *before* PNG rasterization (so it's baked into the PNG).
- `--no-watermark` skips this call.
- **Tests:** Apply watermark, verify SVG contains `<pattern` element.
- **Acceptance:** PNG output shows tiled watermark when enabled.

#### 3.4 — Unified table + bias table in headless

- **Verify** that `UnifiedTableRenderer` and `BiasTableRenderer` (already pure D3 classes) work inside jsdom.
- If `getBoundingClientRect` shims are insufficient for table layout, compute cell positions from known font sizes and character counts.
- **Tests:** Render a graph with `showUnifiedTable: true, showStaticTable: true` and `showBiasTable: true` + mock bias data. Verify the SVG contains table `<g>` groups with `<rect>` and `<text>` elements.
- **Acceptance:** Tables render correctly in headless SVG output.

#### 3.5 — End-to-end PNG smoke test

- **Create:** `siimpli-graph-it-headless/tests/e2e/pngExport.test.js`
- Full pipeline: config + CSV → render → crop → watermark → PNG on disk.
- **Acceptance:** PNG file on disk with correct dimensions, watermark visible.

---

## Phase 4 — CLI Entry Point

**Goal:** A usable CLI: `graph-it render --config X --data Y --output Z`

### Tickets

#### 4.1 — CLI framework setup

- **Add dependency:** `commander` (for argument parsing)
- **Create:** `siimpli-graph-it-headless/cli/index.js` with `#!/usr/bin/env node`
- **Update:** `package.json` → `"bin": { "graph-it": "./cli/index.js" }`
- Commands: `render`, `validate`
- **Acceptance:** `node cli/index.js --help` prints usage.

#### 4.2 — `render` command

- **Create:** `siimpli-graph-it-headless/cli/commands/render.js`
- Flags:
  - `--config <path>` (required, or `-` for stdin)
  - `--data <path|glob>` (file, dir, or glob)
  - `--output <dir>` (default: `./output`)
  - `--format <png|svg|both>` (default: `png`)
  - `--width <number>` — override config width
  - `--height <number>` — override config height
  - `--logo <path>` — logo image file
  - `--no-watermark` — disable watermark
  - `--quiet` / `--verbose`
- Flow:
  1. Read config (file or stdin)
  2. Validate config via `ajv` against schema
  3. Discover CSVs from `--data` (resolve glob, scan dir, or use config-relative)
  4. For single CSV: resolve columns → create DOMEnvironment → `renderGraph()` → crop → export
  5. Print: `✓ copper.png (312ms)`
  6. Summary: `1 graph rendered, 0 failed`
- **Tests:** Test with mock filesystem (use temp directories). Verify output files created.
- **Acceptance:** `node cli/index.js render --config test.json --data test.csv --output ./tmp` produces a graph.

#### 4.3 — `validate` command

- **Create:** `siimpli-graph-it-headless/cli/commands/validate.js`
- Reads config JSON, validates against schema, prints errors or "Valid".
- **Acceptance:** Invalid config prints structured errors with JSON path. Valid config prints "✓ Valid".

#### 4.4 — Schema validation integration

- **Create:** `siimpli-graph-it-headless/src/validation/SchemaValidator.js`
  ```js
  export class SchemaValidator {
    validate(config) → { valid: boolean, errors: AjvError[] }
  }
  ```
- Bundles `graph-config.schema.json` and uses `ajv` to validate.
- **Tests:** Pass valid config → `valid: true`. Pass config missing `version` → `valid: false` with specific error. Pass config with bad `series[0].graphType` → error.
- **Acceptance:** All tests green.

#### 4.5 — End-to-end CLI test

- **Create:** `siimpli-graph-it-headless/tests/e2e/cli.test.js`
- Spawn `node cli/index.js render --config ... --data ... --output ...` as a child process.
- Verify: exit code 0, output file exists, stdout contains summary.
- Test error case: bad config → exit code 1, stderr contains error message.
- **Acceptance:** CLI works end-to-end as a standalone process.

---

## Phase 5 — Batch Mode (1 Config × N CSVs)

**Goal:** The primary use case. One config, a directory of CSVs, N graph outputs.

### Tickets

#### 5.1 — BatchRunner class

- **Create:** `siimpli-graph-it-headless/src/batch/BatchRunner.js`
  ```js
  export class BatchRunner {
    constructor(options: { io, format, logo, watermark, concurrency = 4 })
    async run(config, csvPaths, outputDir) → BatchResult
  }
  ```
- `BatchResult`: `{ graphs: [{ file, csv, status, duration_ms, error? }], total, succeeded, failed }`
- **Pre-render setup:** Create output directory before launching parallel renders (avoid per-render directory creation race conditions).
- For each CSV (in parallel, respecting concurrency limit):
  1. Read + parse CSV
  2. `resolveConfigColumns(graphConfig, csvHeaders, csvFileName)`
  3. Create DOMEnvironment
  4. `renderGraph()`
  5. Crop + export
  6. Destroy DOMEnvironment
  7. Record result
- Uses `p-limit` to control concurrency. Default: `4` (memory-efficient for jsdom-heavy workloads). Users can override via `options.concurrency` parameter.
- On error: catch, record `{ status: 'error', error: message }`, continue (D3 skip-and-report).
- **Tests:** Batch of 3 CSVs (2 valid, 1 missing column) → 2 PNGs + summary with 1 failure.
- **Acceptance:** Batch produces correct output count with proper error reporting.

#### 5.2 — Output naming

- Default: `<csv-stem>.<ext>` (e.g., `copper.png`)
- If collision (same stem, different dir): `<csv-stem>_<hash4>.<ext>`
- Config override: `--name-template "{csvName}_{title}_{date}"` — placeholder substitution.
- **Tests:** Verify default naming, collision handling, template substitution.
- **Acceptance:** Files named correctly.

#### 5.3 — Wire batch mode into CLI

- **Modify:** `cli/commands/render.js`
- When `--data` resolves to multiple CSVs → use `BatchRunner` instead of single-render path.
- Print one status line per graph.
- Write `batch-summary.json` to output dir.
- Final summary: `N graphs rendered, M failed (see batch-summary.json)`
- **Acceptance:** `graph-it render --config X --data ./csvs/ --output ./out/` produces N PNGs + summary.

#### 5.4 — Progress reporting

- In normal mode: print `  ✓ copper.png (312ms)` or `  ✗ badfile.csv — missing column "tc_usd"` per file.
- In quiet mode: suppress per-file lines.
- In verbose mode: print config dump, column resolution details, rendering steps.
- **Tests:** Capture stdout in tests, verify format.
- **Acceptance:** Output matches spec for all three verbosity levels.

#### 5.5 — End-to-end batch test

- **Create:** `siimpli-graph-it-headless/tests/e2e/batch.test.js`
- Use 3+ CSV files from the data directory.
- Run batch via CLI subprocess.
- Verify: correct number of output files, `batch-summary.json` structure, exit code.
- **Acceptance:** Full batch pipeline works end-to-end.

---

## Phase 6 — Hardening & Regression Safety

**Goal:** Ensure the UI app is unbroken. Add config migration. Polish.

### Tickets

#### 6.1 — UI regression test

- Run the existing `siimpli-graph-it-copy` app with Tauri.
- Load several CSV files, render graphs via the UI.
- Export PNG.
- Verify output matches pre-Phase-1 behavior.
- **Acceptance:** No visual regressions in UI-generated graphs.

#### 6.2 — Config version migration

- **Create:** `siimpli-graph-it-headless/src/config/configMigrator.js`
  ```js
  export function migrateConfig(rawConfig) → VersionedConfig
  ```
- If config has no `version` field → assume legacy batch format → run through `batchConfigAdapter` → wrap in versioned schema envelope.
- **Tests:** Pass legacy config → get valid v1.0.0 config. Pass v1.0.0 config → returned unchanged.
- **Acceptance:** Legacy configs work with the CLI without manual editing.

#### 6.3 — Error message quality pass

- Review all error paths. Every error must include:
  - What went wrong (specific)
  - What was expected vs what was found
  - For column mismatches: list of available columns
- **Acceptance:** Manual review of 5 error scenarios produces helpful messages.

#### 6.4 — CI/CD pipeline scaffold

- **Create:** `.github/workflows/headless-tests.yml` (or equivalent)
- Steps: install → lint → test `graph-it-core` → test `graph-it-headless` → e2e CLI tests
- Version sync check: verify headless package dependencies match core version.
- **Acceptance:** CI runs and passes.

---

## Phase 7 — Nice-to-Have Features (Post-MVP)

Each of these is an independent ticket that can be picked up in any order after Phase 6 is complete.

| Ticket | Feature | Detail |
|---|---|---|
| 7.1 | Color grading | Wire `colorGrading` column through headless renderGraph. Verify color scale serializes to SVG. |
| 7.2 | Contouring | Wire `contouring` through headless. Verify `<path>` contour elements in SVG. |
| 7.3 | Confidence intervals | Verify `showConfidenceInterval` works in headless bar charts. |
| 7.4 | Annotations | Wire `AnnotationRenderer` into headless path. |
| 7.5 | PDF export | Add `pdfkit` + `svg-to-pdfkit` for vector PDF output. New `--format pdf` flag. |
| 7.6 | Watch mode | `--watch` flag using `chokidar` to re-render on CSV/config changes. |
| 7.7 | Config generation | `graph-it init --data copper.csv` → auto-generate starter config from column inspection. |
| 7.8 | Template configs | `--template timeseries` → built-in config templates for common graph types. |
| 7.9 | Embedded curve fit coefficients | Optional `curveFits[].coefficients` in config to skip recomputation. |
| 7.10 | Advanced SVG crop | Parse SVG attributes (`x`, `y`, `width`, `height`, `transform`, `d`) to compute precise bounding box and crop `viewBox` automatically. Adds robustness for complex layouts with annotations/contouring. |

---

## File Map — What Gets Created

```
siimpli-graph-it-headless/          ← NEW PACKAGE
├── package.json
├── vitest.config.js
├── cli/
│   ├── index.js                    ← bin entry point
│   └── commands/
│       ├── render.js
│       └── validate.js
├── src/
│   ├── index.js                    ← public API
│   ├── io/
│   │   ├── IOProvider.js           ← interface
│   │   ├── NodeIOProvider.js
│   │   └── index.js
│   ├── dom/
│   │   ├── DOMEnvironment.js
│   │   └── domShims.js
│   ├── utils/
│   │   ├── columnResolver.js
│   │   └── logoLoader.js
│   ├── export/
│   │   ├── SvgExporter.js
│   │   ├── PngExporter.js
│   │   ├── cropSvg.js
│   │   └── watermark.js
│   ├── validation/
│   │   └── SchemaValidator.js
│   ├── config/
│   │   └── configMigrator.js
│   └── batch/
│       └── BatchRunner.js
└── tests/
    ├── io/
    │   └── NodeIOProvider.test.js
    ├── dom/
    │   ├── DOMEnvironment.test.js
    │   └── domShims.test.js
    ├── utils/
    │   ├── columnResolver.test.js
    │   └── logoLoader.test.js
    ├── export/
    │   ├── SvgExporter.test.js
    │   ├── PngExporter.test.js
    │   └── cropSvg.test.js
    ├── validation/
    │   └── SchemaValidator.test.js
    ├── batch/
    │   └── BatchRunner.test.js
    └── e2e/
        ├── svgExport.test.js
        ├── pngExport.test.js
        ├── cli.test.js
        └── batch.test.js

siimpli-graph-it-core/              ← MODIFIED
├── src/
│   ├── index.js                    ← add renderGraph export
│   ├── core/
│   │   ├── renderGraph.js          ← NEW (extracted from useGraphRenderer)
│   │   └── renderGraph.test.js     ← NEW
│   ├── hooks/
│   │   └── useGraphRenderer.js     ← MODIFIED (delegates to renderGraph)
│   └── io/
│       ├── IOProvider.js           ← NEW (shared interface)
│       └── TauriIOProvider.js      ← NEW
└── ...

scripts/                            ← NEW (workspace root)
└── sync-versions.js
```

---

## Dependency Graph

```
@siimpli/graph-it-headless
├── @siimpli/graph-it-core   (rendering primitives, renderGraph, validators, parsers)
├── jsdom                    (synthetic DOM for D3)
├── @resvg/resvg-js          (SVG → PNG rasterization)
├── ajv                      (JSON schema validation)
├── commander                 (CLI argument parsing)
├── p-limit                   (batch concurrency control)
└── vitest                    (dev: testing)

@siimpli/graph-it-core       (unchanged dependencies)
├── d3                        (rendering)
├── react, react-dom          (peer deps, UI only)
├── @tauri-apps/*             (Tauri plugins, desktop only)
└── vitest                    (dev: testing)
```

---

## Timeline

| Phase | Tickets | Effort | Milestone |
|---|---|---|---|
| **Phase 0** | 0.1 – 0.4 | 2 days | New package exists, I/O abstracted |
| **Phase 1** | 1.1 – 1.5 | 4 days | `renderGraph()` works with all MVP features |
| **Phase 2** | 2.1 – 2.5 | 3 days | Headless SVG export works in Node.js |
| **Phase 3** | 3.1 – 3.5 | 3 days | PNG export with crop + watermark + tables |
| **Phase 4** | 4.1 – 4.5 | 3 days | **CLI works for single graph** |
| **Phase 5** | 5.1 – 5.5 | 3 days | **Batch mode: 1 config × N CSVs** |
| **Phase 6** | 6.1 – 6.4 | 2 days | UI regression-safe, CI/CD green |
| **Phase 7** | 7.1 – 7.9 | Ongoing | Nice-to-have features |

**MVP (CLI + single graph):** Phases 0–4 → ~15 days
**Primary goal (batch):** Phases 0–5 → ~18 days
**Production-ready:** Phases 0–6 → ~20 days

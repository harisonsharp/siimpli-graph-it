# Headless Pipeline — Decision Questionnaire

> Each question below represents a real fork in the road that will affect implementation time, maintainability, or output quality. Fill in the **Your Answer** section for each. If left blank, the **Default** will be used and should be defensible for an initial build.

---

## Section 1 — Batch Semantics (Phase 5, highest stakes)

---

### Q1. When one config is applied to many CSVs, how should column identity be resolved?

**Why it matters:**
The config stores column references as `"tc_usd_per_dmt::copper.csv"` — the filename is baked in. When you run the same config against `zinc.csv`, `lead.csv`, etc., the renderer needs to know which column in the new file maps to `tc_usd_per_dmt::copper.csv`. There are three strategies, each with real tradeoffs:

| Strategy | How it works | Pro | Con |
|---|---|---|---|
| **A — Name-only** | Strip `::filename`, match by column name across any CSV | Zero config, works automatically if all CSVs share the same column names | Fails silently if column names differ across files |
| **B — Wildcard** | `tc_usd_per_dmt::*.csv` — wildcard in config, resolved at runtime | Explicit intent | Requires changing the config format; extra authoring |
| **C — Override map** | A `batch.columnMap` in the config that lists `"old-col::old.csv" → "new-col::new.csv"` | Handles any renaming scenario | Verbose; must be maintained per dataset |

If all your CSV files always share the same column header names (e.g., all concentrate CSVs have `tc_usd_per_dmt`, `effective_date`, etc.), then **A** works perfectly and requires no extra work.

**Your Answer:** let's go with a hybrid approach: The default will be A, but column names may differ, so we should also allow for indexes to be accepted as well, resolving the indexes at runtime. Indices will be defined by a number encased by brackets, e.g. [1], and they will be 0-indexed
>

**Default:** Strategy A — strip the `::filename` suffix and match by column name. If a column name is not found in the target CSV, log a warning and skip that series rather than crashing.

---

### Q2. Should each CSV produce exactly one graph, or can one CSV produce multiple graphs (one per series combination)?

**Why it matters:**
In the simplest model, the config defines one graph layout and each CSV gets one output file. But you might want one CSV to produce several graphs — e.g., one scatter of `tc` vs `effective_date`, another of `cu_grade` vs `effective_date` — generated from a single pass. This changes the output count and naming scheme significantly.

| Mode | CSV count | Graph count per CSV | Example output |
|---|---|---|---|
| **1-to-1** | N | 1 | `copper.png`, `zinc.png` |
| **1-to-many** | N | M (one per series config block) | `copper_tc.png`, `copper_cugrade.png`, `zinc_tc.png`, ... |
| **Config-driven** | N | Defined per config | Flexible but complex |

**Your Answer:** 1-to-1.
>

**Default:** 1-to-1 — one CSV produces one graph. Multiple graphs from one CSV can be done by running the CLI multiple times with different configs.

---

### Q3. How should batch mode handle a CSV that is missing a required column?

**Why it matters:**
In a batch of 20 files, one may lack a column the config expects. The two sensible extremes are "fail the entire batch" vs "skip the bad file and continue." The right choice depends on whether you're in an automated pipeline (where silent skips are dangerous) or an exploratory workflow (where partial output is useful).

| Behavior | When appropriate |
|---|---|
| **Fail fast** — stop entire batch on first error | Automated pipelines, CI, reproducibility-critical workflows |
| **Skip and report** — continue, mark failed file in summary JSON | Exploratory use, large heterogeneous datasets |
| **Configurable via flag** — `--on-error fail\|skip` | Best of both, small extra implementation cost |

**Your Answer:** skip and report
>

**Default:** Skip and report — continue the batch, write a `batch-summary.json` with `{ file, status, error }` for every input. Print a final count of successes and failures.

---

## Section 2 — Output & Export (Phase 3)

---

### Q4. What is the primary output format — PNG, SVG, or both by default?

**Why it matters:**
SVG output is nearly free (serialize the DOM string, write to disk — no rasterization, no native dependencies). PNG requires either a native binary (`resvg-js`, `@napi-rs/canvas`) or a headless browser. Choosing PNG as the default means every user of the CLI needs to install a native dependency, which complicates deployment on CI servers and Windows/Mac/Linux.

| Format | Output quality | File size | Deps needed | Time per graph |
|---|---|---|---|---|
| **SVG** | Lossless vector | Small | None (jsdom already needed) | ~50ms |
| **PNG** | Raster at fixed resolution | Medium | `resvg-js` (Rust binary, ~5MB) | ~200-500ms |
| **Both** | — | — | `resvg-js` | ~500ms |

**Your Answer:**
>

**Default:** PNG via `resvg-js`. SVG also supported via `--format svg`. Rationale: most downstream uses (reports, presentations, emails) need raster images, and `resvg-js` has pre-built binaries for all platforms.

---

### Q5. Should the watermark be applied in headless output, and should it be toggleable?

**Why it matters:**
The existing `ExportService` always tiles the watermark. In a headless batch context — especially for internal reports, development, or customer deliverables — you may want clean output. At the same time, branding consistency may require it. This also affects implementation: watermarking in Node requires compositing two images, which adds complexity.

**Your Answer:**
>

**Default:** Watermark is applied by default (matching UI behavior). A `--no-watermark` flag disables it. No watermark is applied in SVG output (SVG is not a finalized raster format).

---

### Q6. How should graph dimensions work in headless mode?

**Why it matters:**
In the UI, `CanvasSizer` dynamically resizes the SVG after rendering to fit all labels, legend, and tables. This relies on `getBoundingClientRect()`, which returns zeros in jsdom. You have three choices:

| Approach | Detail | Tradeoff |
|---|---|---|
| **Fixed dimensions from config** | Use `globalSettings.graphDimensions` ({width: 800, height: 600}) | Simple, predictable, but legends/labels can overflow |
| **Generous fixed defaults** | Use a large canvas (e.g., 1200×900) with wide margins | Avoids clipping without jsdom layout | May have excess whitespace |
| **Post-render crop** | Render large, then use `resvg-js`/`sharp` to crop to content bbox | Best quality, but adds complexity and a second pass |
 
**Your Answer:** Post-render crop
>

**Default:** Use dimensions from `globalSettings.graphDimensions` with a 20% margin buffer added automatically to prevent label clipping. Skip `CanvasSizer` entirely in headless mode.

---

## Section 3 — Architecture & Code Organization (Phases 0–1)

---

### Q7. Should `renderGraph()` (the extracted non-React renderer) live in `graph-it-core`, or in a new package?

**Why it matters:**
The core package currently has React as a peer dependency. The headless renderer should have no React dependency at all. If both live in the same package:
- `package.json` `peerDependencies` for React still appear, confusing server-side consumers
- Bundle size for headless users includes React-related imports

If split into separate packages (`@siimpli/graph-it-core` = React + UI, `@siimpli/graph-it-headless` = pure Node):
- Cleaner dependency graph
- More maintenance overhead (two packages to publish, version-sync)

**Your Answer:** Splitting later introduces technical debt now. Split into seperate packages, but note that we need to plan a maintenance workflow with some automated CI/CD scripts or something of similar calibre to lower maintanance load.
>

**Default:** Keep in one package (`graph-it-core`). Use a dedicated entry point `exports["./headless"]` in `package.json` so Node consumers import only the headless surface without React. Splitting can happen later when needed.

---

### Q8. Should the `IOProvider` interface be injected per-call or registered globally?

**Why it matters:**
Two patterns:

| Pattern | Example | Tradeoff |
|---|---|---|
| **Injected per call** | `renderBatch(config, csvPaths, { io: new NodeIOProvider() })` | Explicit, testable, no global state | Slightly more verbose |
| **Registered globally** | `HeadlessRuntime.configure({ io: new NodeIOProvider() })` then `renderBatch(...)` | Less boilerplate for the caller | Global state; hard to test two providers in parallel |

**Your Answer:** 
>

**Default:** Injected per call — pass `io` as part of an `options` object. A convenient `createNodeRuntime()` factory provides pre-configured defaults so typical users write only one line.

---

### Q9. How should the logo image be handled in headless mode?

**Why it matters:**
In the UI, the logo is loaded via a `FileReader` → `new Image()` browser flow. Headless has no `Image` constructor. The logo could be:
- A **file path** in the config (resolved at render time by the `IOProvider`)
- A **base64 data URI** embedded directly in the config
- **Disabled** in headless output (logo skipped)

If logo is important for branded output, it needs to be handled. If not, skipping it simplifies Phase 1-2 significantly.

**Your Answer:** Logo is important for branded output, so it needs to be automatically added from an early point in the roadmap.
>

**Default:** Skip logo rendering in headless mode for Phase 1–4. Add a `--logo <path>` CLI flag in Phase 5 that reads the file as base64 and injects it as an SVG `<image>` element directly (no `new Image()` needed).

---

## Section 4 — CLI Design (Phase 4)

---

### Q10. Should the CLI live inside `graph-it-core`, or in a new standalone `graph-it-cli` package?

**Why it matters:**
This is about who installs what. If the CLI is in `graph-it-core`:
- Any app importing the core also gets CLI code in its bundle (wasteful)
- One package to publish and version

If in `graph-it-cli`:
- Clean separation: server apps import `graph-it-core`, command-line users install `graph-it-cli`
- Two packages to maintain and keep in sync

**Your Answer:** 
>

**Default:** Start in `graph-it-core` under a `cli/` subdirectory. Move to a separate package when the CLI stabilizes and the overhead of sync is justified.

---

### Q11. How should the config file reference its CSV data in batch mode?

**Why it matters:**
Currently the config has `dataBindings.datasets[0].file = "copper.csv"` — a filename with no path. In headless mode, the CLI needs to know where to find that file. Options:

| Approach | CLI invocation | Config change needed? |
|---|---|---|
| **Explicit `--data` flag overrides config** | `graph-it render --config X.json --data ./csvs/` | No — `--data` dir is scanned |
| **Relative to config file location** | `graph-it render --config ./reports/X.json` (scans `./reports/*.csv`) | No |
| **Config embeds absolute/relative paths** | `"file": "./data/copper.csv"` | Yes — config must be updated |
| **`--data-dir` sets a base directory** | `graph-it render --config X.json --data-dir ./csvs/` | No |

**Your Answer:**
>

**Default:** `--data <path|glob>` overrides the `file` field in `dataBindings`. If `--data` is a directory, all CSVs in it are matched. If `--data` is omitted, the CLI looks for the CSV file relative to the config file's own directory.

---

### Q12. Should the CLI support reading the config from stdin (piped input)?

**Why it matters:**
`stdin` support enables composable pipelines like:
```bash
cat config.json | graph-it render --data ./csvs/ --output ./out/
# or:
my-config-generator | graph-it render --data ./csvs/
```
This is essentially free to implement (`--config -` convention), enables scripting workflows, and is expected by CLI-savvy users. The only risk is complexity if the config contains relative file paths that need a base directory.

**Your Answer:**
>

**Default:** Support `--config -` to read from stdin. Relative paths in the config are resolved from `cwd` when stdin is the source.

---

## Section 5 — Error Handling & Observability

---

### Q13. What should happen when a config passes schema validation but the CSV data doesn't match the declared columns?

**Why it matters:**
Schema validation (Phase 6) can only check structure, not data. At render time, the column named in `graph.xAxis` may not exist in the parsed CSV. This can happen because the column was renamed, the wrong CSV was provided, or the config was made against a different dataset version.

| Behavior | Detail |
|---|---|
| **Hard error** | Throw, print column name + available columns, exit with code 1 |
| **Soft warning** | Log warning, skip missing series, render what is available |
| **Suggestion** | Fuzzy-match column names and suggest the closest match in the error message |

**Your Answer:**
>

**Default:** Hard error on missing `xAxis` column (can't render at all). Soft warning with skip on missing `series[n].yAxis` columns (partial render is still useful). In both cases, print available column names from the CSV to help the user diagnose.

---

### Q14. What level of logging/verbosity should the CLI produce by default?

**Why it matters:**
In automated pipelines, noisy stdout breaks log parsing. In interactive use, silence feels broken. Standard convention is a `--verbose` / `--quiet` flag, but the default level matters for first impressions.

| Level | Default output |
|---|---|
| **Quiet** | Only the final JSON summary or errors |
| **Normal** | One line per graph: `✓ copper.png (312ms)`, final summary |
| **Verbose** | Every rendering step, scale creation, axis info |

**Your Answer:**
>

**Default:** Normal — one status line per graph plus a final summary table. `--quiet` suppresses per-graph lines (only summary). `--verbose` adds timing breakdowns and config dump.

---

## Section 6 — Feature Scope

---

### Q15. Which graph features must work in the first headless release, and which can be deferred?

**Why it matters:**
The full rendering pipeline supports: dual axes, color grading, contouring, histograms, curve fits, confidence intervals, unified tables, bias tables, annotations, dynamic sizing, join-X-axis mode, filter expressions per series. Implementing all of these headlessly in Phase 1 dramatically increases scope. Defining a supported subset now prevents false expectations.

Rate each feature as: **Must have (MVP)**, **Nice to have (Phase 5+)**, or **Defer**.

| Feature | Your Priority | Default Priority |
|---|---|---|
| Scatter / Line / Bar charts | | **Must have** |
| Histogram | | Must have |
| Dual Y-axis | | Must have |
| Color grading | | Nice to have |
| Curve fits (trend lines) | | Must have |
| Contouring | Nice to have| Defer |
| Filter expressions per series | | Must have |
| Confidence intervals on bars | | Nice to have |
| Legend rendering | | Must have |
| Unified table (legend + values) | Must have | Defer |
| Bias table | Must have | Defer |
| Annotations | Nice to have | Defer |
| Join X-axis mode | Must Have| Nice to have |
| Dual units (USD/dmt ↔ USD/lb) | Must Have| Nice to have |

**Your Answer (fill in the "Your Priority" column above, or write overrides here):**
>

---

### Q16. Should curve fits be re-computed during headless rendering, or should the config embed pre-computed coefficients?

**Why it matters:**
`curveFittingUtils` currently re-computes curve fits from raw data at render time (polynomial regression, power law, etc.). This is fine for the UI but means the headless pipeline carries a math dependency and can produce slightly different fit lines if input data changes. Alternatively, the UI could pre-compute and embed coefficients in the exported config, and the headless renderer just draws the pre-computed line.

| Approach | Detail | Tradeoff |
|---|---|---|
| **Recompute at render** | Fits are always recalculated from data | Always accurate; adds CPU time; math code must run headlessly |
| **Embed coefficients in config** | Config export includes `curveFits[].coefficients` | Fast headless rendering; coefficients can go stale if data changes |
| **Both** | Config can include coefficients (skip recompute) or not (trigger recompute) | Maximum flexibility; slightly more complex logic |

**Your Answer:**
>

**Default:** Recompute at render time. The existing `curveFittingUtils` is a pure math module with no browser dependency — it works in Node as-is. Add `curveFits[].coefficients` as an optional embedded field in a later phase.

---

## Section 7 — Decisions Already Made (Confirm or Override)

The following were set as defaults in the roadmap. No action needed unless you want to change them.

| Default Decision | Rationale | Override? |
|---|---|---|
| **`resvg-js`** for PNG rasterization | No Canvas API needed; pre-built Rust binaries; simpler integration than `@napi-rs/canvas` | |
| **`jsdom`** for synthetic DOM | Already in devDeps; D3-compatible; well-maintained | |
| **Per-render jsdom instance** | Prevents state bleed between batch items | |
| **SVG as intermediate format** | D3 always produces SVG; serializing it is the natural output | |
| **`ajv`** for JSON schema validation | Industry-standard, supports JSON Schema Draft 2020-12 (what the schema uses) | |
| **`p-limit`** for batch concurrency control | Lightweight; avoids spawning unlimited parallel renders | |

**Overrides:**
>

---

## Quick-Reference: Answers Summary

*Fill this in once you've answered all questions above, for easy reference during implementation.*

| Q# | Topic | Your Answer |
|---|---|---|
| Q1 | Column resolution strategy | |
| Q2 | Graphs per CSV | |
| Q3 | Missing column error behavior | |
| Q4 | Primary output format | |
| Q5 | Watermark policy | |
| Q6 | Graph dimensions in headless | |
| Q7 | Package structure | |
| Q8 | IOProvider injection pattern | |
| Q9 | Logo handling | |
| Q10 | CLI location | |
| Q11 | Config → CSV path resolution | |
| Q12 | stdin config support | |
| Q13 | Data/column mismatch behavior | |
| Q14 | Default logging verbosity | |
| Q15 | Feature scope for MVP | |
| Q16 | Curve fit recompute vs embed | |

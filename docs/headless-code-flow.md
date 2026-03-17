# Headless Rendering: Complete Code Flow

> This document traces exactly what happens when you invoke the headless CLI to produce a PNG visualization — from shell arguments to final bytes on disk. It also covers batch mode, watermarking, logo placement, and unified table composition.

---

## 1. System Architecture at a Glance

```
siimpli-graph-it-headless   ← CLI, I/O, batch orchestration, export
siimpli-graph-it-core       ← All rendering logic (D3 + SVG, runs in Node via jsdom)
siimpli-graph-it-copy       ← Browser UI (React, Tauri) — not involved in headless
```

The headless package never renders anything itself. It owns:
- parsing CLI arguments
- reading files from disk
- creating a synthetic DOM (jsdom) for D3 to work against
- delegating to `@siimpli/graph-it-core` for all graph logic
- exporting the resulting SVG to PNG via `@resvg/resvg-js`

---

## 2. CLI Invocation → Config Parsing

```
npx graph-it-headless render \
  --config chart.json \
  --data sales.csv \
  --output ./out \
  --logo company_logo.png \
  --format png
```

**Entry:** `cli/index.js` → registers `render` and `validate` commands via commander.js
**Handler:** `cli/commands/render.js` → `registerRenderCommand()`

### Step 1 — Load & validate config JSON

```
configText = io.readFile(configPath)
    ↓
parseConfig(configText)          ← JSON.parse + structural check
    ↓
SchemaValidator.validate(config) ← AJV 2020-12 against graph-config.schema.json
```

The schema is resolved in order:
1. `GRAPH_IT_SCHEMA_PATH` env var
2. `../siimpli-graph-it-copy/docs/graph-config.schema.json`
3. `../../docs/graph-config.schema.json`

If validation fails, the CLI prints all errors (AJV `allErrors: true`) and exits.

### Step 2 — Discover CSV paths

```
--data ./data/           → glob all *.csv in directory
--data "**/*.csv"        → full glob pattern
--data sales.csv         → single file
(omitted)                → config.dataBindings.datasets[0].file
```

Handled by `discoverCsvPaths()` in `render.js` via `glob` + `NodeIOProvider`.

---

## 3. Single-Graph Render Flow

For each CSV file discovered:

```
io.readFile(csvPath)
    ↓ raw text
parseCSV(csvText)
    ↓ { headers: string[], data: Object[] }
resolveConfigColumns(graphConfig, headers, fileName)
    ↓ all column refs mapped to actual header names
new DOMEnvironment(width, height)
    ↓ jsdom with <svg id="graph-svg"> + global shims
renderGraph({ svg, csvData, graphConfig, globalSettings, logoDataUri })
    ↓ fully rendered SVG DOM
exportPng(domEnv, outputPath, io, { watermark, crop, scale: 3 })
    ↓
bytes on disk
```

### 3a. CSV Parsing — Type Inference

`core/src/utils/parseCSV.js`

Each cell in each row is type-inferred in order:

| Priority | Match | Result |
|----------|-------|--------|
| 1 | `null/NULL/NA/N/A/nan/NaN` | `null` |
| 2 | `true/false` (case-insensitive) | boolean |
| 3 | Numeric (after removing commas) | number |
| 4 | ISO date `YYYY-MM-DD` | Date |
| 5 | US date `MM/DD/YYYY` | Date |
| 6 | `DD-MM-YYYY`, `DD_MM_YYYY` | Date |
| 7 | `DD-Mon-YYYY`, `Mon-YYYY` | Date |
| 8 | Anything else | string |

### 3b. Column Resolution

`headless/src/utils/columnResolver.js`

Config column references can use three syntaxes:

```
"[3]"                 → csvHeaders[3]              (index)
"[3]::sales.csv"      → csvHeaders[3] if file matches
"Revenue"             → "Revenue::sales.csv"        (name only → auto-scoped to current file)
"Revenue::sales.csv"  → validates header exists
```

**Strictness tiers:**
- `xAxis` — **required**, throws if missing
- `series[].yAxis` — **soft**, logs warning, series skipped
- `colorGrading`, `filterColumn`, `contour` — **silent skip**

---

## 4. Core renderGraph() — The Orchestration Heart

`core/src/core/renderGraph.js`

This is where the SVG DOM is built. Runs inside the jsdom environment created by `DOMEnvironment`.

```
1. Validate inputs (csvData present, xAxisInfo resolves)
2. FileService.filterValidData()          ← remove nulls, non-numeric rows
3. ScaleFactory.createScalesForGraph()    ← D3 linear/time/band/log scales
4. Draw plot area background rect
5. drawAxes()                             ← x, y, optional y2; grid lines; labels
6. renderTitle()                          ← SVG text at top center
7. appendLogo()                           ← if logoDataUri provided (see §6)
8. GraphCompositionRenderer.drawDataSeries()
     ├─ scatter: <circle> per point
     ├─ line:    <path> via d3.line()
     ├─ bar:     <rect> per value
     └─ histogram: bucketed <rect>
9. drawContours()                         ← D3 contour density (optional)
10. drawCurveFits()                       ← regression lines (optional)
11. if (showUnifiedTable) → UnifiedTableRenderer.render()
12. if (showBiasTable)    → BiasTableRenderer.render()
13. else                  → LegendRenderer.render()
14. Return { success, svg, g, validData, scales, columnInfo, margin }
```

---

## 5. Batch Mode: Multi-CSV Pipeline

When `--data` resolves to more than one CSV, `BatchRunner` takes over.

`headless/src/batch/BatchRunner.js`

```
csvPaths = [ 'jan.csv', 'feb.csv', 'mar.csv', ... ]
    ↓
new BatchRunner({ io, format, logo, watermark, concurrency: 4, ... })
    ↓
p-limit(4) — up to 4 graphs render in parallel
    ↓ for each csv:
    ├─ parseCSV(text)
    ├─ resolveConfigColumns(config, headers, fileName)
    ├─ new DOMEnvironment()
    ├─ renderGraph(...)
    ├─ exportPng() or exportSvg() or both
    └─ destroy DOMEnvironment (cleanup jsdom)
    ↓
results[] = [{ file, csv, status, duration_ms, error? }, ...]
    ↓
io.writeFile('output/batch-summary.json', JSON.stringify({
    graphs: results,
    total: N,
    succeeded: N,
    failed: N
}))
```

### Output filename templating

`--name-template "{csvName}_{title}_{date}"`

Available tokens:

| Token | Resolves to |
|-------|-------------|
| `{csvName}` | basename of input CSV (no extension) |
| `{title}` | `graphConfig.title` (sanitized) |
| `{date}` | ISO date string at time of render |
| `{index}` | 1-based index in batch |

If no template provided: `{csvName}.png`.

---

## 6. Logo Placement

`core/src/rendering/LogoRenderer.js` + `headless/src/utils/logoLoader.js`

### Loading

```
logoLoader.loadLogoAsDataUri(filePath, io)
    ↓
extension → MIME type mapping:
  .png → image/png
  .jpg/.jpeg → image/jpeg
  .svg → image/svg+xml
    ↓
base64-encode file bytes
    ↓
returns: "data:image/png;base64,iVBORw0KGgo..."
```

This data URI travels as a string through the entire render pipeline and is embedded directly into the SVG `<image>` element — no separate file reference.

### Placement

```
logoTargetWidth = 60px
aspectRatio = logoHeight / logoWidth    ← from image element
logoHeight = 60 * aspectRatio

logoX = margin.left - logoTargetWidth - 10    ← left of graph area
logoY = margin.top + graphHeight + 10         ← below graph area

svg.append('image')
   .attr('href', dataUri)
   .attr('x', logoX)
   .attr('y', logoY)
   .attr('width', 60)
   .attr('height', computed)
   .attr('opacity', 0.8)
```

The logo sits at the **lower-left**, outside the graph plot area, below the x-axis, with slight transparency.

---

## 7. Unified Table: Construction & Placement

`core/src/rendering/UnifiedTableRenderer.js`

Activated when `globalSettings.showUnifiedTable && globalSettings.showStaticTable`.

### What It Displays

```
┌──────────────────────────────────────────────┐
│  Legend & Most Recent Values                 │
├────────┬────────────────────┬────────────────┤
│ Marker │ Series Name        │ Value          │
├────────┼────────────────────┼────────────────┤
│   ●    │ Copper Grade       │ 4.25           │
│  ─ ─   │ Zinc               │ 2.10           │
│   ■    │ Gold               │ N/A            │
└────────┴────────────────────┴────────────────┘
```

Optional fourth column for dual-unit display (converted value at right).

### Row Data Preparation

`_prepareRowData(validData, seriesInfo, scales, selectedXValue)`

1. Determine target X value:
   - If `selectedXValue` provided → use D3 bisector to find closest data point
   - Otherwise → use the last (most recent) data point per series
2. For each series:
   - Filter `validData` to this series' yAxis column
   - Apply categorical filter if `filterColumn` configured
   - Find y-value at target x via bisection
   - Apply dual-unit conversion if `scaleFactor` set
   - Produce `{ seriesName, markerType, value, convertedValue }`

### Marker Rendering

| Series type | SVG output |
|-------------|------------|
| `scatter` | D3 symbol (`circle`, `cross`, `triangle`, etc.) |
| `line` | Horizontal stroke + line-style (solid/dashed/dotted) |
| `bar` | Small `<rect>` in series color |

### Layout Position

```javascript
tableX = margin.left + 20
tableY = margin.top + graphHeight + 40   // below graph + axes + labels

// Column widths:
markerCol  = 25px
nameCol    = 160px
valueCol   = 90px
value2Col  = 90px  (optional)
```

---

## 8. Bias Table Placement

`core/src/rendering/BiasTableRenderer.js`

Activated when `globalSettings.showBiasTable && globalSettings.biasTableData`.

The bias table renders to the **right of the unified table**:

```javascript
tableX = unifiedTableX + unifiedTableWidth + gap + 30
tableY = unifiedTableY   // vertically aligned with unified table
```

It displays raw CSV columns as a tabular grid — typically used for showing bias, variance, or calibration metadata alongside the main legend.

---

## 9. Watermark: Algorithm & Application

`headless/src/export/watermark.js` + `headless/src/constants.js`

### When It Applies

Watermark is **PNG-only**. SVG export never gets a watermark (by design — SVG is editable source). The flag `--no-watermark` disables it for PNG too.

### Configuration (from `constants.js`)

```javascript
WATERMARK_CONFIG = {
    seed: 'a4b7e1c8-d9f2-4g5h-6i7j-8k9l0m1n2o3p',
    tilePxSize: 64,
    shadeDifference: 2,          // subtle: only 2 RGB units between A and B
    baseColor: { r: 255, g: 255, b: 255 }
}
```

### Tile Generation Algorithm

```
1. Hash seed string with DJB2 → seedHash (32-bit int)
2. For each tile cell at (col, row) in a 4×4 macro-grid:
     hash = djb2_step(djb2_step(seedHash, col), row)
     color = abs(hash) % 2 === 0 ? colorA : colorB
3. colorA = baseColor (r=255, g=255, b=255) → white
4. colorB = baseColor - shadeDifference     → (253, 253, 253) ← barely visible
5. Each cell = (tilePxSize / 4) × (tilePxSize / 4) = 16×16 px
```

The resulting pattern looks like a near-invisible white-on-white checkerboard — detectable by steganalysis but not distracting to the human eye.

### SVG Injection

```javascript
applyWatermark(svgString, config)
    ↓
1. Parse SVG with JSDOM
2. Create <defs><pattern id="wm-{uuid}" ...>
       <rect> cells for each color in 4×4 grid
   </pattern></defs>
3. Inject <rect width="100%" height="100%" fill="url(#wm-{uuid})"
          style="pointer-events:none" />
   as the FIRST child of <svg> (background layer)
4. Re-serialize to string
    ↓
Modified SVG string → @resvg/resvg-js rasterizer → PNG bytes
```

Because the watermark is injected *before* rasterization, it is baked into every PNG pixel and cannot be removed without re-rendering.

---

## 10. PNG Export & Final Rasterization

`headless/src/export/PngExporter.js`

```
domEnv.serialize()          ← jsdom → SVG XML string
    ↓
cropSvgToContent(svgStr)    ← set viewBox="0 0 W H" (no excess whitespace)
    ↓
applyWatermark(svgStr)      ← inject pattern (if enabled)
    ↓
new Resvg(svgStr, {
    fitTo: { mode: 'width', value: svgWidth * 3 }
})                          ← @resvg/resvg-js at 3× scale for high-DPI
    ↓
resvg.render().asPng()      ← Uint8Array of PNG bytes
    ↓
io.writeFile(outputPath, pngData)
```

The 3× scale means a 1200×800 config produces a **3600×2400 px** output PNG — suitable for print.

---

## 11. Full End-to-End Example

```
$ graph-it-headless render \
    --config ./config/copper_assay.json \
    --data   ./data/drillhole_*.csv \
    --output ./charts \
    --logo   ./assets/logo.png \
    --format png

> Reading config: copper_assay.json ✓
> Schema validation: passed
> Discovered 12 CSV files
> Loading logo: logo.png → data:image/png;base64,...
>
> [1/12] drillhole_001.csv ... 1423ms ✓
> [2/12] drillhole_002.csv ...  987ms ✓
> ...
> [12/12] drillhole_012.csv ... 1102ms ✓
>
> Batch complete: 12/12 succeeded (0 failed)
> Summary written: ./charts/batch-summary.json
```

Each PNG in `./charts/` is:
- 3× scale rasterized
- Watermarked (barely visible pattern baked into pixels)
- Logo at lower-left
- Unified table below plot (if config enables it)
- Bias table to the right of unified table (if config provides data)

---

## 12. IOProvider Abstraction

`headless/src/io/NodeIOProvider.js`

All file I/O is abstracted behind a provider interface:

```javascript
interface IOProvider {
    readFile(path)  → Promise<string|Buffer>
    writeFile(path, data) → Promise<void>
    exists(path)    → Promise<boolean>
    mkdir(path)     → Promise<void>
}
```

This is how the same `core` rendering code runs in:
- **headless** (Node.js `fs/promises`)
- **browser UI** (Web File API)
- **Tauri** (Tauri IPC bridge)

The renderer never calls `fs` directly — it receives an `io` instance injected at call-site.

---

## Key File Reference

| Concern | File |
|---------|------|
| CLI entry | `headless/cli/index.js` |
| Render command | `headless/cli/commands/render.js` |
| Batch orchestration | `headless/src/batch/BatchRunner.js` |
| jsdom wrapper | `headless/src/dom/DOMEnvironment.js` |
| PNG export | `headless/src/export/PngExporter.js` |
| Watermark injection | `headless/src/export/watermark.js` |
| ViewBox crop | `headless/src/export/cropSvg.js` |
| Logo loader | `headless/src/utils/logoLoader.js` |
| Column resolver | `headless/src/utils/columnResolver.js` |
| Config schema validation | `headless/src/validation/SchemaValidator.js` |
| **Main render orchestrator** | `core/src/core/renderGraph.js` |
| CSV parser | `core/src/utils/parseCSV.js` |
| D3 scale creation | `core/src/rendering/ScaleFactory.js` |
| Data series drawing | `core/src/rendering/GraphCompositionRenderer.js` |
| Unified table | `core/src/rendering/UnifiedTableRenderer.js` |
| Bias table | `core/src/rendering/BiasTableRenderer.js` |
| Axis rendering | `core/src/utils/axisUtils.js` |
| Watermark constants | `headless/src/constants.js` |

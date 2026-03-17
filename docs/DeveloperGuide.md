# SiimpliGraphIt Developer Guide

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Development Setup](#development-setup)
4. [Codebase Structure](#codebase-structure)
5. [The Headless Library & Core Architecture](#the-headless-library--core-architecture)
   - [Overview: Three Layers](#overview-three-layers)
   - [@siimpli/graph-it-core](#siimplgraph-it-core)
   - [siimpli-graph-it-headless](#siimpli-graph-it-headless)
   - [Configuration Objects](#configuration-objects)
   - [Data Flow](#data-flow-in-headless-mode)
   - [CSV Type Inference](#csv-type-inference-in-headless)
   - [Column Resolution](#column-resolution-strategy)
   - [Watermarking](#watermarking-in-png-export)
6. [Key Patterns and Concepts](#key-patterns-and-concepts)
7. [Development Workflow](#development-workflow)
8. [Adding Features](#adding-features)
9. [Testing](#testing)
10. [Debugging](#debugging)
11. [Common Tasks](#common-tasks)
12. [Best Practices](#best-practices)
13. [Troubleshooting](#troubleshooting)

---

## Project Overview

**SiimpliGraphIt** is a scientific data visualization and analysis platform built with:

- **Frontend**: React 19.1 + D3.js 7.9 for interactive visualizations
- **Desktop App**: Tauri 2 for cross-platform desktop application
- **Backend Logic**: `@siimpli/graph-it-core` headless library for data processing and graph rendering
- **State Management**: React Context for centralized configuration
- **Styling**: CSS with CSS variables for theming

### Key Features

- **Manual Graphing**: Interactive graph configuration with real-time feedback
- **Batch Processing**: Process multiple files with consistent settings
- **Filename Decoder**: Extract metadata from standardized filenames
- **Export**: PNG and JSON configuration export
- **Curve Fitting**: Mathematical curve fitting for data analysis
- **Data Tables**: Unified and bias table views for detailed data inspection

---

## Architecture

### High-Level Data Flow

```
[User Input] → [React Components] → [ConfigContext] → [Hooks] → [Core Library] → [D3.js Rendering]
     ↓               ↓                    ↓              ↓           ↓
  File Upload    UI Components       State Mgmt       Custom     Graph Service
  User Actions   File Handlers     Global Settings     Hooks      Export Service
  Config Changes Graph Config      Curve Fits      useFileManager  Curve Fitting
```

### Three-Layer Architecture

1. **Presentation Layer** (`src/components/`)
   - React components for UI
   - Manage user interactions
   - Display data and graphs
   - Handle file uploads

2. **State Management Layer** (`src/contexts/`)
   - `ConfigContext.jsx`: Centralized configuration state
   - `ErrorContext.jsx`: Error handling and notifications
   - Provides context for all components

3. **Business Logic Layer** (`src/hooks/`)
   - Custom React hooks encapsulate business logic
   - `useFileManager`: File loading and data coordination
   - `useGraphRenderer`: Graph generation orchestration
   - `useBatchGraphRenderer`: Batch processing logic
   - `useCurveFitting`: Mathematical curve fitting

4. **Core Library** (`@siimpli/graph-it-core`)
   - Headless graph rendering
   - Data validation and processing
   - Mathematical operations
   - Export functionality

---

## Development Setup

### Prerequisites

- **Node.js** v16+ ([download](https://nodejs.org/))
- **Rust** ([install](https://www.rust-lang.org/tools/install)) - for Tauri backend
- **Git** for version control

### Initial Setup

1. **Clone and navigate to project:**
   ```bash
   cd siimpli-graph-it-copy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in development mode (web-only):**
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:5173`

4. **Run full Tauri desktop app:**
   ```bash
   npm run tauri dev
   ```
   Launches native desktop application with file system access

5. **Build for production:**
   ```bash
   npm run build        # Build frontend
   npm run tauri build  # Build desktop app
   ```

---

## Codebase Structure

### Multi-Repository Architecture

SiimpliGraphIt is built as **three independent repositories** that work together:

```
siimpli-graph-it-core           ← Headless rendering library (D3 + SVG)
  ├── src/rendering/           # D3 graph rendering logic
  ├── src/utils/               # Data processing, math, parsing
  ├── src/core/                # Main renderGraph() orchestrator
  └── package.json             # Exports for both React and headless
       ↓
       └─ Used by ↓
          siimpli-graph-it-copy     ← React/Tauri desktop UI
          siimpli-graph-it-headless ← Node.js CLI tool
```

### This Repository (siimpli-graph-it-copy)

```
siimpli-graph-it-copy/
├── src/
│   ├── components/           # React UI components
│   │   ├── App.jsx          # Root component with providers
│   │   ├── GraphApp.jsx     # Main application orchestrator
│   │   ├── GraphConfiguration.jsx  # Graph settings UI
│   │   ├── GraphRenderer.jsx       # Graph rendering component
│   │   ├── FileUploadSection.jsx   # File upload interface
│   │   ├── Batch.jsx        # Batch processing mode (UI)
│   │   ├── FileNameDecoder.jsx     # Filename parsing mode
│   │   ├── CurveFittingPanel.jsx   # Curve fitting controls
│   │   └── [other components]
│   ├── contexts/             # React Context providers
│   │   ├── ConfigContext.jsx # Configuration state management
│   │   └── ErrorContext.jsx  # Error handling and notifications
│   ├── hooks/                # Custom React hooks
│   │   ├── useFileManager.js        # File loading and management
│   │   ├── useGraphRenderer.js      # Graph rendering orchestration (uses core)
│   │   ├── useBatchGraphRenderer.js # Batch processing in UI
│   │   └── [other hooks]
│   ├── App.jsx              # Application entry point
│   ├── main.jsx             # React DOM render
│   └── App.css              # Global styles
├── src-tauri/               # Tauri desktop app backend
│   ├── src/
│   ├── tauri.conf.json      # Tauri configuration
│   └── Cargo.toml           # Rust dependencies
├── docs/
│   ├── DeveloperGuide.md    # This guide
│   ├── UserGuide.md         # User documentation
│   └── graph-config.schema.json  # JSON schema for configs
├── package.json             # Dependencies (includes @siimpli/graph-it-core)
├── vite.config.js           # Vite build configuration
└── README.md               # Project README
```

### Key File Purposes

| File | Purpose |
|------|---------|
| `GraphApp.jsx` | Main orchestrator - coordinates all features |
| `ConfigContext.jsx` | Centralized state for graph config, curve fits, global settings |
| `ErrorContext.jsx` | Error display and success notifications |
| `useFileManager.js` | Handles CSV loading, column extraction |
| `useGraphRenderer.js` | Graph generation - coordinates all rendering steps |
| `useBatchGraphRenderer.js` | Batch processing - applies config to multiple files |
| `GraphRenderer.jsx` | SVG rendering component - displays generated graphs |
| `GraphConfiguration.jsx` | UI for axis selection, series configuration |

---

## The Headless Library & Core Architecture

### Overview: Three Layers

SiimpliGraphIt separates concerns across three repositories:

```
┌─ siimpli-graph-it-core ────────────────────────────────┐
│  Pure graph rendering logic (D3.js + SVG)              │
│  - No React dependency                                 │
│  - No browser DOM dependency                           │
│  - Works in Node.js (with jsdom shim)                  │
│  - Exported as npm package: @siimpli/graph-it-core     │
└─────────────────────────────────────────────────────────┘
                          ↑
        Used by both:     │     Used by both:
    ┌────────────────────────────────────────┐
    │                                        │
┌─ siimpli-graph-it-copy ────┐  ┌─ siimpli-graph-it-headless ─┐
│  React/Tauri UI            │  │  Node.js CLI tool           │
│  - Interactive graphs      │  │  - Batch processing        │
│  - Real-time preview       │  │  - Automated pipelines     │
│  - File browser UI         │  │  - Server-side rendering   │
└────────────────────────────┘  └─────────────────────────────┘
```

### @siimpli/graph-it-core

**Purpose**: Pure graph rendering library used by all interfaces

**Exports**:
```javascript
// Main rendering
export { renderGraph }              // Core orchestrator
export { GraphService }             // Graph composition
export { ExportService }            // PNG/SVG/JSON export

// Data processing
export { FileService }              // CSV parsing, validation
export { parseCSV }                 // Type-inferring CSV parser
export { parseColumnId }            // Column ID resolution
export { filterValidData }          // Data validation

// D3 utilities
export { ScaleFactory }             // Create D3 scales
export { drawAxes }                 // Axis rendering
export { renderTitle }              // Title generation
export { groupSeriesByAxis }        // Axis grouping logic

// Rendering components
export { LegendRenderer }           // Legend drawing
export { DataTableRenderer }        // Data table/static table
export { UnifiedTableRenderer }     // Combined legend + values
export { BiasTableRenderer }        // Bias correction table
export { GraphCompositionRenderer } // Series rendering (scatter/line/bar)

// Curve fitting
export { performCurveFitting }      // Curve fit computation
export { calculateAxisIntercepts }  // Axis intercept logic

// Math/utilities
export { curveFittingUtils }        // Polynomial/exponential fitting
export { debugLog, debugWarn }      // Debug utilities
```

**Key Entry Point**: `renderGraph(options)`

```javascript
const options = {
  svg: d3Element,                   // D3-selected SVG element
  csvData: [],                      // Parsed CSV data
  graphConfig: { ... },             // Graph configuration object
  globalSettings: { ... },          // Colors, dimensions, intercepts
  logoDataUri: 'data:image/png;...' // Optional logo as data URI
};

const result = renderGraph(options);
// Returns: { success, svg, validData, scales, columnInfo, margin }
```

### How the UI Uses the Core Library

```javascript
// In useGraphRenderer.js hook:

import {
  GraphService,
  FileService,
  parseColumnId,
  drawAxes,
  ScaleFactory,
  // ... etc
} from '@siimpli/graph-it-core';

export function useGraphRenderer({ csvData, graphConfig, ... }) {
  const generateGraph = useCallback((svgRef, onSuccess, onError) => {
    // 1. Parse and validate data
    const columnInfo = parseColumnInformation(graphConfig);
    const validData = FileService.filterValidData(csvData, ...);

    // 2. Create D3 scales
    const scales = createScales(validData, columnInfo, ...);

    // 3. Render to SVG (calls core library functions)
    const svg = d3.select(svgRef.current);
    const g = svg.append("g");

    drawAxes(g, scales.xScale, scales.yScale, ...);
    renderTitle(svg, graphConfig, ...);
    new GraphService().drawDataSeries(g, validData, scales, ...);

    // 4. Export (via ExportService from core)
    ExportService.exportAsPNG(svgRef, canvasRef, csvData, ...);
  }, [csvData, graphConfig, ...]);

  return { generateGraph };
}
```

### siimpli-graph-it-headless

**Purpose**: Node.js CLI tool for automated/server-side rendering

**Usage**:
```bash
# Single file
graph-it-headless render \
  --config chart.json \
  --data data.csv \
  --output ./results/ \
  --logo logo.png \
  --format png

# Batch processing
graph-it-headless render \
  --config chart.json \
  --data "./data/*.csv" \
  --output ./results/ \
  --format png
```

**Architecture**:
```
CLI Entry (cli/index.js)
    ↓
Commander.js (argument parsing)
    ↓
renderCommand() handler
    ├─ Load config JSON
    ├─ Validate against schema (ajv)
    ├─ Discover CSV files (glob patterns)
    └─ Branch by file count:
        ├─ Single file → renderSingleGraph()
        └─ Multiple files → BatchRunner (p-limit concurrency)

For each file:
    ├─ Parse CSV (parseCSV with type inference)
    ├─ Create jsdom environment
    ├─ Call renderGraph() from @siimpli/graph-it-core
    ├─ Serialize SVG
    └─ Export to PNG/SVG

BatchRunner:
    ├─ Parallel processing (default 4 concurrent)
    ├─ Per-file error handling (skip bad files)
    └─ Write batch-summary.json
```

**Key Components**:

| Component | Purpose |
|-----------|---------|
| `cli/index.js` | Command registration |
| `cli/commands/render.js` | Render command handler |
| `batch/BatchRunner.js` | Parallel graph processing |
| `dom/DOMEnvironment.js` | jsdom wrapper for D3 |
| `export/PngExporter.js` | SVG → PNG via resvg-js |
| `export/watermark.js` | Anti-tampering watermark |
| `utils/columnResolver.js` | Column ID resolution |
| `utils/logoLoader.js` | Logo file → data URI |
| `validation/SchemaValidator.js` | JSON schema validation |

### Configuration Objects

**Format**: JSON file describing graph structure

```javascript
{
  // Version and metadata
  "version": "1.0.0",
  "metadata": {
    "title": "Project analysis",
    "generatedAt": "2025-03-13T..."
  },

  // Data column bindings
  "dataBindings": {
    "datasets": [
      {
        "id": "copper-data",
        "file": "copper.csv",
        "columns": [
          { "id": "time", "name": "timestamp", "type": "date", "unit": "seconds" },
          { "id": "grade", "name": "cu_grade", "type": "number", "unit": "percent" }
        ]
      }
    ]
  },

  // Graph configuration
  "graph": {
    "graphType": "scatter",      // scatter, line, bar, histogram
    "xAxis": "copper.csv::timestamp",  // Column ID
    "series": [
      {
        "yAxis": "copper.csv::cu_grade",
        "color": "#ff6b6b",
        "lineStyle": "solid",
        "axisAssignment": "primary"
      }
    ],
    "title": "Copper Grade Over Time",
    "xAxisLabel": "Time (s)",
    "yAxisLabel": "Cu Grade (%)",

    // Optional features
    "colorGrading": "copper.csv::intensity",  // Heatmap coloring
    "contouring": "copper.csv::density",      // Contour lines
    "widthMultiplier": 1.0,
    "heightMultiplier": 1.0
  },

  // Global settings
  "global": {
    "colorScheme": "warm-cool",
    "graphDimensions": { "width": 800, "height": 600 },
    "axisIntercept": "origin",
    "customIntercept": { "x": 0, "y": 0 },
    "showGuideLines": false,
    "showDataTable": false,
    "showStaticTable": false,
    "showUnifiedTable": false
  }
}
```

### Data Flow in Headless Mode

```
[CLI Arguments] → [Config JSON] → [CSV Files]
        ↓                ↓              ↓
   parseArgs()    validateSchema()  glob patterns
        ↓                ↓              ↓
  ┌─────────────────────────────────────────┐
  │ renderCommand() Main Handler            │
  ├─────────────────────────────────────────┤
  │ 1. Load & validate config               │
  │ 2. Discover CSV file paths              │
  │ 3. Batch or single file branch:         │
  │    ├─ Single: renderSingleGraph()       │
  │    └─ Multiple: new BatchRunner()       │
  └─────────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────────┐
  │ Per-File Processing Loop                │
  ├─────────────────────────────────────────┤
  │ 1. io.readFile(csvPath) → text          │
  │ 2. parseCSV(text) → data object array   │
  │ 3. resolveConfigColumns(config, headers)│
  │ 4. new DOMEnvironment() → jsdom         │
  │ 5. renderGraph({ ... }) → SVG DOM       │
  │ 6. exportToPng() or exportToSvg()       │
  │ 7. io.writeFile(outputPath, bytes)      │
  └─────────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────────┐
  │ Output                                  │
  ├─────────────────────────────────────────┤
  │ ./output/                               │
  │   ├─ copper.png                         │
  │   ├─ zinc.png                           │
  │   ├─ lead.png                           │
  │   └─ batch-summary.json                 │
  └─────────────────────────────────────────┘
```

### CSV Type Inference in Headless

The headless library automatically infers data types:

```javascript
// parseCSV(csvText) → { headers: [], data: [] }

// Each cell is inspected in order:
1. null/NULL/NA → null
2. true/false → boolean
3. Numeric (after removing commas) → number
4. ISO dates (YYYY-MM-DD) → Date
5. US dates (MM/DD/YYYY) → Date
6. Other date formats → Date
7. Everything else → string

// Example input:
csv:
  date,value,active
  2025-03-13,123.45,true
  2025-03-14,,false

// Output:
data: [
  { date: Date(2025-03-13), value: 123.45, active: true },
  { date: Date(2025-03-14), value: null, active: false }
]
```

### Column Resolution Strategy

Columns can be referenced in three ways:

```javascript
// 1. By index (0-based)
"[2]"  // csvHeaders[2]

// 2. By name (in current file)
"Revenue"  // Becomes "Revenue::copper.csv" if in copper.csv

// 3. By full ID (file-scoped)
"Revenue::copper.csv"  // Explicit file reference
```

**Resolution in batch mode**:
```javascript
// Config references: Revenue::copper.csv
// When applied to zinc.csv:

// Strategy A (default):
- Strip filename suffix
- Match by name: "Revenue" in zinc.csv
- If not found, log warning and skip

// Strategy B (index-based):
- Reference [2] works on any file
- Column 2 in any CSV

// Hybrid approach (recommended):
- Accept both name and index syntax
- Name first (better UX), index fallback (robust)
```

### Watermarking in PNG Export

For anti-tampering, headless PNG exports include a subtle watermark:

```javascript
// Near-invisible white-on-white checkerboard pattern
// Algorithm:
1. Hash seed string → pseudo-random colors
2. Create 4×4 tile grid with 16×16px cells
3. Alternate between white (255,255,255) and near-white (253,253,253)
4. Inject as SVG pattern before rasterization
5. Pattern baked into PNG pixels at 3× scale

// Result:
- Human eye: looks like plain white background
- Analysis: detectable via steganalysis
- Tampering: any edit breaks the pattern
```

---

## Key Patterns and Concepts

### 1. React Context for State Management

**ConfigContext** provides centralized state accessed via `useConfig()` hook:

```javascript
const { graphConfig, updateGraphConfig, globalSettings, curveFits } = useConfig();
```

**ConfigContext** exposes:
- `graphConfig`: Current graph settings (axes, series, styles)
- `curveFits`: Array of curve fitting configurations
- `globalSettings`: App-wide settings (colors, dimensions, intercepts)
- `updateGraphConfig()`: Update graph settings
- `updateCurveFit()`: Modify curve fit parameters
- `addCurveFit()` / `removeCurveFit()`: Manage curve fits
- `addSeries()` / `removeSeries()` / `updateSeries()`: Manage data series

### 2. Custom React Hooks for Business Logic

Hooks encapsulate domain-specific logic:

```javascript
// File management
const { csvFiles, csvData, columns, removeFile, handleFileUpload } = useFileManager(
  graphConfig,
  updateGraphConfig
);

// Graph rendering
const { generateGraph } = useGraphRenderer({
  csvData,
  graphConfig,
  curveFits,
  globalSettings,
  logoImage,
  logoReady,
  getAxisIntercepts,
  colorSchemes
});
```

### 3. Column ID Parsing

Columns are identified using a composite ID format from the core library:

```javascript
import { parseColumnId } from '@siimpli/graph-it-core';

const columnInfo = parseColumnId('filename.csv::columnName');
// Returns: { fileName: 'filename.csv', columnName: 'columnName' }
```

### 4. Configuration Objects

**Graph Configuration** defines what to display:
```javascript
{
  xAxis: 'data.csv::time',
  series: [
    { yAxis: 'data.csv::temperature', color: '#ff6b6b', lineStyle: 'solid' },
    { yAxis: 'data.csv::pressure', color: '#4ecdc4', lineStyle: 'dashed' }
  ],
  title: 'Temperature vs Pressure',
  projectName: 'Experiment 2025',
  contouring: 'data.csv::density',
  colorGrading: 'data.csv::intensity',
  graphType: 'scatter',
  xAxisLabel: 'Time (min)',
  yAxisLabel: 'Temperature (°C)'
}
```

**Global Settings** control visualization parameters:
```javascript
{
  colorScheme: 'green-red',      // D3 color scheme
  axisIntercept: 'origin',       // 'origin', 'data-min', 'custom'
  customIntercept: { x: 0, y: 0 },
  graphDimensions: { width: 800, height: 600 },
  showGuideLines: false,
  showDataTable: false,
  showStaticTable: false,
  showUnifiedTable: false
}
```

### 5. Error Handling

Use the `ErrorContext` for consistent error messages:

```javascript
const { handleError, showSuccess } = useError();

try {
  // Do something
} catch (error) {
  handleError(error, 'Human-readable message');
}

showSuccess('Operation completed');
```

---

## Development Workflow

### Starting a Development Session

1. **Understand the feature request**
   - What is the goal?
   - Which modes are affected (manual, batch, decoder)?
   - What is the user interaction?

2. **Identify affected areas**
   - Does it require UI changes? → Check `components/`
   - Does it need state management? → Update `ConfigContext.jsx`
   - Does it need business logic? → Create/update hooks
   - Does it require data processing? → Likely in `@siimpli/graph-it-core`

3. **Start developing**
   ```bash
   npm run dev  # or npm run tauri dev for full app
   ```

4. **Test in browser** with Hot Module Replacement (HMR)
   - Changes reload automatically
   - State persists when possible

### Feature Development Checklist

- [ ] Feature works in web mode (`npm run dev`)
- [ ] Feature works in Tauri mode (`npm run tauri dev`)
- [ ] Configuration can be exported/imported (JSON)
- [ ] Error handling is in place
- [ ] No console warnings or errors
- [ ] Edge cases handled (empty data, invalid input, etc.)

---

## Adding Features

### Example: Adding a New Graph Configuration Option

**Step 1: Update ConfigContext**
```javascript
// In ConfigContext.jsx, add to default config
const DEFAULT_GRAPH_CONFIG = {
  // ... existing fields
  newOption: false,  // Your new setting
};
```

**Step 2: Create UI Component**
```javascript
// In GraphConfiguration.jsx, add control
<label>
  <input
    type="checkbox"
    checked={graphConfig.newOption}
    onChange={(e) => updateGraphConfig({ newOption: e.target.checked })}
  />
  Enable New Feature
</label>
```

**Step 3: Handle in Rendering**
```javascript
// In useGraphRenderer.js, use the setting
const generateGraph = useCallback((svgRef, onSuccess, onError, overrides = {}) => {
  // ... existing code

  if (targetGraphConfig.newOption) {
    // Apply feature logic
  }

  // ... rest of rendering
}, [/* dependencies */]);
```

**Step 4: Test**
- Verify UI control works
- Check that configuration persists
- Ensure export includes the new option
- Test in both web and Tauri modes

### Example: Adding a New Data Processing Feature

**Step 1: Understand the data flow**
- Where does the data come from? `useFileManager`
- Where is it processed? Core library functions
- Where is it rendered? `useGraphRenderer`

**Step 2: Add to core library** (if complex logic)
- Update `@siimpli/graph-it-core`
- Export functions from core

**Step 3: Integrate into hook**
```javascript
import { myNewFunction } from '@siimpli/graph-it-core';

// In hook, call at appropriate point:
const processedData = myNewFunction(csvData, config);
```

**Step 4: Pass to renderer**
- Update component props if needed
- Ensure memoization dependencies are correct

---

## Testing

### Current Testing Setup

The project is set up for testing with Vitest:

```bash
npm test              # Run tests
npm test -- --ui     # Run with UI
```

### Testing Strategies

1. **Component Testing**
   - Test React component rendering
   - Verify user interactions work correctly
   - Check prop changes trigger updates

2. **Hook Testing**
   - Test custom hook logic in isolation
   - Mock external dependencies
   - Verify state updates

3. **Integration Testing**
   - Test feature workflows end-to-end
   - Verify components work together
   - Test with real data

4. **Manual Testing**
   - Use browser DevTools
   - Test with different data sizes
   - Test edge cases (empty data, invalid input)
   - Test both web and Tauri modes

### Key Testing Areas

- **File Upload**: Verify CSV files load correctly, columns are extracted
- **Graph Rendering**: Check SVG generation with various configurations
- **State Management**: Verify config updates propagate correctly
- **Export**: Ensure PNG and JSON exports work
- **Curve Fitting**: Verify mathematical calculations
- **Error Handling**: Test graceful failure modes

---

## Debugging

### Browser DevTools

1. **Open DevTools** in Tauri app:
   - Right-click → "Inspect"
   - Or `F12` / `Ctrl+Shift+I`

2. **Inspect State**
   - Use React Developer Tools extension
   - Check ConfigContext in Components tab
   - Monitor state changes

3. **Console Debugging**
   - Application logs errors/warnings
   - Check for validation errors
   - Inspect network requests (Tauri commands)

### Common Debugging Patterns

```javascript
// Log state changes
const { debugLog, debugWarn } = require('@siimpli/graph-it-core');
debugLog('[Component] State updated:', newState);

// Verify data integrity
console.assert(csvData.length > 0, 'No data loaded');

// Check column existence
const hasColumn = columns.some(c => c.name === 'expectedColumn');

// Trace hook execution
useEffect(() => {
  console.log('Effect running with dependencies:', [csvData, graphConfig]);
}, [csvData, graphConfig]);
```

### Tauri-Specific Debugging

Commands execute in Rust backend. Check logs:

```bash
# Tauri dev logs appear in terminal where you ran `npm run tauri dev`
# Look for error messages in backend output
```

---

## Common Tasks

### Modifying Graph Appearance

1. **Change Colors**
   - Update `globalSettings.colorScheme` in ConfigContext
   - Available schemes: 'warm-cool', 'rainbow', 'green-red'

2. **Change Dimensions**
   - Update `globalSettings.graphDimensions`
   - Calculated in `useGraphRenderer.calculateDimensions()`

3. **Add New UI Controls**
   - Update GraphConfiguration.jsx
   - Add to config context
   - Handle in rendering hooks

### Adding a New Export Format

1. **Update ExportService** in core library
2. **Add button to UI** in GraphApp.jsx
3. **Test export** with various configurations
4. **Document** new format

### Extending File Upload

1. **Support new file types**
   - Update `FileService.loadFiles()` in core
   - Add parsing logic for new format
   - Update column extraction

2. **Add file validation**
   - Check file size/structure
   - Validate required columns
   - Show helpful error messages

### Optimizing Performance

1. **Profile with DevTools**
   - Check React profiler for slow renders
   - Look for unnecessary re-renders

2. **Common optimizations**
   - Use `useCallback` for function props
   - Use `useMemo` for expensive calculations
   - Check dependency arrays in hooks

3. **Data-heavy operations**
   - Batch file processing uses fixed chunks
   - Graph rendering skips expensive operations in batch mode
   - Canvas sizing disabled in batch mode

---

## Best Practices

### Code Organization

1. **Keep components focused**
   - One responsibility per component
   - Move complex logic to hooks

2. **Use custom hooks**
   - Extract reusable logic
   - Makes testing easier
   - Improves code reuse

3. **Centralize configuration**
   - Use ConfigContext for state
   - Don't duplicate state in components
   - Makes debugging easier

### Error Handling

1. **Always validate input**
   ```javascript
   if (!csvData || csvData.length === 0) {
     handleError(new Error('No data'), 'Load a CSV file first');
     return;
   }
   ```

2. **Use context errors**
   - Use `useError()` for user-facing messages
   - Console.warn/error for developer info

3. **Handle edge cases**
   - Empty data
   - Invalid column selections
   - Corrupted files
   - Missing required fields

### Performance

1. **Memoize expensive calculations**
   ```javascript
   const dataRange = useMemo(() => {
     // Expensive calculation
     return { min, max };
   }, [dependencies]);
   ```

2. **Avoid prop drilling**
   - Use Context for deeply nested values
   - Reduces re-renders

3. **Batch updates**
   - Group related state updates
   - Prevents multiple renders

### Maintainability

1. **Write clear variable names**
   ```javascript
   // Good
   const csvData = await FileService.loadFiles(files);

   // Bad
   const d = await FileService.loadFiles(files);
   ```

2. **Document complex logic**
   ```javascript
   /**
    * Joins multiple X-axis columns into unified column
    * Uses first non-null value from candidates
    * @param {Array} candidates - Column candidates in priority order
    * @returns {*} First non-null value
    */
   ```

3. **Keep dependencies organized**
   - Import core functions from `@siimpli/graph-it-core`
   - Import utilities from hooks/contexts
   - Keep imports alphabetical

---

## Troubleshooting

### Issue: Hot reload not working

**Solution:**
- Save file again (sometimes needed)
- Check browser console for errors
- Restart dev server: `Ctrl+C` then `npm run dev`

### Issue: Graph not rendering

**Checklist:**
- Is CSV data loaded? Check `csvData` length
- Is X-axis selected? Check `graphConfig.xAxis`
- Is at least one Y-axis series selected? Check `graphConfig.series`
- Is logo loaded? Check `logoReady` state
- Check browser console for errors

### Issue: Batch processing slow

**Solutions:**
- Reduce number of files per batch
- Check file sizes (very large CSV files slow processing)
- Look for long-running calculations in graph rendering
- Consider using web version instead of Tauri for large batches

### Issue: Export fails

**Checklist:**
- Is graph rendered? (can't export without graph)
- Check file permissions (can write to Downloads?)
- Try different export format
- Check browser console for specific error

### Issue: State not persisting

**Solution:**
- ConfigContext doesn't persist between sessions
- For persistence, implement localStorage or database
- Configuration can be exported as JSON and re-imported

### Issue: Curve fitting produces invalid results

**Checklist:**
- Do you have at least 2 data points?
- Are data points valid numbers (not text)?
- Are there extreme outliers?
- Check mathematical validity of fit type chosen

---

## Working with the Headless Library

### Building on Top of Core Library

If you want to create your own graph interface (web API, desktop app, etc.):

```javascript
// 1. Install core library
npm install @siimpli/graph-it-core

// 2. Import and use in your app
import {
  renderGraph,
  FileService,
  parseColumnId,
  ExportService
} from '@siimpli/graph-it-core';

// 3. Create SVG element (or synthetic DOM in Node)
const svg = d3.select('#my-svg');

// 4. Prepare data
const csvData = [
  { time: 0, value: 10 },
  { time: 1, value: 20 }
];

// 5. Call renderGraph
const result = renderGraph({
  svg,
  csvData,
  graphConfig: {
    xAxis: 'time',
    series: [{ yAxis: 'value' }]
  },
  globalSettings: {
    colorScheme: 'warm-cool',
    graphDimensions: { width: 800, height: 600 }
  }
});

// 6. Export if needed
const pngBlob = await ExportService.exportAsPNG(
  svgRef,
  canvasRef,
  csvData,
  graphConfig,
  globalSettings
);
```

### Node.js / Server-Side Usage

For headless rendering without a DOM:

```javascript
// 1. Set up jsdom environment
import { JSDOM } from 'jsdom';
import * as d3 from 'd3';

const { window } = new JSDOM();
global.window = window;
global.document = window.document;

// 2. Create synthetic SVG element
const svg = d3.select(window.document.body)
  .append('svg')
  .attr('width', 800)
  .attr('height', 600);

// 3. Call renderGraph exactly as in browser
const result = renderGraph({
  svg,
  csvData,
  graphConfig,
  globalSettings
});

// 4. Serialize to string
const svgString = window.document.body.innerHTML;

// 5. Convert to PNG using resvg-js
import Resvg from '@resvg/resvg-js';

const resvg = new Resvg(svgString);
const pngBuffer = resvg.render().asPng();
fs.writeFileSync('output.png', pngBuffer);
```

### Extending the Core Library

To add new features to the core library:

**1. New graph type (e.g., pie chart)**:
```javascript
// In core/src/rendering/GraphCompositionRenderer.js

export class GraphCompositionRenderer {
  drawDataSeries(g, validData, scales, columnInfo, config) {
    const graphType = (config.graphType || 'scatter').toLowerCase();

    switch (graphType) {
      case 'scatter':
        this.drawScatter(g, validData, scales, ...);
        break;
      case 'line':
        this.drawLine(g, validData, scales, ...);
        break;
      case 'pie':  // NEW
        this.drawPie(g, validData, scales, ...);
        break;
      // ...
    }
  }

  drawPie(g, validData, scales, columnInfo, config) {
    // Pie chart rendering logic
  }
}
```

**2. New mathematical utility**:
```javascript
// In core/src/utils/mathUtils.js

export function calculatePercentiles(data, percentiles = [25, 50, 75]) {
  const sorted = [...data].sort((a, b) => a - b);
  return percentiles.map(p => {
    const index = (p / 100) * sorted.length;
    return sorted[Math.floor(index)];
  });
}

// Use in rendering:
const p25 = calculatePercentiles(validData, [25])[0];
const p75 = calculatePercentiles(validData, [75])[0];
g.append('line')
  .attr('y1', scales.yScale(p25))
  .attr('y2', scales.yScale(p75));
```

**3. New export format**:
```javascript
// In core/src/export/ExportService.js

static async exportAsSVG(svgRef, csvData, graphConfig, globalSettings) {
  const svgElement = svgRef.current;
  const svgString = new XMLSerializer().serializeToString(svgElement);

  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  // ... download logic
}

// Export from service
export class ExportService {
  static exportAsSVG = exportAsSVG;
  static exportAsPNG = exportAsPNG;
  static exportAsJSON = exportAsJSON;
}
```

### Testing Core Library Functions

```javascript
// Test CSV parsing
import { parseCSV } from '@siimpli/graph-it-core';

describe('parseCSV', () => {
  it('should infer numeric types', () => {
    const csv = 'x,y\n1,2.5\n3,4.5';
    const result = parseCSV(csv);
    expect(result.data[0].x).toBe(1);
    expect(typeof result.data[0].x).toBe('number');
  });

  it('should parse dates', () => {
    const csv = 'date,value\n2025-03-13,100';
    const result = parseCSV(csv);
    expect(result.data[0].date instanceof Date).toBe(true);
  });
});

// Test scale creation
import { ScaleFactory } from '@siimpli/graph-it-core';

describe('ScaleFactory', () => {
  it('should create appropriate scale for numeric data', () => {
    const data = [{ x: 0 }, { x: 100 }];
    const xAxisInfo = { columnName: 'x' };
    const scale = ScaleFactory.createScalesForGraph(
      data,
      xAxisInfo,
      [],
      800,
      600
    );
    expect(scale.xScale(0)).toBe(0);
    expect(scale.xScale(100)).toBe(800);
  });
});

// Test curve fitting
import { performCurveFitting } from '@siimpli/graph-it-core';

describe('performCurveFitting', () => {
  it('should fit linear regression', () => {
    const data = [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 3 }
    ];
    const result = performCurveFitting(data, config, [{ type: 'linear' }]);
    expect(result[0].result.equation).toMatch(/y = .*x/);
  });
});
```

### Debugging Core Library Issues

**Enable debug logging**:
```javascript
import { debugLog, debugWarn, enableDebugMode } from '@siimpli/graph-it-core';

// In your application
enableDebugMode(true);

// Now all internal operations log to console:
// [DEBUG] parseCSV: found 1000 rows
// [DEBUG] ScaleFactory: creating linear scale from 0 to 100
// [DEBUG] renderGraph: rendering 3 series
```

**Inspect intermediate values**:
```javascript
const result = renderGraph({
  svg,
  csvData,
  graphConfig,
  globalSettings
});

// result contains:
console.log(result.validData);      // Filtered data after validation
console.log(result.scales);         // D3 scales created
console.log(result.columnInfo);     // Parsed column information
console.log(result.margin);         // Calculated margins
```

### Synchronizing Core Library Updates

When the core library is updated, you need to update the UI:

```bash
# Update core library
npm update @siimpli/graph-it-core

# Or, for specific version
npm install @siimpli/graph-it-core@1.2.3

# Run tests to ensure compatibility
npm test

# Check for breaking changes in:
# - Function signatures
# - Configuration object shape
# - Export/import changes
```

Common breaking changes:
- New required fields in config objects
- Changed function parameters
- Renamed exports
- Different default behaviors

---

## Next Steps

1. **Read the README.md** for user-facing features
2. **Explore the core library** (`@siimpli/graph-it-core`)
3. **Examine existing components** for patterns
4. **Create a small feature** to practice the workflow
5. **Review error handling** patterns in codebase
6. **Set up your development environment** as described
7. **Make your first contribution!**

---

## Additional Resources

- [React Documentation](https://react.dev)
- [D3.js Documentation](https://d3js.org)
- [Tauri Documentation](https://tauri.app)
- [Vite Documentation](https://vitejs.dev)
- Project README.md for user documentation
- Core library repository for data processing details

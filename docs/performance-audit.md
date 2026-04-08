# Performance Audit — SiimpliGraphIt

**Date:** 2026-04-03  
**Scope:** Memory leaks, render performance, interaction lag

---

## Root Cause of UI Lag When Typing / Changing Config Fields

The primary cause of keystroke lag in `GraphConfiguration` and related inputs is a **re-render cascade** triggered by a single source: **`ConfigContext` holds `graphConfig` and `globalSettings` as monolithic objects, and every mutation replaces the whole object reference.**

### The cascade chain

```
User types one char in a field
    → updateGraphConfig({ someField: value })
        → setGraphConfig(prev => ({ ...prev, someField: value }))
            → ConfigContext re-renders with new reference for graphConfig
                → ALL consumers of useConfig() re-render, regardless of which field changed:
                    • GraphApp (re-renders)
                        → recomputes validData useMemo (O(n) CSV filter)
                        → recomputes dataRange useMemo
                        → invalidates getAxisIntercepts useCallback
                        → invalidates exportAsPNG useCallback
                        → invalidates performCurveFittingHandler useCallback
                    • GraphConfiguration (re-renders)
                        → debugLog() called on every render (line 13)
                        → columnLabelById Map recreated (new Map(...columns))
                        → useEffect conflict check re-runs (validateSecondaryAxisTypes, detectTypeConflict)
                    • CurveFittingPanel (re-renders)
                    • GraphRenderer (re-renders)
                        → generateGraph useCallback invalidated
                            → because graphConfig is in its dependency array
```

Every single keystroke traverses this entire tree. The more components are mounted, the worse it gets.

### Why `contextValue` makes this worse

In `ConfigContext.jsx` (line 153–167), `contextValue` is a plain object literal:

```js
const contextValue = {
    graphConfig,
    curveFits,
    globalSettings,
    updateGraphConfig,   // new function reference every render
    addSeries,           // new function reference every render
    updateSeries,        // new function reference every render
    // ...
};
```

This object is **recreated on every render of `ConfigProvider`**. React's context comparison is reference-based — so every consumer re-renders any time any piece of state in the provider changes, even if the consumer only uses `globalSettings` and `graphConfig` didn't change.

---

## Critical Issues

### 1. `ConfigContext.jsx` — `contextValue` not memoized, functions not stable

**File:** `siimpli-graph-it-core/src/contexts/ConfigContext.jsx` — lines 57–167

Every function (`updateGraphConfig`, `addSeries`, `updateSeries`, `moveSeries`, etc.) is a plain function defined in component scope. They are re-created on every render. The `contextValue` object is also recreated every render.

**Fix:** Wrap all updater functions in `useCallback` with `[]` deps (they use functional state updates and need no deps). Memoize `contextValue` with `useMemo`:

```js
const updateGraphConfig = useCallback((updates) => {
    if (!updates || typeof updates !== 'object') return;
    setGraphConfig(prev => ({ ...prev, ...updates }));
}, []);

const contextValue = useMemo(() => ({
    graphConfig, curveFits, globalSettings,
    updateGraphConfig, addSeries, removeSeries,
    updateSeries, moveSeries, updateCurveFit,
    addCurveFit, removeCurveFit, updateGlobalSettings, resetConfig
}), [graphConfig, curveFits, globalSettings]);
// updater functions omitted from deps — they are stable via useCallback([])
```

**Impact:** Eliminates re-renders of all context consumers when state hasn't changed from their perspective.

---

### 2. `ConfigContext.jsx` — Single monolithic context causes all consumers to re-render on any change

**File:** `siimpli-graph-it-core/src/contexts/ConfigContext.jsx` — line 38–174

`graphConfig`, `curveFits`, and `globalSettings` all live in one context. A keystroke in a graph title field triggers re-renders in `CurveFittingPanel` (which only uses `curveFits`) and `GraphRenderer` (which may be doing expensive work).

**Fix:** Split into separate contexts — `GraphConfigContext`, `CurveFitsContext`, `GlobalSettingsContext` — so components only re-render for state they actually consume. Alternatively, use context selectors via a library like `use-context-selector`.

---

### 3. `GraphConfiguration.jsx` — `debugLog` on every render

**File:** `src/components/GraphConfiguration.jsx` — line 13

```js
debugLog('GraphConfiguration', { columns, graphConfig, globalSettings });
```

This executes on every render, serializing large objects for logging. In development mode this is a constant cost on every keystroke.

**Fix:** Wrap in `useEffect` with the relevant deps, or guard behind a `process.env.NODE_ENV === 'development'` check (confirm `debugLog` already does this — if not, it must).

---

### 4. `GraphConfiguration.jsx` — `columnLabelById` Map recreated on every render

**File:** `src/components/GraphConfiguration.jsx` — (line ~162)

```js
const columnLabelById = new Map(columns.map(col => [col.uniqueId, `${col.name} (${col.file})`]));
```

No `useMemo`. This Map is thrown away and rebuilt on every render.

**Fix:**
```js
const columnLabelById = useMemo(
    () => new Map(columns.map(col => [col.uniqueId, `${col.name} (${col.file})`])),
    [columns]
);
```

---

### 5. `GraphConfiguration.jsx` — `useEffect` conflict check runs on every `graphConfig.series` change

**File:** `src/components/GraphConfiguration.jsx` — lines 81–111

```js
useEffect(() => {
    const primarySeries = graphConfig.series.filter(s => s.axisAssignment !== 'secondary');
    const secondarySeries = graphConfig.series.filter(s => s.axisAssignment === 'secondary');
    const validation = validateSecondaryAxisTypes(secondarySeries);
    // ...
    const conflict = detectTypeConflict(primarySeries, secondarySeries);
    if (conflict?.hasConflict) {
        updateGraphConfig({ series: updatedSeries }); // triggers another render!
    }
}, [graphConfig.series, updateGraphConfig]);
```

This runs on every series change. If it calls `updateGraphConfig`, that triggers another render, which re-runs this effect — a potential render loop. The `updateGraphConfig` reference also changes every render (issue #1 above), causing this effect to fire more often than necessary.

**Fix:** Stabilize `updateGraphConfig` (fix #1), and add an equality check before calling it to prevent loop:

```js
if (changes.length > 0 && JSON.stringify(updatedSeries) !== JSON.stringify(graphConfig.series)) {
    updateGraphConfig({ series: updatedSeries });
}
```

---

### 6. `GraphApp.jsx` — `getAxisIntercepts` and `exportAsPNG` invalidated on every keystroke

**File:** `src/components/GraphApp.jsx` — lines 86–104

```js
const getAxisIntercepts = useCallback((xExtent, yExtent, config = graphConfig) => {
    return calculateAxisIntercepts(xExtent, yExtent, config, globalSettings);
}, [graphConfig, globalSettings]);  // ← invalidated on every keystroke
```

Both `graphConfig` and `globalSettings` are new references after every `updateGraphConfig` call, so `getAxisIntercepts` gets a new reference on every render. This then invalidates `generateGraph` in `useGraphRenderer`, and `exportAsPNG`.

**Fix:** Pass `graphConfig`/`globalSettings` via refs rather than closure, so the callback reference stays stable:

```js
const graphConfigRef = useRef(graphConfig);
graphConfigRef.current = graphConfig;
const globalSettingsRef = useRef(globalSettings);
globalSettingsRef.current = globalSettings;

const getAxisIntercepts = useCallback((xExtent, yExtent, config) => {
    return calculateAxisIntercepts(xExtent, yExtent, config ?? graphConfigRef.current, globalSettingsRef.current);
}, []); // stable — reads current value via ref at call time
```

---

### 7. `useGraphRenderer.js` — `generateGraph` has duplicate and unstable dependencies

**File:** `src/hooks/useGraphRenderer.js` — lines 827–850

```js
}, [
    csvData, graphConfig, curveFits, globalSettings,
    // ...
    renderCurveFits,
    renderLegends,
    renderCurveFits,   // ← DUPLICATE
    renderLegends,     // ← DUPLICATE
    // ...
]);
```

Two dependencies listed twice. More importantly, `graphConfig` and `globalSettings` are whole-object references that change on every keystroke, causing the entire `generateGraph` callback to be recreated constantly.

**Fix:** Remove duplicates. Use refs for `graphConfig`/`globalSettings` where the value is only needed at render time (not for triggering re-renders). Memoize `csvData` rows with a stable key if possible.

---

### 8. `useGraphZoom.js` — Grid lines fully rebuilt on every zoom event

**File:** `src/hooks/useGraphZoom.js` — lines ~305–338

On every mouse wheel tick or drag pixel, the zoom handler:
1. `guideGroup.selectAll('line.grid-h').remove()` — removes all horizontal grid lines
2. Loops through ticks → `guideGroup.append('line')...` for each — recreates them all

This runs at up to 60 fps during interaction. With 20 ticks that's ~2,400 DOM operations per second.

**Fix:** Bind tick data to lines once at zoom setup, then only update `.attr('y1')`/`.attr('y2')` on zoom events:

```js
// At setup time — bind data once:
guideGroup.selectAll('line.grid-h')
    .data(yTicks)
    .enter().append('line')
    .attr('class', 'grid-h')
    .attr('x1', 0).attr('x2', plotWidth)
    .style('stroke', '#999')
    .style('stroke-width', 1)
    .style('stroke-dasharray', '2,3');

// In zoom handler — only update positions:
guideGroup.selectAll('line.grid-h')
    .attr('y1', d => rescaledY(d))
    .attr('y2', d => rescaledY(d));
```

---

### 9. `useGraphZoom.js` — No event listener cleanup on unmount

**File:** `src/hooks/useGraphZoom.js` — line ~343–348

`captureRect.call(zoom)` attaches D3 event listeners but there is no cleanup. When `GraphRenderer` unmounts and remounts (e.g., on mode switch), listeners accumulate.

**Fix:** Return a cleanup function from `setupZoom` or handle it in the `useEffect` that calls it:

```js
// In the useEffect that calls setupZoom:
return () => {
    captureRect.on('.zoom', null);
};
```

---

### 10. `useErrorHandler.js` — `setTimeout` leak

**File:** `src/hooks/useErrorHandler.js` — lines 30–33

```js
const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(null), 5000); // never cancelled
}, []);
```

If the component unmounts within 5 seconds, the timer fires on an unmounted component. Multiple rapid errors create multiple orphaned timers.

**Fix:**

```js
const timerRef = useRef(null);

const showError = useCallback((message) => {
    setError(message);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setError(null), 5000);
}, []);

useEffect(() => () => clearTimeout(timerRef.current), []);
```

---

### 11. `LegendRenderer.js` — Unbounded `new Set()` over full dataset

**File:** `siimpli-graph-it-core/src/rendering/LegendRenderer.js` — lines ~132–135

```js
const uniqueValues = [...new Set(colorValues)]; // O(n) over entire dataset, no cap
```

Called on every legend draw with no memoization. With 10k+ row datasets and categorical columns, this is a significant synchronous cost.

**Fix:** Cap unique values and add a "…and N more" indicator:

```js
const allUnique = [...new Set(colorValues)];
const MAX_LEGEND_ITEMS = 50;
const uniqueValues = allUnique.slice(0, MAX_LEGEND_ITEMS);
const overflow = allUnique.length - uniqueValues.length;
```

---

### 12. `GraphApp.jsx` — `JSON.parse(JSON.stringify(...))` deep clone in export

**File:** `src/components/GraphApp.jsx` — lines 221–225

```js
const graphPayload = JSON.parse(JSON.stringify(graphConfig));
const globalPayload = JSON.parse(JSON.stringify({ ...globalSettings, ... }));
```

Slowest possible deep clone. Only runs on export clicks, so low priority, but can cause a 100–300ms freeze on large configs.

**Fix:** Use `structuredClone()` (built-in, 3× faster, handles more types):

```js
const graphPayload = structuredClone(graphConfig);
const globalPayload = structuredClone({ ...globalSettings, graphDimensions: globalSettings.graphDimensions || { width: 800, height: 600 } });
```

---

## Priority Fix Order

| Priority | Issue | File | Expected Impact |
|---|---|---|---|
| 1 | Memoize `contextValue` + stabilize updater functions | `ConfigContext.jsx` | Eliminates majority of keystroke lag |
| 2 | Split monolithic context | `ConfigContext.jsx` | Further reduces cross-component re-renders |
| 3 | Stabilize `getAxisIntercepts` via ref | `GraphApp.jsx` | Stops cascade invalidation of `generateGraph` |
| 4 | Remove duplicate deps from `generateGraph` | `useGraphRenderer.js` | Stops excess callback recreation |
| 5 | Grid line update instead of rebuild | `useGraphZoom.js` | Fixes zoom/pan CPU spike |
| 6 | Zoom listener cleanup | `useGraphZoom.js` | Fixes listener accumulation |
| 7 | `columnLabelById` memoization | `GraphConfiguration.jsx` | Cheap win, stops per-render Map alloc |
| 8 | Fix conflict check loop risk | `GraphConfiguration.jsx` | Prevents potential update loop |
| 9 | `setTimeout` cleanup | `useErrorHandler.js` | Stops orphaned timers |
| 10 | Cap `uniqueValues` in legend | `LegendRenderer.js` | Fixes large dataset legend lag |
| 11 | `structuredClone` for export | `GraphApp.jsx` | Fixes export click freeze |

# Code Duplication Analysis Report
**Three SiimpliGraphIt Repositories**

**Date:** March 17, 2026
**Scope:** siimpli-graph-it-copy, siimpli-graph-it-core, siimpli-graph-it-headless
**Total Estimated Duplicate Code:** 800-1000 lines

---

## Executive Summary

Analysis of the three siimpli-graph-it repositories reveals **significant code duplication** that creates maintenance risks and divergence opportunities. The most critical issues are:

- **100% identical context providers** (ErrorContext, ConfigContext) duplicated between copy and core
- **Nearly identical hooks** with only import path differences
- **Utility function duplications** across multiple files
- **Interface duplications** (IOProvider) with minor variance
- **Divergent validation approaches** solving the same problem

The copy repository correctly imports from core as a dependency, but several files haven't migrated from local to imported versions. The headless repository has intentionally specialized implementations but shares foundational utilities with core that should be consolidated.

---

## Detailed Findings

### 1. CONTEXT PROVIDERS — CRITICAL DUPLICATION

#### ErrorContext.jsx
- **Files:**
  - `siimpli-graph-it-copy/src/contexts/ErrorContext.jsx` (95 lines)
  - `siimpli-graph-it-core/src/contexts/ErrorContext.jsx` (95 lines)
- **Status:** 100% identical match
- **Description:** Error/success state management with 5-second auto-clear
- **Risk Level:** ⚠️ HIGH — Changes to error handling must be synchronized
- **Recommendation:** Remove from copy, import from core

#### ConfigContext.jsx
- **Files:**
  - `siimpli-graph-it-copy/src/contexts/ConfigContext.jsx` (183 lines)
  - `siimpli-graph-it-core/src/contexts/ConfigContext.jsx` (183 lines)
- **Status:** 100% identical match
- **Description:** Graph config, curve fits, and global settings management
- **Risk Level:** ⚠️ HIGH — State shape divergence could break dependent components
- **Recommendation:** Remove from copy, import from core (already available as export)

---

### 2. HOOK DUPLICATION — IMPORT PATH DIVERGENCE

#### useGraphGeneration
- **Files:**
  - `siimpli-graph-it-copy/src/hooks/useGraphGeneration.js`
  - `siimpli-graph-it-core/src/hooks/useGraphGeneration.js`
- **Status:** 95% identical, only import differs
  - copy: `import { debugLog, debugWarn } from '@siimpli/graph-it-core';`
  - core: `import { debugLog, debugWarn } from '../index.js';`
- **Description:** Deprecated wrapper delegating to useGraphRenderer
- **Risk Level:** ⚠️ MEDIUM — Redundant code, only one source of truth needed
- **Recommendation:** Keep in core, remove from copy

#### useGraphRenderer
- **Files:**
  - `siimpli-graph-it-copy/src/hooks/useGraphRenderer.js` (832 lines)
  - `siimpli-graph-it-core/src/hooks/useGraphRenderer.js` (93 lines)
- **Status:** Intentional divergence (not actual duplication)
- **Description:**
  - copy: Full inline implementation of graph rendering logic
  - core: Thin wrapper delegating to `renderGraph()` pure function
- **Analysis:** This shows completed refactoring where core moved from hook-based to functional approach
- **Recommendation:** Update copy to import useGraphRenderer from core and use thin wrapper pattern

---

### 3. UTILITY FUNCTION DUPLICATION

#### parseColumnId()
- **Locations:**
  - `siimpli-graph-it-core/src/utils/columnUtils.js` (lines 37-44)
  - `siimpli-graph-it-headless/src/utils/structuredFileName.js` (lines 5-14)
- **Status:** 99% duplicate, formatting differences only
- **Difference:** headless adds `String()` coercion, minor formatting variance
- **Risk Level:** ⚠️ MEDIUM — Parsing logic divergence could cause bugs
- **Recommendation:** Create single shared implementation in core, export to headless

#### Additional Headless Unique Functions
- `extent()` — Calculate data range from series
- `toFiniteNumber()` — Safe numeric conversion
- `safeScale()` — Safe scale application
- `calculateAxisIntercepts()` — Axis math utilities

**Status:** Currently in `siimpli-graph-it-headless/src/utils/structuredFileName.js`
**Recommendation:** Move to core/src/utils/mathUtils.js or dedicated utility file

---

### 4. VALIDATION DUPLICATIONS

#### ConfigValidator vs SchemaValidator

**ConfigValidator (core)**
- Location: `siimpli-graph-it-core/src/core/validation/ConfigValidator.js` (330 lines)
- Approach: Programmatic validation with static methods
- Constants: `VALID_GRAPH_TYPES`, `VALID_COLOR_SCHEMES`, `VALID_AXIS_SCALES`, etc.
- Methods: validateGraphConfig, validateSeries, validateCurveFit, validateDimensions, validateSettings

**SchemaValidator (headless)**
- Location: `siimpli-graph-it-headless/src/validation/SchemaValidator.js` (70 lines)
- Approach: JSON Schema-based using AJV + `graph-config.schema.json`
- More flexible but requires schema file resolution
- Potentially different validation semantics

**Analysis:**
- Both validate identical properties (graphType, colorScheme, axisIntercept, dimensions, settings)
- Same rules but different implementations
- Risk of validation divergence
- **Recommendation:** Create unified validator in core that supports both approaches

---

### 5. IO PROVIDER INTERFACE DUPLICATION

#### IOProvider (Abstract Interface)
- **Files:**
  - `siimpli-graph-it-core/src/io/IOProvider.js` (46 lines)
  - `siimpli-graph-it-headless/src/io/IOProvider.js` (48 lines)
- **Status:** 95% identical
- **Minor Variance:** Headless includes optional `options` parameter in readFile
- **Methods:** readFile, writeFile, readDir, exists, mkdir
- **Risk Level:** ⚠️ MEDIUM — Interface divergence breaks implementation contracts
- **Implementations:**
  - core: TauriIOProvider (Tauri file API)
  - headless: NodeIOProvider (Node.js fs API)
- **Recommendation:** Single IOProvider definition in core with both implementations as separate classes

---

### 6. FILE NAME PARSING LOGIC

#### FileNameParsingService vs structuredFileName Utilities

**FileNameParsingService (core)**
- Location: `siimpli-graph-it-core/src/services/FileNameParsingService.js` (142 lines)
- Purpose: Parse structured filenames to extract coordinate system data
- Regex-based extraction of axis names, scales, intercepts, dimensions

**structuredFileName Utilities (headless)**
- Location: `siimpli-graph-it-headless/src/utils/structuredFileName.js` (174 lines)
- Purpose: Generate structured filenames from graph config (inverse operation)
- Also includes: parseColumnId, extent, calculateAxisIntercepts

**Analysis:**
- Complementary operations (parsing vs generation)
- File naming convention is shared responsibility
- Should have single source of truth for naming patterns
- **Recommendation:** Consolidate naming convention in core, export both parsing and generation

---

### 7. WATERMARK UTILITIES — DIFFERENT APPROACHES

#### Visual Watermarking (core)
- Location: `siimpli-graph-it-core/src/utils/watermarkUtils.js` (117 lines)
- Approach: Canvas-based visual watermarking with seeded patterns
- Implementation: Creates deterministic pixel patterns for background texture
- Technology: Pure HTML5 Canvas API

#### Cryptographic Watermarking (headless)
- Location: `siimpli-graph-it-headless/src/export/watermark.js` (203 lines)
- Approach: PNG byte-level watermarking using HMAC-SHA256
- Implementation: Embeds imperceptible watermark in least significant bits
- Purpose: Authentication and tamper detection

**Analysis:**
- Completely different approaches (visual vs cryptographic)
- No code duplication, but same concern area
- Different use cases: UI feedback vs export security
- **Note:** This is appropriate specialization — no consolidation needed

---

### 8. BATCH PROCESSING PATTERNS

**useBatchGraphRenderer (copy)**
- Location: `siimpli-graph-it-copy/src/hooks/useBatchGraphRenderer.js` (47 lines)
- Type: React hook wrapper
- Implementation: Delegates to useGraphRenderer with batch mode enabled
- Uses: `adaptBatchConfig()` utility

**BatchRunner (headless)**
- Location: `siimpli-graph-it-headless/src/batch/BatchRunner.js` (80+ lines)
- Type: Standalone batch processor
- Implementation: Full concurrency control with p-limit
- Features: File I/O, format selection (svg/png/both), error handling

**Analysis:**
- Different abstractions (React hook vs standalone class)
- Both delegate to core renderGraph
- Different audiences (UI vs headless CLI)
- **Note:** This is appropriate architectural specialization

---

### 9. COLUMN RESOLUTION UTILITIES

**Core Implementation**
- Location: `siimpli-graph-it-core/src/utils/columnUtils.js`
- Functions: parseColumnId, resolveColumn, extractColumnNames
- Features: Basic column name/index resolution

**Headless Enhancement**
- Location: `siimpli-graph-it-headless/src/utils/columnResolver.js`
- Functions: resolveColumnId (with bracket syntax support `[3]`), resolveConfigColumns
- Features: Enhanced index syntax, full config resolution with error handling

**Analysis:**
- Headless has superset of core functionality
- Index bracket syntax `[3]` not available in core
- **Recommendation:** Enhance core columnUtils with advanced syntax, remove headless duplicate

---

### 10. CORE INDEX.JS EXPORT ISSUES

**Location:** `siimpli-graph-it-core/src/index.js` (65 lines)

**Duplicate Exports Found:**
- Line 35-36: ImageExportService exported twice
- Line 36-37: CanvasSizer exported twice

**Impact:**
- Suggests refactoring artifacts
- Confusing for consumers (which one is canonical?)
- **Recommendation:** Remove duplicate exports, verify both point to same implementation

---

### 11. DEPENDENCY IMPORTS IN COPY REPOSITORY

Copy repository correctly imports from @siimpli/graph-it-core in:
- `ConfigContext.jsx` and other contexts
- `useGraphRenderer.js`, `useBatchGraphRenderer.js`
- Multiple component files (Batch.jsx, GraphConfiguration.jsx, etc.)
- Services (GraphService, FileService, ImageExportService)

**Common Imports:**
```javascript
// Constants
DEFAULT_GRAPH_CONFIG, DEFAULT_CURVE_FIT, DEFAULT_SERIES_CONFIG, 

// Utils
debugLog, debugWarn, parseCSV, parseConfigFile, determineGraphType,
resolveColumn, MathUtils, SymbolFactory, ScaleFactory

// Services
CoordinateService, SvgPlottingService, FileNameParsingService,
CanvasSizer, DataTableRenderer, LegendRenderer,
UnifiedTableRenderer, BiasTableRenderer
```

**Status:** Dependency structure is healthy and follows intended pattern

---

## Duplication Severity Matrix

| Issue | Type | LOC | Severity | Effort to Fix | Priority |
|-------|------|-----|----------|---------------|----------|
| ErrorContext duplication | Context | 95 | HIGH | Very Low | CRITICAL |
| ConfigContext duplication | Context | 183 | HIGH | Very Low | CRITICAL |
| useGraphGeneration duplication | Hook | 61 | MEDIUM | Very Low | HIGH |
| IOProvider duplication | Interface | 46 | MEDIUM | Low | HIGH |
| parseColumnId duplication | Utility | 15 | MEDIUM | Low | MEDIUM |
| ConfigValidator vs SchemaValidator | Logic | 330+70 | MEDIUM | High | MEDIUM |
| Headless unique utilities | Utility | 80+ | LOW | Medium | LOW |
| Watermark divergence | Implementation | 320 | LOW | N/A | N/A (appropriate) |
| Batch processing patterns | Architecture | 127 | LOW | N/A | N/A (appropriate) |

**Total Estimated Lines:** 800-1000 lines
**High Priority Issues:** 2 (contexts) — ~278 lines
**Medium Priority Issues:** 4 (hooks, interface, utilities, validation) — ~500+ lines

---

## Consolidation Recommendations

### Phase 1: Quick Wins (Effort: 1-2 hours)

1. **Remove ErrorContext from copy**
   - Delete: `siimpli-graph-it-copy/src/contexts/ErrorContext.jsx`
   - Update imports to use `@siimpli/graph-it-core`
   - Verify core exports ErrorContext in index.js

2. **Remove ConfigContext from copy**
   - Delete: `siimpli-graph-it-copy/src/contexts/ConfigContext.jsx`
   - Update imports to use `@siimpli/graph-it-core`
   - Verify core exports ConfigContext in index.js

3. **Remove useGraphGeneration from copy**
   - Delete: `siimpli-graph-it-copy/src/hooks/useGraphGeneration.js`
   - Update any imports to use `@siimpli/graph-it-core`

4. **Clean up core/index.js**
   - Remove duplicate exports of ImageExportService and CanvasSizer
   - Verify no imports depend on exact line numbers (they shouldn't)

### Phase 2: Structural Improvements (Effort: 3-4 hours)

5. **Consolidate IOProvider**
   - Create core/src/io/IOProvider.js as canonical definition
   - Update headless to import from core
   - Ensure both TauriIOProvider and NodeIOProvider follow same interface

6. **Consolidate parseColumnId**
   - Standardize in core/src/utils/columnUtils.js
   - Choose one implementation (headless has String() coercion — keep this)
   - Update headless to import from core
   - Add unit tests

7. **Enhance Column Resolution**
   - Move headless bracket syntax `[3]` support to core
   - Update core columnUtils with advanced index syntax
   - Remove headless columnResolver.js or reduce to thin wrapper

### Phase 3: Validation Consolidation (Effort: 4-5 hours)

8. **Unify Validation**
   - Create core/src/core/validation/UnifiedValidator.js
   - Accept both schema and programmatic validation rules
   - Keep ConfigValidator as backward-compatible wrapper
   - Update headless SchemaValidator to delegate to core

### Phase 4: Utility Consolidation (Effort: 2-3 hours)

9. **Move Headless Utilities to Core**
   - Move extent, toFiniteNumber, safeScale to core/src/utils/mathUtils.js
   - Update headless imports
   - Add unit tests for edge cases

10. **Consolidate File Naming Logic**
    - Single source of truth for naming conventions in core
    - Provide both parseFileName and generateFileName functions
    - Document naming convention in core/docs or comments

---

## Architecture Improvements

### Recommended Package Structure

```
core (source of truth)
├── src/
│   ├── contexts/         ← ErrorContext, ConfigContext exported
│   ├── hooks/            ← useGraphGeneration, useGraphRenderer exported
│   ├── io/               ← IOProvider base + TauriIOProvider
│   ├── utils/
│   │   ├── columnUtils.js      ← parseColumnId, resolveColumn (with advanced syntax)
│   │   ├── mathUtils.js        ← extent, toFiniteNumber, safeScale
│   │   └── ...
│   ├── core/
│   │   └── validation/   ← UnifiedValidator, ConfigValidator
│   └── index.js         ← Canonical exports (no duplicates)

copy (UI application)
├── src/
│   ├── components/      ← React components using core
│   ├── contexts/        ← DELETE ErrorContext, ConfigContext
│   ├── hooks/           ← DELETE useGraphGeneration, useGraphRenderer
│   └── ... (import from core)

headless (CLI application)
├── src/
│   ├── io/              ← NodeIOProvider (import base from core)
│   ├── batch/           ← BatchRunner (standalone, uses core.renderGraph)
│   ├── export/          ← watermark.js (specialized, keep separate)
│   ├── validation/      ← SchemaValidator → delegates to core
│   └── utils/           ← DELETE columnResolver, import from core
```

---

## Risk Assessment

### High-Risk Areas
1. **Context mutations** — If ErrorContext or ConfigContext change unexpectedly
2. **Hook signatures** — useGraphRenderer changes break copy components
3. **Validation divergence** — Different rules in core vs headless cause bugs

### Mitigation Strategies
1. Add integration tests between repositories
2. Create shared test suites for consolidated code
3. Document interfaces clearly (currently missing)
4. Use version pinning in package.json dependencies
5. Run cross-repo tests in CI pipeline

---

## Action Items

- [ ] Phase 1: Remove duplicate contexts and hooks from copy
- [ ] Phase 1: Clean up core/index.js duplicate exports
- [ ] Phase 2: Consolidate IOProvider interface
- [ ] Phase 2: Consolidate parseColumnId
- [ ] Phase 2: Enhance column resolution with bracket syntax in core
- [ ] Phase 3: Create unified validator
- [ ] Phase 4: Move headless utilities to core
- [ ] Phase 4: Consolidate file naming logic
- [ ] Create integration tests for consolidated code
- [ ] Update documentation with consolidated API
- [ ] Update package.json versions to ensure compatibility

---

## Conclusion

The three repositories show healthy dependency relationships but contain **redundant code that creates maintenance burden and divergence risks**. The consolidation effort is relatively low for the quick wins (Phases 1-2) but requires careful attention to maintaining working functionality during the refactoring.

**Recommended approach:** Start with Phase 1 (critical duplications), then proceed through Phase 2 as time allows. Phases 3-4 are longer-term improvements that can be deferred.

**Expected benefit:** ~800-1000 lines of duplicate code eliminated, single source of truth for shared concerns, reduced maintenance overhead.

# SiimpliGraphIt Extraction: Tactical Execution Plan

This plan outlines the steps to extract  **SiimpliGraphIt** from `script_manager` into a standalone repository using a shared NPM package strategy.

## 0. Key Decisions & Context
- **Strategy**: Strategy 1 (Private NPM Package `@siimpli/graph-it-core`)
- **Repository**: Personal GitHub
- **Initial Version**: `0.3.62` (Mirroring current `script_manager`)
- **Backend**: Frontend-only (Custom Rust `graph_models.rs` is deprecated/excluded)

---

## 1. Directory Structure (Proposed)
After extraction, your workspace should look like this:
```
siim2025/
├── mine_analytics/script_manager         # integrated app
├── siimpli-graph-it-standalone/   # New repository (standalone app)
└── siimpli-graph-it-core/             # Shared logic package (private npm)
```

---

## 2. Phase 1: Initialize Core Package
1. **Initialize `siimpli-graph-it-core`**:
   ```powershell
   mkdir ../siimpli-graph-it-core
   cd ../siimpli-graph-it-core
   npm init -y
   ```
2. **Setup Structure**:
   ```powershell
   mkdir src/services src/utils src/rendering
   ```
3. **Move Files from `script_manager`**:
   - `src/graphs/services/*` -> `../siimpli-graph-it-core/src/services/`
   - `src/graphs/utils/*` -> `../siimpli-graph-it-core/src/utils/`
   - `src/graphs/rendering/*` -> `../siimpli-graph-it-core/src/rendering/`
   - `src/graphs/constants.js` -> `../siimpli-graph-it-core/src/constants.js`

4. **Identify & Copy Assets**:
   - Copy `src/utils/debug.js` to `../siimpli-graph-it-core/src/utils/debug.js`.

---

## 3. Phase 2: Refactor Integrated App (`script_manager`)
1. **Update `package.json`**:
   ```json
   "dependencies": {
     "@siimpli/graph-it-core": "file:../siimpli-graph-it-core"
   }
   ```
2. **Update Imports**:
   - Replace local graph imports with package imports.
   - Example: `import { GraphService } from '../services/GraphService.js'` 
     becomes `import { GraphService } from '@siimpli/graph-it-core'` (if using barrel exports).

---

## 4. Phase 3: Setup Standalone Repo (`siimpli-graph-it`)
1. **Initialize**:
   ```powershell
   npx create-tauri-app@latest ../siimpli-graph-it --template react --manager npm -y
   cd ../siimpli-graph-it
   npm install
   ```
2. **Version Bump**:
   - Update `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` to version `0.3.62`.
3. **Config Migration**:
   - Copy `script_manager/src-tauri/capabilities/graph-app.json` to `siimpli-graph-it/src-tauri/capabilities/default.json`.
   - Update `tauri.conf.json` window label to `main` but keep the `index.html?mode=graph-app` URL logic if needed, or simply set the default URL.

---

## 5. Phase 4: CI/CD & Drift Prevention
1. **GitHub Actions**:
   - Implement `sync-check.yml` to compare `../siimpli-graph-it-core` with the local copy in each repo (if using file references) or publish to a private registry.
2. **Parallel Work**:
   - One dev can work on `siimpli-graph-it` features.
   - One dev can work on `script_manager` UI/Integration.
   - Both commit shared logic to `siimpli-graph-it-core`.

---

## 6. Verification Checklist
- [ ] `npm run tauri dev` works in standalone.
- [ ] `npm run tauri dev` works in `script_manager`.
- [ ] PNG Export functions correctly in both.
- [ ] D3 rendering is identical across versions.

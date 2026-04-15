# SonarQube Workflow Script Guide

This document explains how to use `scripts/run-sonarqube-workflow.ps1` to generate `sonarqube_results.json` for the Unit 12 reporting workflow.

## What This Script Does

The script collects SonarQube metrics and writes a structured JSON report matching the expected schema from `sonarqube_data_collection.md`.

It supports two collection strategies:

1. Native Sonar history mode
- Uses Sonar history APIs when historical data exists.
- Produces pre/post values from Sonar analysis history.

2. Git synthetic baseline mode
- Uses two git commit snapshots (pre and post) and scans them into separate Sonar project keys.
- Produces pre/post values even when Sonar historical data is not available.
- Marks metric data source as `manual_read`.

## Output

By default, output is written to:
- `<repoRoot>/sonarqube_results.json`

If `-WorkflowFilePath` is provided, output is written beside that file:
- `<workflowDir>/sonarqube_results.json`

## Requirements

- Windows PowerShell
- Node/npm in PATH
- `npx sonarqube-scanner` available
- SonarQube reachable (for local Docker: `http://localhost:9000`)
- SONAR token available (session env or User env var `SONAR_TOKEN`)

## Common Parameters

- `-SonarHostUrl` Sonar base URL. Default: env `SONAR_HOST_URL` or `http://localhost:9000`
- `-SonarToken` Sonar token. If omitted, script falls back to Windows User env var `SONAR_TOKEN`
- `-ProjectKey` Target project key. If omitted, read from `sonar-project.properties`
- `-AiAdoptionDate` Boundary date in `YYYY-MM-DD`
- `-AiAdoptionConfidence` One of: `exact`, `approximate`, `estimated`, `unavailable`
- `-AiAdoptionEvidence` Short evidence description for the boundary
- `-WorkflowFilePath` Path to workflow markdown to place output beside it
- `-ChurnDays` Window size for churn comparison. Default: 30
- `-RunScan` Run Sonar scan before data collection
- `-RunCoverage` Run tests with coverage before scan
- `-StartSonar` Start local Docker container named `sonarqube` if needed
- `-SnapshotRetryAttempts` Number of retries for snapshot API fetch
- `-SnapshotRetryDelaySeconds` Delay between snapshot retries
- `-SelfTest` Run internal script self-tests only

### Synthetic Baseline Parameters

- `-UseGitSyntheticBaseline` Enable git-based pre/post reconstruction
- `-PreAiRef` Explicit pre-AI commit ref/sha
- `-PostAiRef` Explicit post-AI commit ref/sha

If `-UseGitSyntheticBaseline` is enabled and refs are not supplied, the script resolves refs from `-AiAdoptionDate`.

## Recommended Commands

### 1) Quick Script Sanity Check

powershell -ExecutionPolicy Bypass -File .\scripts\run-sonarqube-workflow.ps1 -SelfTest

### 2) Local Docker Sonar, Snapshot/History Collection

powershell -ExecutionPolicy Bypass -File .\scripts\run-sonarqube-workflow.ps1 \
  -SonarHostUrl "http://localhost:9000" \
  -WorkflowFilePath "c:\Users\haris\Downloads\sonarqube_data_collection.md" \
  -AiAdoptionDate "2026-01-01" \
  -AiAdoptionConfidence approximate \
  -AiAdoptionEvidence "manual boundary" \
  -ChurnDays 60 \
  -RunScan

### 3) Git Synthetic Baseline (Explicit Refs)

powershell -ExecutionPolicy Bypass -File .\scripts\run-sonarqube-workflow.ps1 \
  -SonarHostUrl "http://localhost:9000" \
  -WorkflowFilePath "c:\Users\haris\Downloads\sonarqube_data_collection.md" \
  -AiAdoptionDate "2026-01-01" \
  -AiAdoptionConfidence approximate \
  -AiAdoptionEvidence "manual boundary" \
  -ChurnDays 60 \
  -UseGitSyntheticBaseline \
  -PreAiRef "4163a3cfde8c182cc56343ed56d041c8e6ba47b0" \
  -PostAiRef "46b7ef335561148aa7cacf39fd2370f2dcc4b3bb" \
  -RunScan \
  -SnapshotRetryAttempts 48 \
  -SnapshotRetryDelaySeconds 5

### 4) Re-collect Only (No New Scan), Useful After CE Processing Delay

powershell -ExecutionPolicy Bypass -File .\scripts\run-sonarqube-workflow.ps1 \
  -SonarHostUrl "http://localhost:9000" \
  -WorkflowFilePath "c:\Users\haris\Downloads\sonarqube_data_collection.md" \
  -AiAdoptionDate "2026-01-01" \
  -AiAdoptionConfidence approximate \
  -AiAdoptionEvidence "manual boundary" \
  -ChurnDays 60 \
  -UseGitSyntheticBaseline \
  -PreAiRef "4163a3cfde8c182cc56343ed56d041c8e6ba47b0" \
  -PostAiRef "46b7ef335561148aa7cacf39fd2370f2dcc4b3bb" \
  -SnapshotRetryAttempts 48 \
  -SnapshotRetryDelaySeconds 5

### 5) Run This Workflow Against Another Repository (Core Example)

You can run the script from this repository but target another repository by passing `-RepoPath`.

The target repository should contain a valid `sonar-project.properties` file with `sonar.projectKey`.

Example for `siimpli-graph-it-core` using explicit synthetic refs:

powershell -ExecutionPolicy Bypass -File .\scripts\run-sonarqube-workflow.ps1 \
  -RepoPath "c:\Users\haris\Work\Siim2025\siimpli-graph-it-core" \
  -SonarHostUrl "http://localhost:9000" \
  -AiAdoptionDate "2026-01-01" \
  -AiAdoptionConfidence approximate \
  -AiAdoptionEvidence "manual boundary for core run" \
  -ChurnDays 60 \
  -UseGitSyntheticBaseline \
  -PreAiRef "c450997a849d76db9bd5de7c379087c9dbdcf728" \
  -PostAiRef "5c06d35cdd011024bcee4893baf3ad9763b1d334" \
  -RunScan \
  -SnapshotRetryAttempts 48 \
  -SnapshotRetryDelaySeconds 5

Output will be written to `<RepoPath>/sonarqube_results.json` unless `-WorkflowFilePath` is provided.

## Notes on Behavior

- If Sonar history is unavailable, script falls back to snapshot behavior unless synthetic mode is enabled.
- In synthetic mode, the script creates temporary git worktrees and scans each ref under synthetic Sonar project keys.
- If no commit exists before `-AiAdoptionDate`, the script falls back to the repository root commit and records this in `collection_notes`.
- Scanner is forced to the provided `-SonarHostUrl` to avoid accidental SonarCloud targeting.
- LCOV ingestion is disabled unless `-RunCoverage` is used, reducing scan failures in path-heavy environments.

## Troubleshooting

1. Most values are `null`
- Check `preflight_failures` in output JSON.
- Ensure analysis completed and Sonar background task finished.
- Increase retry settings (`-SnapshotRetryAttempts`, `-SnapshotRetryDelaySeconds`).

2. Scan appears successful but post values are missing
- Sonar CE processing may still be running.
- Run collection-only command again after a short delay.

3. Wrong server target (SonarCloud vs local)
- Pass `-SonarHostUrl "http://localhost:9000"` explicitly.

4. Token issues
- Ensure `SONAR_TOKEN` exists in User env or pass `-SonarToken` directly.

5. Synthetic baseline has identical pre/post values
- Your chosen refs may point to the same commit.
- Use explicit, distinct refs for pre and post.

## Maintenance Tips

- Keep this script as the single source of truth for report metric extraction.
- If schema changes, update output keys and this document together.
- Prefer synthetic mode when historical Sonar data is missing or incomplete.

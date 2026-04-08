param(
    [string]$SonarHostUrl = $(if ($env:SONAR_HOST_URL) { $env:SONAR_HOST_URL } else { "http://localhost:9000" }),
    [string]$SonarToken = $env:SONAR_TOKEN,
    [int]$ChurnDays = 30,
    [switch]$UseGitSyntheticBaseline,
    [string]$PreAiRef,
    [string]$PostAiRef,
    [string]$ProjectKey,
    [string]$RepoPath,
    [string]$AiAdoptionDate,
    [ValidateSet("exact", "approximate", "estimated", "unavailable")]
    [string]$AiAdoptionConfidence,
    [string]$AiAdoptionEvidence,
    [string]$WorkflowFilePath,
    [int]$SnapshotRetryAttempts = 12,
    [int]$SnapshotRetryDelaySeconds = 5,
    [switch]$RunScan,
    [switch]$RunCoverage,
    [switch]$StartSonar,
    [switch]$SelfTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "\n==> $Message" -ForegroundColor Cyan
}

function Assert-Condition {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "SelfTest failed: $Message"
    }
}

function Get-DeltaDirection {
    param($PreValue, $PostValue)

    if ($null -eq $PreValue -or $null -eq $PostValue) {
        return "unknown"
    }

    $preNum = [double]$PreValue
    $postNum = [double]$PostValue

    if ($postNum -gt $preNum) { return "increase" }
    if ($postNum -lt $preNum) { return "decrease" }
    return "unchanged"
}

function Get-DefectDensityPerKloc {
    param($Bugs, $Ncloc)

    if ($null -eq $Bugs -or $null -eq $Ncloc -or [double]$Ncloc -le 0) {
        return $null
    }

    return [math]::Round(([double]$Bugs / [double]$Ncloc) * 1000.0, 3)
}

function Run-SelfTest {
    Write-Step "Running workflow self-test"
    Assert-Condition -Condition ((Get-DeltaDirection -PreValue 1 -PostValue 2) -eq "increase") -Message "Delta increase"
    Assert-Condition -Condition ((Get-DeltaDirection -PreValue 2 -PostValue 1) -eq "decrease") -Message "Delta decrease"
    Assert-Condition -Condition ((Get-DeltaDirection -PreValue 2 -PostValue 2) -eq "unchanged") -Message "Delta unchanged"
    Assert-Condition -Condition ((Get-DeltaDirection -PreValue $null -PostValue 2) -eq "unknown") -Message "Delta unknown"
    Assert-Condition -Condition ((Get-DefectDensityPerKloc -Bugs 5 -Ncloc 1000) -eq 5.0) -Message "Defect density formula"
    Assert-Condition -Condition ($null -eq (Get-DefectDensityPerKloc -Bugs 1 -Ncloc 0)) -Message "Defect density null guard"
    Write-Host "Self-test passed." -ForegroundColor Green
}

function Get-AuthHeaders {
    param([string]$Token)

    if (-not $Token) { return @{} }
    $authBytes = [System.Text.Encoding]::ASCII.GetBytes("${Token}:")
    $authHeader = "Basic " + [Convert]::ToBase64String($authBytes)
    return @{ Authorization = $authHeader }
}

function Invoke-SonarGet {
    param(
        [string]$HostUrl,
        [string]$Path,
        [hashtable]$Query,
        [string]$Token
    )

    $pairs = @()
    foreach ($k in $Query.Keys) {
        $pairs += ("{0}={1}" -f [uri]::EscapeDataString($k), [uri]::EscapeDataString([string]$Query[$k]))
    }
    $qs = [string]::Join("&", $pairs)
    $uri = "$HostUrl$Path"
    if ($qs) {
        $uri = "${uri}?$qs"
    }

    try {
        return Invoke-RestMethod -Method Get -Uri $uri -Headers (Get-AuthHeaders -Token $Token)
    }
    catch {
        $statusCode = $null
        if ($_.Exception -and $_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        # If auth fails and the server allows anonymous reads, retry once without auth.
        if (($statusCode -eq 401 -or $statusCode -eq 403) -and $Token) {
            return Invoke-RestMethod -Method Get -Uri $uri -Headers @{}
        }

        throw
    }
}

function Convert-MeasuresToMap {
    param($MeasureResponse)

    $map = @{}
    if ($null -eq $MeasureResponse -or $null -eq $MeasureResponse.component -or $null -eq $MeasureResponse.component.measures) {
        return $map
    }

    foreach ($m in $MeasureResponse.component.measures) {
        $map[$m.metric] = $m.value
    }
    return $map
}

function Get-MapNumberOrNull {
    param(
        [hashtable]$Map,
        [string]$Key
    )

    if ($Map.ContainsKey($Key) -and $null -ne $Map[$Key] -and $Map[$Key] -ne "") {
        return [double]$Map[$Key]
    }
    return $null
}

function Get-HistorySeriesMap {
    param(
        [string]$HostUrl,
        [string]$Token,
        [string]$Project,
        [string[]]$Metrics
    )

    $resp = Invoke-SonarGet -HostUrl $HostUrl -Path "/api/measures/search_history" -Query @{
        component = $Project
        metrics = ([string]::Join(",", $Metrics))
        ps = "1000"
    } -Token $Token

    $map = @{}
    foreach ($m in $resp.measures) {
        $history = @()
        foreach ($h in $m.history) {
            if ($null -ne $h.value -and $h.value -ne "") {
                $history += [pscustomobject]@{
                    Date = [datetime]$h.date
                    Value = [double]$h.value
                }
            }
        }
        $map[$m.metric] = $history
    }

    return $map
}

function Get-HistoryValueAtBoundary {
    param(
        [hashtable]$HistoryByMetric,
        [string]$Metric,
        [datetime]$Boundary,
        [ValidateSet("pre", "post")]
        [string]$Phase
    )

    if (-not $HistoryByMetric.ContainsKey($Metric)) {
        return $null
    }

    $series = @($HistoryByMetric[$Metric] | Sort-Object -Property Date)
    if ($series.Count -eq 0) {
        return $null
    }

    if ($Phase -eq "pre") {
        $candidates = @($series | Where-Object { $_.Date -le $Boundary })
        if ($candidates.Count -gt 0) {
            return $candidates[-1].Value
        }
        return $null
    }

    $postCandidates = @($series | Where-Object { $_.Date -ge $Boundary })
    if ($postCandidates.Count -gt 0) {
        return $postCandidates[-1].Value
    }

    return $series[-1].Value
}

function Get-ProjectMetricsSnapshot {
    param(
        [string]$HostUrl,
        [string]$Token,
        [string]$Project
    )

    $metricKeys = "bugs,ncloc,security_hotspots,vulnerabilities,duplicated_lines_density,code_smells,sqale_debt_ratio,coverage"
    $resp = Invoke-SonarGet -HostUrl $HostUrl -Path "/api/measures/component" -Query @{
        component = $Project
        metricKeys = $metricKeys
    } -Token $Token

    return Convert-MeasuresToMap -MeasureResponse $resp
}

function Get-ProjectMetricsSnapshotWithRetry {
    param(
        [string]$HostUrl,
        [string]$Token,
        [string]$Project,
        [int]$Attempts,
        [int]$DelaySeconds
    )

    $lastError = $null
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            return Get-ProjectMetricsSnapshot -HostUrl $HostUrl -Token $Token -Project $Project
        }
        catch {
            $lastError = $_
            if ($i -lt $Attempts) {
                Start-Sleep -Seconds $DelaySeconds
            }
        }
    }

    throw $lastError
}

function Get-ProjectAnalysisWindow {
    param(
        [string]$HostUrl,
        [string]$Token,
        [string]$Project,
        [datetime]$Boundary
    )

    $resp = Invoke-SonarGet -HostUrl $HostUrl -Path "/api/project_analyses/search" -Query @{
        project = $Project
        ps = "500"
    } -Token $Token

    $analyses = @($resp.analyses | ForEach-Object {
            [pscustomobject]@{
                Key = $_.key
                Date = [datetime]$_.date
            }
        } | Sort-Object -Property Date)

    $pre = @($analyses | Where-Object { $_.Date -le $Boundary })
    $post = @($analyses | Where-Object { $_.Date -ge $Boundary })

    return [pscustomobject]@{
        PreAnalysisKey = if ($pre.Count -gt 0) { $pre[-1].Key } else { $null }
        PostAnalysisKey = if ($post.Count -gt 0) { $post[-1].Key } elseif ($analyses.Count -gt 0) { $analyses[-1].Key } else { $null }
    }
}

function Get-QualityGateStatus {
    param(
        [string]$HostUrl,
        [string]$Token,
        [string]$Project,
        [string]$AnalysisKey
    )

    try {
        $query = @{ projectKey = $Project }
        if ($AnalysisKey) {
            $query.analysisId = $AnalysisKey
        }

        $resp = Invoke-SonarGet -HostUrl $HostUrl -Path "/api/qualitygates/project_status" -Query $query -Token $Token
        $status = [string]$resp.projectStatus.status
        if ($status -eq "OK") { return "PASSED" }
        if ($status -eq "ERROR") { return "FAILED" }
        return "unknown"
    }
    catch {
        return "unknown"
    }
}

function Get-GitAddsDeletes {
    param(
        [string]$Path,
        [string]$SinceDate,
        [string]$UntilDate
    )

    Push-Location $Path
    try {
        $lines = git log --since="$SinceDate" --until="$UntilDate" --pretty=format: --numstat
        if ($LASTEXITCODE -ne 0) {
            throw "git log failed"
        }

        $added = 0
        $deleted = 0
        foreach ($line in $lines) {
            if ($line -match '^(\d+)\s+(\d+)\s+') {
                $added += [int]$matches[1]
                $deleted += [int]$matches[2]
            }
        }

        return [pscustomobject]@{
            Added = $added
            Deleted = $deleted
            Rate = if ($added -gt 0) { [math]::Round(($deleted / [double]$added) * 100.0, 3) } else { 0.0 }
        }
    }
    finally {
        Pop-Location
    }
}

function Get-RepoFirstCommitDate {
    param([string]$Path)

    Push-Location $Path
    try {
        $date = git log --reverse --format=%cs -n 1
        if ($LASTEXITCODE -ne 0 -or -not $date) {
            return $null
        }
        return [string]$date
    }
    finally {
        Pop-Location
    }
}

function Get-GitCommitShortHash {
    param(
        [string]$Path,
        [string]$Ref
    )

    Push-Location $Path
    try {
        $hash = git rev-parse --short "$Ref"
        if ($LASTEXITCODE -ne 0 -or -not $hash) {
            throw "Unable to resolve ref '$Ref'."
        }
        return [string]$hash
    }
    finally {
        Pop-Location
    }
}

function Resolve-SyntheticRefsByDate {
    param(
        [string]$Path,
        [string]$BoundaryDate
    )

    Push-Location $Path
    try {
        $resolutionNote = ""

        $pre = ((git rev-list -n 1 --before="$BoundaryDate 23:59:59" HEAD) | Select-Object -First 1)
        $pre = if ($null -eq $pre) { "" } else { [string]$pre }
        $pre = $pre.Trim()

        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($pre)) {
            $pre = ((git rev-list --max-parents=0 HEAD) | Select-Object -First 1)
            $pre = if ($null -eq $pre) { "" } else { [string]$pre }
            $pre = $pre.Trim()
            if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($pre)) {
                throw "Unable to resolve a pre-AI commit before $BoundaryDate, and no fallback commit was found."
            }
            $resolutionNote = "No commit exists before $BoundaryDate; using repository root commit as synthetic pre-AI baseline."
        }

        $postCandidates = git rev-list --reverse --since="$BoundaryDate 00:00:00" HEAD
        $post = $null
        if ($LASTEXITCODE -eq 0 -and $postCandidates) {
            $post = ($postCandidates | Select-Object -First 1)
        }
        $post = if ($null -eq $post) { "" } else { [string]$post }
        $post = $post.Trim()

        if ([string]::IsNullOrWhiteSpace($post)) {
            $post = git rev-parse HEAD
            $post = if ($null -eq $post) { "" } else { [string]$post }
            $post = $post.Trim()
            if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($post)) {
                throw "Unable to resolve post-AI commit."
            }
        }

        return [pscustomobject]@{
            PreRef = [string]$pre
            PostRef = [string]$post
            ResolutionNote = $resolutionNote
        }
    }
    finally {
        Pop-Location
    }
}

function New-GitWorktreeForRef {
    param(
        [string]$RepoRoot,
        [string]$Ref,
        [string]$Label
    )

    $dir = Join-Path $env:TEMP ("sq-{0}-{1}" -f $Label, [guid]::NewGuid().ToString("N"))
    Push-Location $RepoRoot
    try {
        git worktree add --detach "$dir" "$Ref" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create worktree for ref '$Ref'."
        }
        return $dir
    }
    finally {
        Pop-Location
    }
}

function Remove-GitWorktree {
    param(
        [string]$RepoRoot,
        [string]$WorktreePath
    )

    if (-not (Test-Path $WorktreePath)) {
        return
    }

    Push-Location $RepoRoot
    try {
        git worktree remove --force "$WorktreePath" | Out-Null
    }
    finally {
        Pop-Location
    }
}

function Try-DetectAiAdoptionBoundary {
    param([string]$Path)

    Push-Location $Path
    try {
        $aiRegex = '(copilot|claude|cursor|ai)'
        $log = git log --reverse --date=short --pretty=format:%cs`t%s
        if ($LASTEXITCODE -eq 0) {
            foreach ($entry in $log) {
                if ($entry -match '^([^\t]+)\t(.+)$') {
                    $d = $matches[1]
                    $msg = $matches[2]
                    if ($msg -match $aiRegex) {
                        return [pscustomobject]@{
                            Date = $d
                            Confidence = "estimated"
                            Evidence = "Detected AI-related commit message: $msg"
                        }
                    }
                }
            }
        }

        $aiConfigCandidates = @(".claude.md", ".cursorrules", ".copilot-instructions.md", "AGENTS.md")
        foreach ($candidate in $aiConfigCandidates) {
            $introduced = git log --diff-filter=A --format=%cs -- "$candidate" | Select-Object -First 1
            if ($LASTEXITCODE -eq 0 -and $introduced) {
                return [pscustomobject]@{
                    Date = $introduced
                    Confidence = "approximate"
                    Evidence = "AI config introduced: $candidate"
                }
            }
        }

        return $null
    }
    finally {
        Pop-Location
    }
}

function Invoke-ProjectScan {
    param(
        [string]$ProjectPath,
        [string]$HostUrl,
        [string]$Token,
        [string]$ProjectKeyOverride,
        [string]$ProjectNameOverride,
        [switch]$Coverage
    )

    Push-Location $ProjectPath
    try {
        $scannerArgs = @()

        if ($Coverage) {
            npm run test -- --coverage --coverage.reporter=lcov --coverage.reporter=text
        }
        else {
            # Avoid coverage sensor traversal failures when lcov is not intentionally produced.
            $scannerArgs += "-Dsonar.javascript.lcov.reportPaths="
        }

        # Force scanner target so inherited machine-level env does not redirect to SonarCloud.
        $env:SONAR_HOST_URL = $HostUrl
        if ($Token) {
            $env:SONAR_TOKEN = $Token
        }
        if ($ProjectKeyOverride) {
            $scannerArgs += "-Dsonar.projectKey=$ProjectKeyOverride"
        }
        if ($ProjectNameOverride) {
            $scannerArgs += "-Dsonar.projectName=$ProjectNameOverride"
        }
        & npx sonarqube-scanner @scannerArgs
        if ($LASTEXITCODE -ne 0) {
            throw "Sonar scan failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Get-OutputPath {
    param(
        [string]$WorkflowPath,
        [string]$RepoRoot
    )

    if ($WorkflowPath) {
        return (Join-Path (Split-Path -Parent $WorkflowPath) "sonarqube_results.json")
    }
    return (Join-Path $RepoRoot "sonarqube_results.json")
}

if ($SelfTest) {
    Run-SelfTest
    exit 0
}

if (-not $SonarToken) {
    $SonarToken = [System.Environment]::GetEnvironmentVariable("SONAR_TOKEN", "User")
}

$repoRoot = if ($RepoPath) { $RepoPath } else { Split-Path -Parent $PSScriptRoot }
if (-not (Test-Path $repoRoot)) {
    throw "RepoPath not found: $repoRoot"
}

if (-not $ProjectKey) {
    $projectPropsPath = Join-Path $repoRoot "sonar-project.properties"
    if (Test-Path $projectPropsPath) {
        $line = Get-Content $projectPropsPath | Where-Object { $_ -match '^\s*sonar\.projectKey\s*=' } | Select-Object -First 1
        if ($line -match '=\s*(.+)\s*$') {
            $ProjectKey = $matches[1]
        }
    }
}

$syntheticMode = [bool]$UseGitSyntheticBaseline
$resolvedPreAiRef = $PreAiRef
$resolvedPostAiRef = $PostAiRef
$syntheticPreProjectKey = $null
$syntheticPostProjectKey = $null
$syntheticRefResolutionNote = ""

if ($syntheticMode -and -not $AiAdoptionDate -and (-not $resolvedPreAiRef -or -not $resolvedPostAiRef)) {
    $detectedBoundaryEarly = Try-DetectAiAdoptionBoundary -Path $repoRoot
    if ($detectedBoundaryEarly) {
        $AiAdoptionDate = $detectedBoundaryEarly.Date
        if (-not $AiAdoptionConfidence) { $AiAdoptionConfidence = $detectedBoundaryEarly.Confidence }
        if (-not $AiAdoptionEvidence) { $AiAdoptionEvidence = $detectedBoundaryEarly.Evidence }
    }
}

if ($syntheticMode -and (-not $resolvedPreAiRef -or -not $resolvedPostAiRef)) {
    if (-not $AiAdoptionDate) {
        throw "UseGitSyntheticBaseline requires AiAdoptionDate, or explicit PreAiRef and PostAiRef."
    }

    $resolvedRefs = Resolve-SyntheticRefsByDate -Path $repoRoot -BoundaryDate $AiAdoptionDate
    $resolvedPreAiRef = $resolvedRefs.PreRef
    $resolvedPostAiRef = $resolvedRefs.PostRef
    $syntheticRefResolutionNote = $resolvedRefs.ResolutionNote
}

if ($syntheticMode) {
    if (-not $ProjectKey) {
        throw "ProjectKey is required for synthetic baseline mode."
    }

    $preShort = Get-GitCommitShortHash -Path $repoRoot -Ref $resolvedPreAiRef
    $postShort = Get-GitCommitShortHash -Path $repoRoot -Ref $resolvedPostAiRef
    $syntheticPreProjectKey = "$ProjectKey-preai-$preShort"
    $syntheticPostProjectKey = "$ProjectKey-postai-$postShort"
}

if ($StartSonar) {
    Write-Step "Starting SonarQube container (if requested)"
    docker start sonarqube | Out-Null
    if ($LASTEXITCODE -ne 0) {
        docker run -d --name sonarqube -p 9000:9000 sonarqube:lts-community | Out-Null
    }
}

if ($RunScan) {
    if ($syntheticMode) {
        Write-Step "Running synthetic baseline Sonar scans"
        $preWorktree = $null
        $postWorktree = $null
        try {
            $preWorktree = New-GitWorktreeForRef -RepoRoot $repoRoot -Ref $resolvedPreAiRef -Label "preai"
            $postWorktree = New-GitWorktreeForRef -RepoRoot $repoRoot -Ref $resolvedPostAiRef -Label "postai"

            Invoke-ProjectScan -ProjectPath $preWorktree -HostUrl $SonarHostUrl -Token $SonarToken -ProjectKeyOverride $syntheticPreProjectKey -ProjectNameOverride $syntheticPreProjectKey -Coverage:$false
            Invoke-ProjectScan -ProjectPath $postWorktree -HostUrl $SonarHostUrl -Token $SonarToken -ProjectKeyOverride $syntheticPostProjectKey -ProjectNameOverride $syntheticPostProjectKey -Coverage:$false
        }
        finally {
            if ($preWorktree) { Remove-GitWorktree -RepoRoot $repoRoot -WorktreePath $preWorktree }
            if ($postWorktree) { Remove-GitWorktree -RepoRoot $repoRoot -WorktreePath $postWorktree }
        }
    }
    else {
        Write-Step "Running Sonar scan"
        Invoke-ProjectScan -ProjectPath $repoRoot -HostUrl $SonarHostUrl -Token $SonarToken -Coverage:$RunCoverage
    }
}

$preflightFailures = New-Object System.Collections.Generic.List[string]
$validationWarnings = New-Object System.Collections.Generic.List[string]
$collectionNotes = New-Object System.Collections.Generic.List[string]

$sonarAccessible = $false
$historyAvailable = $false
$snapshotOnly = $false
$snapshotMeasures = @{}
$snapshotPreMeasures = @{}
$snapshotPostMeasures = @{}
$historyMap = @{}

Write-Step "Pre-flight checks"

if (-not $ProjectKey) {
    $preflightFailures.Add("Project key is unknown.")
}

if (-not $SonarToken) {
    $preflightFailures.Add("SONAR_TOKEN is missing. Snapshot/history API calls may fail.")
}

try {
    $statusResp = Invoke-SonarGet -HostUrl $SonarHostUrl -Path "/api/system/status" -Query @{} -Token $SonarToken
    if ($statusResp.status) {
        $sonarAccessible = $true
    }
}
catch {
    $preflightFailures.Add("SonarQube is not reachable at $SonarHostUrl.")
}

if ($sonarAccessible -and $ProjectKey) {
    if ($syntheticMode) {
        try {
            $snapshotPreMeasures = Get-ProjectMetricsSnapshotWithRetry -HostUrl $SonarHostUrl -Token $SonarToken -Project $syntheticPreProjectKey -Attempts $SnapshotRetryAttempts -DelaySeconds $SnapshotRetryDelaySeconds
            $snapshotPostMeasures = Get-ProjectMetricsSnapshotWithRetry -HostUrl $SonarHostUrl -Token $SonarToken -Project $syntheticPostProjectKey -Attempts $SnapshotRetryAttempts -DelaySeconds $SnapshotRetryDelaySeconds
            $snapshotOnly = $false
            $collectionNotes.Add("Synthetic git baseline mode enabled using refs $resolvedPreAiRef (pre) and $resolvedPostAiRef (post).")
        }
        catch {
            $detail = if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message } elseif ($_.Exception) { $_.Exception.Message } else { "unknown error" }
            $preflightFailures.Add("Synthetic snapshot collection failed. Details: $detail")
            $snapshotOnly = $true
        }
        $historyAvailable = $false
    }
    else {
        try {
            $snapshotMeasures = Get-ProjectMetricsSnapshotWithRetry -HostUrl $SonarHostUrl -Token $SonarToken -Project $ProjectKey -Attempts $SnapshotRetryAttempts -DelaySeconds $SnapshotRetryDelaySeconds
        }
        catch {
            $detail = if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message } elseif ($_.Exception) { $_.Exception.Message } else { "unknown error" }
            $preflightFailures.Add("Current snapshot could not be collected for project '$ProjectKey'. Details: $detail")
        }

        try {
            $historyMap = Get-HistorySeriesMap -HostUrl $SonarHostUrl -Token $SonarToken -Project $ProjectKey -Metrics @(
                "bugs", "ncloc", "security_hotspots", "vulnerabilities", "duplicated_lines_density", "code_smells", "sqale_debt_ratio", "coverage"
            )

            if ($historyMap.ContainsKey("bugs") -and @($historyMap["bugs"]).Count -gt 0) {
                $historyAvailable = $true
            }
        }
        catch {
            $historyAvailable = $false
        }
    }
}

$detectedBoundary = $null
if (-not $AiAdoptionDate) {
    $detectedBoundary = Try-DetectAiAdoptionBoundary -Path $repoRoot
    if ($detectedBoundary) {
        $AiAdoptionDate = $detectedBoundary.Date
        $AiAdoptionConfidence = $detectedBoundary.Confidence
        $AiAdoptionEvidence = $detectedBoundary.Evidence
    }
}

if (-not $AiAdoptionDate) {
    $AiAdoptionConfidence = "unavailable"
    $AiAdoptionEvidence = "No defensible split point identified. Report will use snapshot-only data and acknowledge this as a limitation."
    $snapshotOnly = $true
    $preflightFailures.Add("AI adoption boundary not identified.")
}
else {
    if (-not $AiAdoptionConfidence) { $AiAdoptionConfidence = "estimated" }
    if (-not $AiAdoptionEvidence) { $AiAdoptionEvidence = "Boundary supplied at runtime." }
}

if (-not $historyAvailable -and -not $syntheticMode) {
    $snapshotOnly = $true
    $collectionNotes.Add("Historical analysis data unavailable. Using current snapshot where possible.")
}

$today = (Get-Date).ToString("yyyy-MM-dd")
$firstCommitDate = Get-RepoFirstCommitDate -Path $repoRoot
$boundaryDate = if ($AiAdoptionDate) { [datetime]$AiAdoptionDate } else { $null }

function Get-MetricValue {
    param(
        [string]$Metric,
        [ValidateSet("pre", "post")]
        [string]$Phase
    )

    if ($syntheticMode) {
        if ($Phase -eq "pre") {
            return Get-MapNumberOrNull -Map $snapshotPreMeasures -Key $Metric
        }
        return Get-MapNumberOrNull -Map $snapshotPostMeasures -Key $Metric
    }

    if ($snapshotOnly -or -not $boundaryDate -or -not $historyAvailable) {
        if ($Phase -eq "pre") { return $null }
        return Get-MapNumberOrNull -Map $snapshotMeasures -Key $Metric
    }

    $hist = Get-HistoryValueAtBoundary -HistoryByMetric $historyMap -Metric $Metric -Boundary $boundaryDate -Phase $Phase
    if ($null -ne $hist) {
        return $hist
    }

    if ($Phase -eq "post") {
        return Get-MapNumberOrNull -Map $snapshotMeasures -Key $Metric
    }

    return $null
}

$preBugs = Get-MetricValue -Metric "bugs" -Phase "pre"
$preNcloc = Get-MetricValue -Metric "ncloc" -Phase "pre"
$postBugs = Get-MetricValue -Metric "bugs" -Phase "post"
$postNcloc = Get-MetricValue -Metric "ncloc" -Phase "post"

$preDefectDensity = Get-DefectDensityPerKloc -Bugs $preBugs -Ncloc $preNcloc
$postDefectDensity = Get-DefectDensityPerKloc -Bugs $postBugs -Ncloc $postNcloc

$preSecurityHotspots = Get-MetricValue -Metric "security_hotspots" -Phase "pre"
$postSecurityHotspots = Get-MetricValue -Metric "security_hotspots" -Phase "post"
$preVulns = Get-MetricValue -Metric "vulnerabilities" -Phase "pre"
$postVulns = Get-MetricValue -Metric "vulnerabilities" -Phase "post"

$preDup = Get-MetricValue -Metric "duplicated_lines_density" -Phase "pre"
$postDup = Get-MetricValue -Metric "duplicated_lines_density" -Phase "post"

$preCodeSmells = Get-MetricValue -Metric "code_smells" -Phase "pre"
$postCodeSmells = Get-MetricValue -Metric "code_smells" -Phase "post"

$preDebt = Get-MetricValue -Metric "sqale_debt_ratio" -Phase "pre"
$postDebt = Get-MetricValue -Metric "sqale_debt_ratio" -Phase "post"

$preCoverage = Get-MetricValue -Metric "coverage" -Phase "pre"
$postCoverage = Get-MetricValue -Metric "coverage" -Phase "post"

$codeChurnMethod = "unavailable"
$churnPreValue = $null
$churnPostValue = $null
$churnUnit = "% of lines / $ChurnDays days"

if ($AiAdoptionDate -and $firstCommitDate) {
    try {
        $boundary = [datetime]$AiAdoptionDate
        $firstCommit = [datetime]$firstCommitDate
        $preStart = $boundary.AddDays(-1 * $ChurnDays)
        if ($preStart -lt $firstCommit) {
            $preStart = $firstCommit
        }

        $postEnd = $boundary.AddDays($ChurnDays)
        $now = Get-Date
        if ($postEnd -gt $now) {
            $postEnd = $now
        }

        $preChurn = Get-GitAddsDeletes -Path $repoRoot -SinceDate $preStart.ToString("yyyy-MM-dd") -UntilDate $boundary.ToString("yyyy-MM-dd")
        $postChurn = Get-GitAddsDeletes -Path $repoRoot -SinceDate $boundary.ToString("yyyy-MM-dd") -UntilDate $postEnd.ToString("yyyy-MM-dd")
        $codeChurnMethod = "git_direct"
        $churnPreValue = $preChurn.Rate
        $churnPostValue = $postChurn.Rate
    }
    catch {
        $collectionNotes.Add("Git churn calculation failed; trying code smells proxy.")
    }
}

if ($codeChurnMethod -eq "unavailable") {
    if ($null -ne $postCodeSmells -or $null -ne $preCodeSmells) {
        $codeChurnMethod = "code_smells_proxy"
        $churnUnit = "code_smells_count"
        $churnPreValue = $preCodeSmells
        $churnPostValue = $postCodeSmells
    }
}

$qualityGatePre = "unknown"
$qualityGatePost = "unknown"
if ($sonarAccessible -and $ProjectKey) {
    if ($syntheticMode) {
        $qualityGatePre = Get-QualityGateStatus -HostUrl $SonarHostUrl -Token $SonarToken -Project $syntheticPreProjectKey -AnalysisKey $null
        $qualityGatePost = Get-QualityGateStatus -HostUrl $SonarHostUrl -Token $SonarToken -Project $syntheticPostProjectKey -AnalysisKey $null
    }
    elseif ($snapshotOnly -or -not $boundaryDate) {
        $qualityGatePost = Get-QualityGateStatus -HostUrl $SonarHostUrl -Token $SonarToken -Project $ProjectKey -AnalysisKey $null
    }
    else {
        try {
            $window = Get-ProjectAnalysisWindow -HostUrl $SonarHostUrl -Token $SonarToken -Project $ProjectKey -Boundary $boundaryDate
            $qualityGatePre = Get-QualityGateStatus -HostUrl $SonarHostUrl -Token $SonarToken -Project $ProjectKey -AnalysisKey $window.PreAnalysisKey
            $qualityGatePost = Get-QualityGateStatus -HostUrl $SonarHostUrl -Token $SonarToken -Project $ProjectKey -AnalysisKey $window.PostAnalysisKey
        }
        catch {
            $collectionNotes.Add("Unable to collect historical quality gate statuses.")
        }
    }
}

$issueTotal = 0.0
if ($null -ne $postCodeSmells) { $issueTotal += [double]$postCodeSmells }
if ($null -ne $postBugs) { $issueTotal += [double]$postBugs }
if ($null -ne $postSecurityHotspots) { $issueTotal += [double]$postSecurityHotspots }

$postCodeSmellsPct = if ($issueTotal -gt 0 -and $null -ne $postCodeSmells) { [math]::Round(($postCodeSmells / $issueTotal) * 100.0, 3) } else { 0.0 }
$postBugsPct = if ($issueTotal -gt 0 -and $null -ne $postBugs) { [math]::Round(($postBugs / $issueTotal) * 100.0, 3) } else { 0.0 }
$postSecurityPct = if ($issueTotal -gt 0 -and $null -ne $postSecurityHotspots) { [math]::Round(($postSecurityHotspots / $issueTotal) * 100.0, 3) } else { 0.0 }

if ($null -eq $postDefectDensity -or $null -eq $churnPostValue -or $null -eq $postSecurityHotspots -or $null -eq $postDup) {
    $validationWarnings.Add("One or more primary metrics are missing post-AI values.")
}

if (-not $AiAdoptionDate) {
    $validationWarnings.Add("ai_adoption_date is missing; snapshot-only interpretation required.")
}

if ($snapshotOnly) {
    $collectionNotes.Add("Snapshot-only mode was used for one or more metrics.")
}

if ($syntheticRefResolutionNote) {
    $collectionNotes.Add($syntheticRefResolutionNote)
}

$primaryDataSource = if ($syntheticMode) { "manual_read" } elseif ($historyAvailable -and -not $snapshotOnly) { "history_api" } else { "current_snapshot" }

$result = [ordered]@{
    project_key = $ProjectKey
    ai_adoption_date = if ($AiAdoptionDate) { $AiAdoptionDate } else { $null }
    ai_adoption_confidence = $AiAdoptionConfidence
    ai_adoption_evidence = $AiAdoptionEvidence
    history_available = [bool]$historyAvailable
    snapshot_only = [bool]$snapshotOnly

    defect_density = [ordered]@{
        pre_ai = [ordered]@{ bugs = $preBugs; ncloc = $preNcloc; calculated_per_1000 = $preDefectDensity }
        post_ai = [ordered]@{ bugs = $postBugs; ncloc = $postNcloc; calculated_per_1000 = $postDefectDensity }
        delta_direction = Get-DeltaDirection -PreValue $preDefectDensity -PostValue $postDefectDensity
        data_source = $primaryDataSource
    }

    code_churn = [ordered]@{
        collection_method = $codeChurnMethod
        pre_ai = [ordered]@{ value = $churnPreValue; unit = $churnUnit }
        post_ai = [ordered]@{ value = $churnPostValue; unit = $churnUnit }
        delta_direction = Get-DeltaDirection -PreValue $churnPreValue -PostValue $churnPostValue
    }

    security = [ordered]@{
        pre_ai = [ordered]@{ security_hotspots = $preSecurityHotspots; confirmed_vulnerabilities = $preVulns }
        post_ai = [ordered]@{ security_hotspots = $postSecurityHotspots; confirmed_vulnerabilities = $postVulns }
        delta_direction = Get-DeltaDirection -PreValue $preSecurityHotspots -PostValue $postSecurityHotspots
        data_source = $primaryDataSource
    }

    duplication = [ordered]@{
        pre_ai = [ordered]@{ percent = $preDup }
        post_ai = [ordered]@{ percent = $postDup }
        delta_direction = Get-DeltaDirection -PreValue $preDup -PostValue $postDup
        data_source = $primaryDataSource
    }

    quality_gate = [ordered]@{
        pre_ai_status = $qualityGatePre
        post_ai_status = $qualityGatePost
    }

    technical_debt_ratio = [ordered]@{
        pre_ai = [ordered]@{ percent = $preDebt }
        post_ai = [ordered]@{ percent = $postDebt }
    }

    test_coverage = [ordered]@{
        pre_ai = [ordered]@{ percent = $preCoverage }
        post_ai = [ordered]@{ percent = $postCoverage }
        note = if ($null -eq $postCoverage -and $null -eq $preCoverage) { "Coverage metric not available from SonarQube for this project." } else { "" }
    }

    codebase_size = [ordered]@{
        pre_ai_ncloc = $preNcloc
        post_ai_ncloc = $postNcloc
    }

    issue_type_breakdown_post_ai = [ordered]@{
        code_smells = $postCodeSmells
        bugs = $postBugs
        security_hotspots = $postSecurityHotspots
        total = [double]$issueTotal
        code_smells_pct = $postCodeSmellsPct
        bugs_pct = $postBugsPct
        security_pct = $postSecurityPct
        collection_date = (Get-Date).ToString("yyyy-MM-dd")
    }

    preflight_failures = @($preflightFailures)
    validation_warnings = @($validationWarnings)
    collection_notes = if ($collectionNotes.Count -gt 0) { [string]::Join(" ", $collectionNotes) } else { "" }
}

$outPath = Get-OutputPath -WorkflowPath $WorkflowFilePath -RepoRoot $repoRoot
$result | ConvertTo-Json -Depth 8 | Set-Content -Path $outPath -Encoding UTF8

Write-Step "Workflow complete"
Write-Host "Saved JSON report to: $outPath" -ForegroundColor Green

# SiimpliGraphIt User Guide

## Welcome to SiimpliGraphIt

**SiimpliGraphIt** is a powerful scientific data visualization and analysis platform. Whether you're analyzing experimental results, comparing datasets, or creating publication-ready charts, SiimpliGraphIt provides the tools you need.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Installation](#installation)
3. [User Interface Overview](#user-interface-overview)
4. [Manual Graphing](#manual-graphing)
5. [Batch Processing](#batch-processing)
6. [Filename Decoder](#filename-decoder)
7. [Advanced Features](#advanced-features)
8. [Command Line Interface (CLI)](#command-line-interface-cli)
9. [Export and Sharing](#export-and-sharing)
10. [Tips and Tricks](#tips-and-tricks)
11. [Troubleshooting](#troubleshooting)

---

## Getting Started

### What Can You Do With SiimpliGraphIt?

- **Create professional charts** from CSV data with real-time visualization
- **Analyze data** with interactive graph configuration and curve fitting
- **Process multiple files** efficiently using batch mode
- **Extract metadata** from standardized filenames
- **Export high-quality images** suitable for publications
- **Save configurations** for reproducible analysis

### System Requirements

- **Desktop Application**: Windows, macOS, or Linux
- **Web Browser**: Chrome, Firefox, Safari, or Edge (for web version)
- **Data Format**: CSV (Comma-Separated Values) files
- **Storage**: ~100 MB for application + space for data files

---

## Installation

### Desktop Application

1. **Download** the SiimpliGraphIt installer from the releases page
2. **Run the installer**
   - Windows: `.exe` file
   - macOS: `.dmg` file
   - Linux: `.AppImage` or `.deb` file
3. **Launch** from your applications menu
4. **Allow file access** when prompted (needed for file operations)

### Web Version

1. **Open in browser**: Navigate to your instance's URL
2. **No installation needed** - works in modern web browsers
3. **Note**: Web version has limited file system access compared to desktop app

### From Source

If you're a developer or want the latest development version:

```bash
# Clone repository
git clone <repository-url>
cd siimpli-graph-it-copy

# Install dependencies
npm install

# Run development version
npm run dev        # Web only (http://localhost:5173)

# Or run full desktop app
npm run tauri dev  # Full Tauri application
```

---

## User Interface Overview

### Main Areas

```
┌─────────────────────────────────────────────────────────┐
│  SiimpliGraphIt        [Manual] [Batch] [Decoder]      │ ← Header with mode selector
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📁 File Upload Section                                 │
│     Drag & drop CSV files here                         │
│     [Upload] [+ Add More]                              │
│                                                         │
│  ⚙️ Graph Configuration                                 │
│     X-Axis: [Dropdown]      Color Scheme: [Dropdown]  │
│     Y-Axis Series: [Add Series]                        │
│     [Series 1] [Series 2] [Series 3]                   │
│                                                         │
│  🎨 Style Options                                       │
│     Graph Title: [Text]     Dimensions: 800 × 600      │
│     Line Style: [Dropdown]  Axis Labels: [Text]        │
│                                                         │
│  [Generate Graph] [Export PNG] [Show Curve Fitting]    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                    Generated Graph                       │
│                  (SVG visualization)                     │
│                                                         │
│        ╱╲                                               │
│       ╱  ╲                                              │
│      ╱    ╲                                             │
│     ╱______╲                                            │
│                                                         │
│  Legend: ■ Series 1 ■ Series 2 ■ Series 3             │
├─────────────────────────────────────────────────────────┤
│ Status: Graph generated successfully                    │ ← Status bar
└─────────────────────────────────────────────────────────┘
```

### Header Navigation

Three modes available via tabs:

1. **Manual** (default): Create graphs interactively
2. **Batch**: Apply settings to multiple files
3. **Decoder**: Extract metadata from filenames

---

## Manual Graphing

### Step 1: Upload Your Data

1. **Prepare CSV file**
   - Format: Comma-separated values
   - First row: Column headers
   - Example:
     ```csv
     time,temperature,pressure,humidity
     0.0,20.5,101.3,45
     1.0,21.3,101.5,46
     2.0,22.1,101.2,47
     ```

2. **Upload to SiimpliGraphIt**
   - Click "Choose Files" or drag & drop into the upload area
   - Multiple files supported
   - Files appear in the file list below upload area

3. **Verify columns**
   - Check that all expected columns are listed
   - Column info shows file name and data type

### Step 2: Configure Your Graph

#### Select Axes

1. **X-Axis** (horizontal)
   - Click the X-Axis dropdown
   - Select your independent variable
   - Example: time, distance, concentration

2. **Y-Axis** (vertical) - Series
   - Click "Add Series" to add first Y-axis variable
   - Select column from dropdown
   - Add multiple series for comparison
   - Remove series with "✕" button
   - Reorder with drag handles

#### Customize Appearance

1. **Graph Title**
   - Enter descriptive title
   - Auto-generated if left blank

2. **Project Name** (optional)
   - Appears above graph title if set
   - Useful for experiment identification

3. **Axis Labels**
   - X-Axis Label: label for horizontal axis
   - Y-Axis Label: label for vertical axis
   - Include units for clarity (e.g., "Time (seconds)")

4. **Color Scheme**
   - warm-cool: Red-Yellow-Blue (scientific standard)
   - rainbow: Full color spectrum
   - green-red: Green-Yellow-Red

5. **Series Styling**
   - **Line Style**: solid, dashed, dotted
   - **Color**: Click to choose custom color
   - **Visibility**: Toggle series on/off
   - **Axis Assignment**: Primary or Secondary (for dual-axis graphs)

6. **Graph Dimensions**
   - Width: 400-2000 pixels (default: 800)
   - Height: 300-1500 pixels (default: 600)
   - Larger = more detail, but slower rendering

### Step 3: Preview and Generate

1. **Review settings**
   - Check all selections look correct
   - Verify data is loaded

2. **Click "Generate Graph"**
   - Graph renders below configuration panel
   - Real-time feedback if settings incomplete
   - Success message on completion

3. **Refine as needed**
   - Change colors, styles, or axes
   - Click "Generate Graph" again
   - Previous graph updates instantly

### Step 4: View and Interact

The generated graph includes:

- **Axes** with tick marks and labels
- **Data points** colored by series
- **Legend** showing series names and colors
- **Grid lines** (optional, enable in settings)
- **Logo** (branding element, top-right)

**Interaction:**
- **Hover** over points to see values (in data table mode)
- **Click** on points to select/highlight (in data table mode)
- **Zoom/Pan** not supported (use graph dimensions instead)

---

## Batch Processing

Use Batch mode to apply the same graph configuration to multiple files quickly.

### Workflow

1. **Switch to Batch mode**
   - Click "Batch" tab at top

2. **Upload template file**
   - Load a representative CSV file
   - Configure graph as desired (axes, colors, styles)
   - This becomes your template

3. **Upload batch files**
   - Select multiple files to process
   - All files must have same column structure as template

4. **Configure batch settings**
   - Output directory (where to save graphs)
   - File naming pattern
   - Export format (PNG, JSON, or both)

5. **Start processing**
   - Click "Process Batch"
   - Progress bar shows processing status
   - Files process one by one
   - Results saved to output directory

### Example: Processing 50 Temperature Readings

```
Batch Setup:
├── Template: Sample_Temperature_2025-01-15.csv
│   ├── X-Axis: time
│   ├── Y-Axis: temperature
│   └── Color Scheme: warm-cool
├── Batch Files: Sample_Temperature_2025-01-16.csv
│                Sample_Temperature_2025-01-17.csv
│                ... (48 more files)
└── Output: ./results/temperature-graphs/
```

Result: 50 professional graphs generated in minutes!

### Batch Processing Tips

- **Column consistency**: All files must have same columns as template
- **File naming**: Descriptive names help organize results
- **Output folder**: Create empty folder first
- **Resume**: Can pause and resume batch processing
- **Error handling**: Failed files skip, continue with others

---

## Filename Decoder

Extract metadata from standardized filenames to create a point on a pre-generated chart.

### Use Case

You use a standardized naming convention for experiments:
```
Experiment_Date_Temperature_Pressure_Duration.csv
Example: Exp_2025-01-15_25C_101kPa_60min.csv
```

The Filename Decoder extracts these parameters and plots them.

### How to Use

1. **Switch to Decoder mode**
   - Click "Decoder" tab at top

2. **Define naming pattern**
   - Specify which position represents which variable
   - Example: `Exp_{date}_{temp}_{pressure}_{duration}.csv`
   - Position 0: Experiment prefix
   - Position 1: Date
   - Position 2: Temperature
   - Position 3: Pressure
   - Position 4: Duration

3. **Upload files**
   - Select files following your naming convention
   - Or enter filename directly

4. **Extract and plot**
   - Decoder extracts values
   - Plots point on provided chart
   - Shows extracted values in table

### Example

**Filenames:**
- `Test_2025-01-15_22.5_100.2_45.3.csv`
- `Test_2025-01-16_23.1_100.8_46.1.csv`
- `Test_2025-01-17_24.3_101.5_47.2.csv`

**Decoded values:**
| Date | Temp (°C) | Pressure (kPa) | Value |
|------|-----------|----------------|-------|
| 2025-01-15 | 22.5 | 100.2 | 45.3 |
| 2025-01-16 | 23.1 | 100.8 | 46.1 |
| 2025-01-17 | 24.3 | 101.5 | 47.2 |

---

## Advanced Features

### Curve Fitting

Fit mathematical curves to your data for trend analysis and predictions.

**Accessing Curve Fitting:**
1. Generate a graph
2. Click "Show Curve Fitting" button
3. Curve Fitting panel appears

**Using Curve Fitting:**
1. **Fit Type**: Select mathematical model
   - Linear: y = mx + b (best for linear trends)
   - Polynomial: y = ax² + bx + c (for curved data)
   - Exponential: y = ae^(bx) (for growth/decay)
   - Power: y = ax^b (for power relationships)
   - Logarithmic: y = a + b*ln(x) (for logarithmic trends)

2. **Perform Fitting**
   - Click "Perform Fitting"
   - Equation displayed in results
   - Fit line appears on graph
   - R² value shows goodness-of-fit (1.0 = perfect)

3. **Add Multiple Fits**
   - Click "Add Another Fit"
   - Each fit gets unique color
   - Compare different curve types

4. **Equation and Metrics**
   - **Equation**: Shown in legend
   - **R² Score**: How well curve matches data
     - 1.0 = perfect fit
     - 0.9+ = excellent fit
     - 0.7+ = good fit
     - <0.5 = poor fit
   - **Parameters**: a, b, c values shown

### Color Grading

Color data points based on a third variable (heatmap effect).

**Using Color Grading:**
1. In Graph Configuration, select a column for "Color Grading"
2. Points colored according to value
3. Color legend shows value range

**Example:**
- X-Axis: Temperature
- Y-Axis: Pressure
- Color Grading: Humidity
- Points colored red (low humidity) to blue (high humidity)

### Dual-Axis Graphs

Plot two variables with different scales on left and right axes.

**Setting up Dual-Axis:**
1. Add two series to graph
2. For second series, set "Axis Assignment" to "Secondary"
3. Left axis for primary series, right axis for secondary
4. Useful for comparing variables with different units

### Contour Lines

Add contour lines to show data density and patterns.

**Using Contours:**
1. In Graph Configuration, enable "Contouring"
2. Select column for contour values
3. Contour lines drawn based on 3D interpolation
4. Contour legend shows value ranges

### Data Tables

View numerical values in table format alongside graph.

**Options:**
- **Data Table**: Shows all data points
- **Static Table**: Shows key values at selected X positions
- **Unified Table**: Combined legend + static values (publication-ready)
- **Bias Table**: Display bias correction values

**Enabling Tables:**
1. In settings, check "Show Data Table" or "Show Static Table"
2. Click on graph to select X position (for static table)
3. Table appears below graph

---

## Command Line Interface (CLI)

**For advanced users and automated workflows**, SiimpliGraphIt offers a command-line interface for headless rendering without the desktop application.

### When to Use the CLI

- **Automated pipelines**: Generate graphs from scripts or CI/CD systems
- **Batch processing**: Process thousands of files in parallel
- **Server-side rendering**: Generate graphs on a web server
- **Scheduled reports**: Create daily/weekly graph reports automatically
- **Integration**: Call from other tools and languages

### Installation

```bash
# Install via npm
npm install -g @siimpli/graph-it-headless

# Or install locally in your project
npm install --save-dev @siimpli/graph-it-headless
```

### Basic Usage

**Render a single graph**:
```bash
graph-it-headless render \
  --config chart.json \
  --data sales.csv \
  --output ./results/
```

**Render batch (multiple files)**:
```bash
graph-it-headless render \
  --config chart.json \
  --data "./data/*.csv" \
  --output ./results/
```

**With logo and options**:
```bash
graph-it-headless render \
  --config chart.json \
  --data ./data/ \
  --output ./results/ \
  --logo company_logo.png \
  --format png \
  --name-template "{csvName}_{date}"
```

### Configuration File Format

Save your graph settings as `chart.json`:

```json
{
  "version": "1.0.0",
  "graph": {
    "graphType": "scatter",
    "xAxis": "time",
    "series": [
      {
        "yAxis": "temperature",
        "color": "#ff6b6b",
        "lineStyle": "solid"
      },
      {
        "yAxis": "pressure",
        "color": "#4ecdc4",
        "lineStyle": "dashed"
      }
    ],
    "title": "Temperature and Pressure Analysis",
    "xAxisLabel": "Time (minutes)",
    "yAxisLabel": "Value"
  },
  "global": {
    "colorScheme": "warm-cool",
    "graphDimensions": {
      "width": 1200,
      "height": 800
    }
  }
}
```

### Column Reference Syntax

Columns in your CSV can be referenced in three ways:

```json
{
  "xAxis": "time",           // Simple name (column header)
  "series": [
    {
      "yAxis": "[1]"         // Index reference (0-based, column 1)
    },
    {
      "yAxis": "temperature" // Name reference
    }
  ]
}
```

**Rules**:
- Simple names work when column names are unique
- Index `[0]`, `[1]`, `[2]` refer to column positions
- Use names for clarity, indices for robustness

### Command Reference

```bash
graph-it-headless render [options]

Options:
  --config <path>          Config JSON file (required)
  --data <path|glob>       CSV file(s) or directory with *.csv
  --output <dir>           Output directory (default: ./output)
  --logo <path>            Logo image file (PNG, JPG, SVG)
  --format <fmt>           Output format: png, svg, or both (default: png)
  --name-template <tmpl>   Output filename pattern
  --no-watermark          Disable watermark on PNG (default: enabled)
  --concurrency <n>        Parallel processing limit (default: 4)
  --verbose               Show detailed progress
  --quiet                 Minimal output
  --help                  Show all options
  --version               Show version
```

### Output Filename Templates

Control how output files are named:

```bash
# Available template tokens:
{csvName}   → input filename without extension
{title}     → graph title from config
{date}      → ISO date (2025-03-13)
{index}     → sequence number in batch (1, 2, 3...)

# Examples:
--name-template "{csvName}_{date}"
# Input: sales.csv → Output: sales_2025-03-13.png

--name-template "{index}_{title}"
# Input: 1.csv, 2.csv → Output: 1_Temperature.png, 2_Temperature.png

--name-template "{csvName}_final"
# Input: data.csv → Output: data_final.png
```

### Real-World Examples

**Example 1: Daily Report Generation**

```bash
#!/bin/bash
# generate_daily_report.sh

DATE=$(date +%Y-%m-%d)
OUTPUT_DIR="./reports/$DATE"
mkdir -p "$OUTPUT_DIR"

graph-it-headless render \
  --config ./templates/sales.json \
  --data "./daily_data/$DATE/*.csv" \
  --output "$OUTPUT_DIR" \
  --logo ./assets/company_logo.png \
  --format png
```

**Example 2: Python Integration**

```python
import subprocess
import json
from pathlib import Path

# Generate config dynamically
config = {
    "graph": {
        "graphType": "line",
        "xAxis": "date",
        "series": [{"yAxis": "revenue"}],
        "title": "Monthly Revenue"
    },
    "global": {"graphDimensions": {"width": 1000, "height": 600}}
}

# Write config
config_path = Path("temp_config.json")
config_path.write_text(json.dumps(config, indent=2))

# Run headless renderer
result = subprocess.run([
    "graph-it-headless", "render",
    "--config", str(config_path),
    "--data", "./sales_data/2025-03.csv",
    "--output", "./results/",
    "--format", "png"
])

if result.returncode == 0:
    print("✓ Graph generated successfully")
else:
    print("✗ Generation failed")
```

**Example 3: Batch with Summary**

```bash
graph-it-headless render \
  --config chart.json \
  --data "./data/*.csv" \
  --output ./results/ \
  --verbose

# This produces:
# results/
#   ├─ file1.png
#   ├─ file2.png
#   ├─ file3.png
#   └─ batch-summary.json  ← Contains status of each file
```

**Reading batch summary**:
```json
{
  "graphs": [
    {
      "file": "data1.csv",
      "status": "success",
      "duration_ms": 1423,
      "output": "data1.png"
    },
    {
      "file": "data2.csv",
      "status": "failed",
      "error": "Column 'temperature' not found",
      "duration_ms": 45
    }
  ],
  "total": 2,
  "succeeded": 1,
  "failed": 1
}
```

### Advanced Options

**Parallel Processing**:
```bash
# Process 8 files at once (default is 4)
--concurrency 8
```

**High-Quality Output**:
```bash
# 3× scale for publication quality
graph-it-headless render \
  --config chart.json \
  --data data.csv \
  --output ./results/ \
  --format png
# Produces high-DPI PNG suitable for print
```

**No Watermark** (for internal use):
```bash
--no-watermark
```

**SVG Output** (editable format):
```bash
--format svg
# Produces scalable SVG files instead of raster PNG
```

### Troubleshooting CLI

**Error: "Column 'x' not found"**
- Check column names in your CSV match the config
- Use `[0]`, `[1]` indices instead of names if names vary
- Run with `--verbose` to see available columns

**Error: "Config validation failed"**
- Ensure config JSON is valid (check with jsonlint)
- Verify all required fields are present
- Check schema compatibility with your app version

**Slow Processing**
- Increase `--concurrency` if CPU has headroom
- Reduce graph dimensions if huge resolution
- Process in smaller batches

**Memory Issues with Large Batches**
- Reduce `--concurrency` to lower memory usage
- Process files in multiple smaller batches
- Check for memory leaks in custom extensions

### Configuration Export from Desktop App

You can use the desktop application to create configurations, then use them with the CLI:

**Workflow**:
1. Open desktop app
2. Create graph with desired settings
3. Click "Export Config JSON"
4. Save as `chart.json`
5. Use in CLI: `graph-it-headless render --config chart.json ...`

This ensures consistency between interactive and automated graphs.

---

## Export and Sharing

### Export as PNG

Create high-quality image for presentations and publications.

**Process:**
1. Generate graph
2. Click "Export as PNG"
3. Choose save location
4. Options:
   - Full resolution for publications
   - Scaling options for web use
   - Logo included automatically

**Output Quality:**
- Default: 800×600 pixels (screen quality)
- High quality: 3200×2400 pixels (print quality)
- Customizable via graph dimensions

**When to use PNG:**
- Presentations
- Publications
- Email/sharing
- Web pages
- Reports

### Export Configuration as JSON

Save your exact settings for reproducibility.

**Process:**
1. Generate graph
2. Click "Export Config JSON"
3. Choose save location
4. JSON file contains:
   - Graph configuration (axes, series, styles)
   - Global settings (dimensions, colors)
   - Data bindings (which columns used)
   - Version info

**When to use JSON:**
- Save reproducible workflows
- Share settings with colleagues
- Archive analysis methodology
- Version control analysis
- Re-use settings on similar data

**Sharing Workflow:**
```
Colleague receives JSON config:
1. Opens new project
2. Uploads CSV file (with same columns)
3. Imports JSON config
4. All settings applied automatically
5. Generates graph with same style
```

### Exporting Data

**Export processed data:**
1. No built-in data export yet
2. Workaround: Use data table and copy/paste
3. Or export original CSV and curve fitting results

**Recommended workflow:**
1. Use data table to view processed values
2. Screenshot or export curve fitting results
3. Export configuration for reproducibility

---

## Tips and Tricks

### 1. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Cmd+Z` | Undo (limited) |
| `Ctrl+S` / `Cmd+S` | Save configuration (if implemented) |
| `Ctrl+E` / `Cmd+E` | Export graph |
| `Enter` | Generate graph |
| `Esc` | Close dialogs |

### 2. Data Preparation Best Practices

**Column naming:**
- Use descriptive names (e.g., "Temperature_C" not "T")
- Avoid special characters
- Be consistent across files
- Include units in header or label

**Data format:**
- Use comma separator (CSV standard)
- Ensure numeric columns have no text
- Handle missing data:
  - Leave cells empty (recommended)
  - Use NaN or null markers
  - Document your convention

**Example well-formatted CSV:**
```csv
Time_seconds,Temperature_Celsius,Pressure_kPa,Humidity_percent
0.0,20.1,101.3,45
1.0,20.5,101.5,46
2.0,21.2,101.2,47
```

### 3. Creating Publication-Ready Graphs

**Step-by-step:**
1. Upload clean data
2. Choose professional color scheme (warm-cool or rainbow)
3. Add descriptive title and axis labels with units
4. Use larger dimensions (1200×800 or more)
5. Enable grid lines for readability
6. Add curve fits if showing trends
7. Use unified table for data transparency
8. Export as high-quality PNG
9. Include in publication or supplement

### 4. Comparing Similar Datasets

**Method: Batch Processing**
1. Template setup with first file
2. Configure ideal visualization
3. Batch process all similar files
4. Compare results side-by-side
5. Identify patterns across experiments

**Method: Multiple Series**
1. Upload all files at once
2. Add multiple series (one per file)
3. Use different colors for clarity
4. Compare on single graph
5. Export as single image

### 5. Troubleshooting Common Issues

**"No columns found"**
- Check CSV format is correct (comma-separated)
- Verify first row has headers
- Try opening in text editor to verify format

**"Graph won't generate"**
- Select both X and Y axes
- Ensure data is loaded
- Check for invalid data (text in numeric column)
- Try simpler column selection first

**"Export failed"**
- Check file permissions on destination folder
- Try different save location
- Ensure disk has space
- Check for special characters in filename

---

## Troubleshooting

### Problem: Application won't start

**Solutions:**
1. **Desktop app:**
   - Check system requirements met
   - Reinstall application
   - Check disk space available

2. **Web version:**
   - Clear browser cache: `Ctrl+Shift+Delete`
   - Try different browser
   - Check internet connection

### Problem: CSV file won't upload

**Checklist:**
- File is actually CSV format (not Excel .xlsx)
- First row contains column headers
- File uses comma separator (not semicolon or tab)
- File not corrupted (try opening in text editor)
- File size reasonable (<100 MB)

**Fix:**
```
Open in text editor, verify format:
name,age,value
Alice,25,100
Bob,30,200
```

If file uses semicolons, save as CSV:
- Excel: File → Save As → Format: CSV
- LibreOffice: File → Save As → Format: CSV

### Problem: Graph won't generate

**Checklist:**
- [ ] X-Axis selected
- [ ] At least one Y-Axis series selected
- [ ] Data is loaded (file list shows files)
- [ ] No error message in status bar
- [ ] Graph dimensions reasonable

**If still failing:**
1. Try with smaller dataset first
2. Check browser console for errors (`F12`)
3. Restart application
4. Try web version instead of desktop

### Problem: Batch processing is slow

**Tips:**
1. Reduce number of files per batch
2. Reduce graph dimensions (e.g., 800×600 instead of 1200×800)
3. Disable expensive features (contours, curve fitting)
4. Process in smaller batches
5. Use faster computer if available

### Problem: Export produces blank image

**Solutions:**
1. Regenerate graph before export
2. Try PNG instead of other formats
3. Check graph actually rendered (visible on screen)
4. Try smaller dimensions first
5. Restart application and retry

### Problem: Configuration export/import not working

**Solutions:**
1. **Export:**
   - Verify graph is generated
   - Check file permissions
   - Try different save location

2. **Import:**
   - Verify JSON file is valid (open in text editor)
   - Check column names match your CSV
   - Use sample JSON to verify format

### Getting Help

If problems persist:
1. **Check logs:**
   - Open browser DevTools (`F12`)
   - Look in Console tab for error messages
   - Screenshot errors for reference

2. **Prepare information:**
   - What operating system? (Windows, macOS, Linux)
   - Desktop or web version?
   - Sample CSV file (if possible)
   - Steps to reproduce issue

3. **Report issue:**
   - GitHub Issues page
   - Include screenshots and error messages
   - Attach sample data if possible

---

## Conclusion

SiimpliGraphIt makes scientific data visualization accessible and powerful. Whether you're a researcher analyzing experiments, a student completing coursework, or an analyst exploring datasets, SiimpliGraphIt has the tools you need.

**Get started now:**
1. [Install the application](#installation)
2. [Prepare your CSV data](#data-preparation-best-practices)
3. [Create your first graph](#manual-graphing)
4. [Export your results](#export-and-sharing)

**Happy analyzing!** 📊

---

## Appendix: CSV Format Guide

### What is CSV?

CSV (Comma-Separated Values) is a plain text format for data tables.

**Structure:**
- First row: Column headers
- Each row: One data record
- Columns separated by commas
- One file per table

### Valid Examples

**Simple data:**
```csv
name,age,score
Alice,25,95.5
Bob,30,87.2
Charlie,28,92.1
```

**Scientific data:**
```csv
time_min,temperature_C,pressure_Pa,humidity_percent
0.0,20.1,101325,45.2
0.5,20.3,101328,45.5
1.0,20.5,101330,46.0
```

**With missing values:**
```csv
sample,value1,value2,notes
A,100,,Valid
B,105,2.5,Good
C,,3.1,Incomplete
```

### Invalid Examples (Won't Work)

```csv
,
20.1, 101325, 45.2
Alice, 25, 95.5

# This uses semicolons not commas - wrong!
name;age;score
Alice;25;95.5
```

### How to Create CSV

**Microsoft Excel:**
1. Create data normally
2. File → Save As
3. Choose format: CSV (Comma delimited)
4. Click Save

**Google Sheets:**
1. Create data normally
2. File → Download → CSV

**LibreOffice Calc:**
1. Create data normally
2. File → Save As
3. Choose format: Text CSV (.csv)
4. Click Save

**Text Editor:**
1. Manually type data
2. Separate columns with commas
3. Each row on new line
4. Save as `.csv` file

---

## Glossary

| Term | Definition |
|------|-----------|
| **Axis** | Reference line on graph (X-horizontal, Y-vertical) |
| **Series** | One data variable plotted as line/points |
| **CSV** | Comma-Separated Values, text data format |
| **Export** | Save graph or configuration to file |
| **Batch** | Process multiple files with same settings |
| **Contour** | Lines of equal value in 3D data |
| **Curve Fitting** | Mathematical line fitted to data |
| **R² Score** | Measure of fit quality (0-1, higher is better) |
| **Dual-Axis** | Two Y-axes with different scales |
| **Legend** | Key showing what colors/styles represent |
| **Codec** | Encoder/decoder for data format |
| **Color Grading** | Color based on data value (heatmap) |

---

**Version**: 1.0
**Last Updated**: 2025-03-13
**Application Version**: 0.3.62+

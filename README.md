# SiimpliGraphIt Analysis Platform

![Version](https://img.shields.io/badge/version-0.3.64-blue.svg)
![License](https://img.shields.io/badge/license-Private-red.svg)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)
![Tauri](https://img.shields.io/badge/tauri-%2324C8D5.svg?style=flat&logo=tauri&logoColor=white)
![D3.js](https://img.shields.io/badge/d3.js-F9A03C?style=flat&logo=d3.js&logoColor=white)

## Project Description

The **SiimpliGraphIt** is a powerful scientific data analysis and visualization module integrated into the SiimpliMineit application. It provides a robust platform for researchers and analysts to process experimental data and generate high-quality charts.

We chose **React** for its modular component architecture, **D3.js** for its precision in handling scientific data visualizations, and **Tauri** to deliver a high-performance native desktop experience with direct file system access.

**Key Features:**
-   **Manual Mode:** Interactive graph configuration with real-time feedback.
-   **Batch Processing:** Efficiently process datasets across multiple files using defined templates.
-   **Filename Decoder:** Extract critical metadata directly from standardized file naming conventions.
-   **High-Quality Export:** Generate publication-ready PNG images of your plots.

---

## Table of Contents

-   [Installation and Run](#how-to-install-and-run-the-project)
-   [How to Use](#how-to-use-the-project)
    -   [Manual Graphing](#manual-graphing)
    -   [Batch Processing](#batch-processing)
-   [Credits](#credits)
-   [License](#license)
-   [Contributing](#how-to-contribute-to-the-project)
-   [Tests](#include-tests)

---

## How to Install and Run the Project

This project is built as a Tauri application. Ensure you have the following prerequisites installed:
*   [Node.js](https://nodejs.org/) (v16 or higher)
*   [Rust](https://www.rust-lang.org/tools/install) (for Tauri backend)

### Development Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd siimpli-graph-it
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run in Development Mode:**
    To launch the full desktop application:
    ```bash
    npm run tauri dev
    ```

    To run the web-only version (no file system access):
    ```bash
    npm run dev
    ```

---

## How to Use the Project

SiimpliGraphIt offers three main modes of operation suitable for different analytical needs.

### Manual Graphing
1.  **Upload Data:** Navigate to the "Manual" tab and drag & drop your CSV files into the upload area.
2.  **Configure Axes:** Select your X and Y columns from the dropdown menus.
3.  **Customize:** Adjust line styles, colors, and series visibility in the Graph Configuration panel.
4.  **Visualize:** Click **Generate Graph** to render the plot.

![Manual Graph Mode Placeholder](./screenshots/manual_mode.png)

### Batch Processing
Use the "Batch" tab to apply the same graph settings to multiple files simultaneously. This is ideal for comparing experimental runs under identical conditions.

### File Name Decoder
Use the "File Name Decoder" tab to extract critical metadata directly from standardized file naming conventions, allowing the user to plot a single point on an encoded PNG chart

---

## Credits

This project is developed and maintained by the SiimpliMineit Development team.

**Lead Developer:**
*   [Harison Sharp](https://github.com/harisonsharp)

**Special Thanks:**
*   Built with [Tauri](https://tauri.app/)
*   Visualizations powered by [D3.js](https://d3js.org/)

---

## License

**Private / Proprietary**

This project is currently private. Unauthorized copying, modification, or distribution of this application, via any medium, is strictly prohibited.

For license inquiries, please reference the `package.json` file or contact the repository owner.

---

## Badges

The badges at the top of this README indicate the current version status and primary technologies used. They are hosted by [Shields.io](https://shields.io/).

---

## How to Contribute to the Project

We welcome contributions to improve the Graph App!

1.  **Fork** the repository.
2.  **Create a branch** for your feature (`git checkout -b feature/AmazingFeature`).
3.  **Commit** your changes (`git commit -m 'Add some AmazingFeature'`).
4.  **Push** to the branch (`git push origin feature/AmazingFeature`).
5.  **Open a Pull Request**.

Please ensure your code follows the existing style guidelines and passes all linting checks.

---

## Include Tests

We use **Vitest** for our testing framework. To ensure your changes don't break existing functionality, please run the test suite before submitting a PR.

**Run all tests:**
```bash
npm test
```

**Run tests with UI:**
```bash
npm test -- --ui
```

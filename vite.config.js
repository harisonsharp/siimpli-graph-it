import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import debugContextPlugin from "./vite-plugins/debug-context.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = process.env.TAURI_DEV_HOST;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(async () => ({
  resolve: {
    // Always resolve the core package to the sibling workspace path.
    alias: {
      "@harisonsharp/graph-it-core": path.resolve(__dirname, "../siimpli-graph-it-core/src/index.js"),
    },
  },

  plugins: [
    {
      name: 'vite-plugin-debug-context',
      enforce: 'pre',
      transform(code, id) {
        if (!/\.[jt]sx?$/.test(id)) return;
        if (id.includes('node_modules') && !id.includes('siimpli-graph-it-core')) return;
        // Optimization: Skip the file that defines the loggers to avoid transforming the definition
        if (id.endsWith('debug.js')) return;

        if (!code.includes('debugLog') && !code.includes('debugWarn')) return;

        // Simple relative path heuristic
        const relativePath = id.split('src')[1] ? 'src' + id.split('src')[1] : id;

        const lines = code.split('\n');
        let changed = false;
        const newLines = lines.map((line, index) => {
          if (!line.includes('debugLog') && !line.includes('debugWarn')) return line;
          return line.replace(/\b(debugLog|debugWarn)\s*\(/g, (match, funcName) => {
            changed = true;
            // Naive JSON stringify for safety
            return `${funcName}({__file: ${JSON.stringify(relativePath)}, __line: ${index + 1}}, `;
          });
        });

        if (!changed) return;
        return { code: newLines.join('\n'), map: null };
      }
    },
    react()
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));

import path from 'path';

/**
 * A simple Vite plugin to inject source location context into debugLog/debugWarn calls.
 * 
 * Transforms:
 *   debugLog("msg")
 * Into:
 *   debugLog({__file: "src/foo.js", __line: 42}, "msg")
 */
export default function debugContextPlugin() {
    return {
        name: 'vite-plugin-debug-context',
        enforce: 'pre',
        transform(code, id) {
            // Filter for js/jsx/ts/tsx files
            if (!/\.[jt]sx?$/.test(id)) return;

            // Exclude node_modules, but allow our linked core package if mapped
            if (id.includes('node_modules') && !id.includes('siimpli-graph-it-core')) return;

            // CRITICAL: Exclude the debug utility itself to prevent transforming its definition
            if (id.endsWith('debug.js')) return;

            // Quick check to skip files without debug calls
            if (!code.includes('debugLog') && !code.includes('debugWarn')) return;

            const lines = code.split('\n');
            let changed = false;

            // Simple relative path heuristic
            // We want paths like 'src/components/Graph.jsx' or 'core/src/utils/debug.js'
            // id is absolute.
            // If inside siimpli-graph-it-copy, it usually has /src/.
            // If inside core, it effectively has /src/.
            const relativePath = id.split('src')[1] ? 'src' + id.split('src')[1] : path.basename(id);

            const newLines = lines.map((line, index) => {
                // Skip if not present in this line
                if (!line.includes('debugLog') && !line.includes('debugWarn')) return line;

                // Replace `debugLog(` with `debugLog({__file:..., __line:...}, `
                return line.replace(/\b(debugLog|debugWarn)\s*\(/g, (match, funcName) => {
                    changed = true;
                    // Inject the context object. 
                    // We use JSON.stringify on the path to ensure safe escaping of characters.
                    return `${funcName}({__file: ${JSON.stringify(relativePath)}, __line: ${index + 1}}, `;
                });
            });

            if (!changed) return;

            return {
                code: newLines.join('\n'),
                map: null // Source maps approximate
            };
        }
    };
}

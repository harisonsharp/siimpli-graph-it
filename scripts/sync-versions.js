import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

/**
 * Synchronize headless package version and core dependency version from core package version.
 *
 * @param {{ corePackagePath?: string, headlessPackagePath?: string }} [options]
 * @returns {Promise<{version: string, corePackagePath: string, headlessPackagePath: string}>}
 */
export async function syncVersions(options = {}) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const corePackagePath = options.corePackagePath ?? path.resolve(__dirname, '../../siimpli-graph-it-core/package.json');
    const headlessPackagePath = options.headlessPackagePath ?? path.resolve(__dirname, '../../siimpli-graph-it-headless/package.json');

    const coreRaw = await fs.readFile(corePackagePath, 'utf8');
    const headlessRaw = await fs.readFile(headlessPackagePath, 'utf8');

    const corePackage = JSON.parse(coreRaw);
    const headlessPackage = JSON.parse(headlessRaw);

    const version = corePackage.version;

    headlessPackage.version = version;
    if (headlessPackage.dependencies && '@siimpli/graph-it-core' in headlessPackage.dependencies) {
        headlessPackage.dependencies['@siimpli/graph-it-core'] = version;
    }

    await fs.writeFile(headlessPackagePath, JSON.stringify(headlessPackage, null, 2) + '\n', 'utf8');

    return { version, corePackagePath, headlessPackagePath };
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
    syncVersions()
        .then(({ version, headlessPackagePath }) => {
            console.log(`Synchronized headless package version to ${version}: ${headlessPackagePath}`);
        })
        .catch((error) => {
            console.error(error.message);
            process.exit(1);
        });
}

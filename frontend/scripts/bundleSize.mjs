import { gzipSync } from 'node:zlib';

export const BUNDLE_BUDGETS = Object.freeze({
  initialJsBytes: 1_250_000,
  initialJsGzipBytes: 330_000,
  initialCssBytes: 180_000,
  initialCssGzipBytes: 32_000,
});

function isJavaScriptFile(file) {
  return /\.(?:m?js)$/i.test(file);
}

function getEntry(manifest) {
  const entry = Object.entries(manifest).find(([key, item]) => (
    item.isEntry
    && (item.src === 'src/main.jsx'
      || key === 'src/main.jsx'
      || item.src === 'index.html'
      || key === 'index.html')
  ));
  if (!entry) throw new Error('Could not find the frontend entry in the Vite manifest.');
  return entry;
}

function getStaticFiles(manifest, entryKey) {
  const visited = new Set();
  const files = new Set();
  const visit = (key) => {
    if (visited.has(key)) return;
    const item = manifest[key];
    if (!item) throw new Error(`Vite manifest is missing imported chunk "${key}".`);
    visited.add(key);
    if (item.file) files.add(item.file);
    for (const cssFile of item.css || []) files.add(cssFile);
    for (const dependency of item.imports || []) {
      visit(typeof dependency === 'string' ? dependency : dependency.name);
    }
  };
  visit(entryKey);
  return files;
}

async function measureFiles(files, readAsset) {
  const measurements = [];
  for (const file of files) {
    const bytes = await readAsset(file);
    measurements.push({
      file,
      bytes: bytes.byteLength,
      gzipBytes: gzipSync(bytes).byteLength,
    });
  }
  return measurements;
}

export async function createBundleReport(manifest, readAsset, extraJsFiles = []) {
  const [entryKey, entry] = getEntry(manifest);
  const initialFiles = getStaticFiles(manifest, entryKey);
  const jsFiles = [...initialFiles].filter((file) => file.endsWith('.js'));
  const cssFiles = [...initialFiles].filter((file) => file.endsWith('.css'));
  const [initialJs, initialCss, allJs] = await Promise.all([
    measureFiles(jsFiles, readAsset),
    measureFiles(cssFiles, readAsset),
    measureFiles(
      [...new Set([
        ...Object.values(manifest).flatMap((item) => [
          item.file,
          ...(item.assets || []),
        ]).filter((file) => file && isJavaScriptFile(file)),
        ...extraJsFiles.filter(isJavaScriptFile),
      ])],
      readAsset,
    ),
  ]);
  const dynamicEntries = (entry.dynamicImports || [])
    .map((key) => ({ key, ...manifest[key] }))
    .filter((item) => item.file?.endsWith('.js'));
  const lazyChunks = await measureFiles(
    [...new Set(dynamicEntries.map((item) => item.file))],
    readAsset,
  );
  const lazyNames = new Map(dynamicEntries.map((item) => [item.file, item.name || item.file]));
  return {
    initialJs,
    initialCss,
    allJs: allJs.sort((left, right) => right.bytes - left.bytes),
    lazyChunks: lazyChunks
      .map((chunk) => ({ ...chunk, name: lazyNames.get(chunk.file) }))
      .sort((left, right) => right.bytes - left.bytes),
  };
}

function total(measurements, key) {
  return measurements.reduce((sum, item) => sum + item[key], 0);
}

export function assertBundleBudgets(report, budgets = BUNDLE_BUDGETS) {
  const failures = [];
  const checks = [
    ['Initial JavaScript', report.initialJs, 'bytes', budgets.initialJsBytes],
    ['Initial JavaScript (gzip)', report.initialJs, 'gzipBytes', budgets.initialJsGzipBytes],
    ['Initial CSS', report.initialCss, 'bytes', budgets.initialCssBytes],
    ['Initial CSS (gzip)', report.initialCss, 'gzipBytes', budgets.initialCssGzipBytes],
  ];
  for (const [label, measurements, key, limit] of checks) {
    const actual = total(measurements, key);
    if (actual > limit) failures.push(`${label} is ${actual} bytes; budget is ${limit} bytes.`);
  }
  if (failures.length) throw new Error(failures.join('\n'));
}

export function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function formatTotal(measurements, key) {
  return formatBytes(total(measurements, key));
}

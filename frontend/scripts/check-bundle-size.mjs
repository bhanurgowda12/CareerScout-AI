import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertBundleBudgets,
  createBundleReport,
  formatBytes,
  formatTotal,
} from './bundleSize.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, '..');
const distDir = path.join(frontendDir, 'dist');
const manifestPath = path.join(distDir, '.vite', 'manifest.json');
let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch (error) {
  throw new Error(`Could not read ${manifestPath}. Run "npm run build" first.`, { cause: error });
}

const report = await createBundleReport(manifest, (file) => (
  readFile(path.join(distDir, file))
), (await readdir(path.join(distDir, 'assets')))
  .filter((file) => /\.(?:m?js)$/i.test(file))
  .map((file) => `assets/${file}`));

console.log(`Initial JavaScript: ${formatTotal(report.initialJs, 'bytes')} raw / ${formatTotal(report.initialJs, 'gzipBytes')} gzip`);
console.log(`Initial CSS: ${formatTotal(report.initialCss, 'bytes')} raw / ${formatTotal(report.initialCss, 'gzipBytes')} gzip`);
console.log('Lazy page chunks:');
for (const chunk of report.lazyChunks) {
  console.log(`  ${formatBytes(chunk.bytes)} raw / ${formatBytes(chunk.gzipBytes)} gzip  ${chunk.name}`);
}
console.log('Largest JavaScript chunks:');
for (const chunk of report.allJs.slice(0, 8)) {
  const lazy = report.lazyChunks.some((item) => item.file === chunk.file);
  console.log(`  ${formatBytes(chunk.bytes)} raw / ${formatBytes(chunk.gzipBytes)} gzip${lazy ? ' (lazy)' : ''}  ${chunk.file}`);
}
const workers = report.allJs.filter((chunk) => /worker/i.test(chunk.file));
if (workers.length) {
  console.log('Worker assets:');
  for (const worker of workers) {
    console.log(`  ${formatBytes(worker.bytes)} raw / ${formatBytes(worker.gzipBytes)} gzip  ${worker.file}`);
  }
}

assertBundleBudgets(report);
console.log('Initial bundle budgets passed.');

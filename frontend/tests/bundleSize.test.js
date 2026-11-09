import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertBundleBudgets,
  createBundleReport,
} from '../scripts/bundleSize.mjs';

test('bundle report includes static dependencies but excludes lazy page chunks from initial sizes', async () => {
  const manifest = {
    'src/main.jsx': {
      file: 'assets/main.js',
      src: 'src/main.jsx',
      isEntry: true,
      imports: ['src/shared.js'],
      dynamicImports: ['src/Jobs.jsx'],
      css: ['assets/main.css'],
    },
    'src/shared.js': { file: 'assets/shared.js' },
    'src/Jobs.jsx': { file: 'assets/jobs.js', name: 'Jobs' },
  };
  const assets = {
    'assets/main.js': Buffer.alloc(100),
    'assets/shared.js': Buffer.alloc(50),
    'assets/jobs.js': Buffer.alloc(200),
    'assets/main.css': Buffer.alloc(25),
  };
  const report = await createBundleReport(manifest, async (file) => assets[file]);

  assert.deepEqual(report.initialJs.map((item) => item.file).sort(), ['assets/main.js', 'assets/shared.js']);
  assert.deepEqual(report.initialCss.map((item) => item.file), ['assets/main.css']);
  assert.deepEqual(report.lazyChunks.map((item) => item.file), ['assets/jobs.js']);
  assert.equal(report.lazyChunks[0].name, 'Jobs');
});

test('bundle report fails when initial-transfer budgets are exceeded', () => {
  const report = {
    initialJs: [{ bytes: 11, gzipBytes: 11 }],
    initialCss: [{ bytes: 0, gzipBytes: 0 }],
  };

  assert.throws(
    () => assertBundleBudgets(report, {
      initialJsBytes: 10,
      initialJsGzipBytes: 10,
      initialCssBytes: 1,
      initialCssGzipBytes: 1,
    }),
    /Initial JavaScript is 11 bytes/,
  );
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('feature pages remain lazy-loaded while the authentication shell stays eager', async () => {
  const app = await readSource('src/App.jsx');
  const pageFiles = [
    'SettingsPage.jsx',
    'StudentProfile.jsx',
    'CareerRecommendations.jsx',
    'SkillGapLearning.jsx',
    'JobMatchAnalyzer.jsx',
    'JobApplicationTracker.jsx',
    'JobDiscovery.jsx',
    'StudentDashboard.jsx',
    'ResumeBuilder.jsx',
    'UsernameSetup.jsx',
  ];

  for (const file of pageFiles) {
    assert.match(app, new RegExp(`lazy\\(\\(\\) => import\\(['"]\\./${file}['"]\\)\\)`), `${file} should be lazy-loaded`);
  }
  assert.match(app, /import AuthPanel from ['"]\.\/AuthPanel\.jsx['"]/);
  assert.doesNotMatch(app, /lazy\(\(\) => import\(['"]\.\/AuthPanel\.jsx['"]\)/);
});

test('document and page loading/error states expose core accessible semantics', async () => {
  const [html, outlet, app] = await Promise.all([
    readSource('index.html'),
    readSource('src/PageContent.js'),
    readSource('src/App.jsx'),
  ]);

  assert.match(html, /<html lang="en">/);
  assert.match(html, /name="viewport"/);
  assert.match(outlet, /role:\s*'status'/);
  assert.match(outlet, /'aria-live':\s*'polite'/);
  assert.match(outlet, /'aria-busy':\s*'true'/);
  assert.match(outlet, /role:\s*'alert'/);
  assert.match(outlet, /'Retry'/);
  assert.match(app, /<main\b/);
});

test('navigation focus only runs for explicit route or browser history navigation', async () => {
  const [app, navigation] = await Promise.all([
    readSource('src/App.jsx'),
    readSource('src/navigationAccessibility.js'),
  ]);

  assert.match(app, /setNavigationRevision\(\(revision\) => revision \+ 1\)/);
  assert.match(app, /window\.addEventListener\('hashchange', syncPageFromLocation\)/);
  assert.match(app, /window\.addEventListener\('popstate', syncPageFromLocation\)/);
  assert.match(app, /if \(navigationRevision === 0\) return/);
  assert.match(app, /focusNavigationContent\(pageFocusRootRef\.current/);
  assert.match(app, /\}, \[navigationRevision\]\)/);
  assert.match(navigation, /target\.focus\(\{ preventScroll: true \}\)/);
});

test('live regions are scoped to concise status updates rather than whole page results', async () => {
  const [app, jobs, matching, pageContent] = await Promise.all([
    readSource('src/App.jsx'),
    readSource('src/JobDiscovery.jsx'),
    readSource('src/JobMatchAnalyzer.jsx'),
    readSource('src/PageContent.js'),
  ]);

  assert.doesNotMatch(app, /className="app-main" aria-live=/);
  assert.doesNotMatch(jobs, /className="job-discovery-results"[^>]*aria-live=/);
  assert.match(jobs, /className="job-discovery-coverage"[^>]*>\s*<p role="status" aria-live="polite">/);
  assert.doesNotMatch(matching, /className="job-match-results"[^>]*aria-live=/);
  assert.match(matching, /className="job-match-results-header" role="status" aria-live="polite"/);
  assert.match(pageContent, /role:\s*'status'/);
  assert.match(pageContent, /role:\s*'alert'/);
});

test('global keyboard focus, reduced motion, and mobile breakpoints remain configured', async () => {
  const css = await readSource('src/style.css');

  assert.match(css, /:focus-visible\s*\{\s*outline:/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media\s*\(max-width:\s*360px\)/);
  assert.match(css, /@media\s*\(max-width:\s*560px\)/);
});

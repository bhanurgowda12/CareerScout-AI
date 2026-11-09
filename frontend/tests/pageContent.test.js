import assert from 'node:assert/strict';
import test from 'node:test';
import React, { lazy } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import PageContent, { PageLoadErrorBoundary } from '../src/PageContent.js';

test('page outlet renders the accessible loading state while its page chunk is pending', () => {
  const PendingPage = lazy(() => new Promise(() => {}));
  const markup = renderToString(
    React.createElement(PageContent, { pageKey: 'dashboard' }, React.createElement(PendingPage)),
  );

  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /Loading this page/);
});

test('page outlet renders available content without showing the loading state', () => {
  const markup = renderToStaticMarkup(
    React.createElement(PageContent, { pageKey: 'dashboard' }, React.createElement('h1', null, 'Dashboard')),
  );

  assert.match(markup, /<h1>Dashboard<\/h1>/);
  assert.doesNotMatch(markup, /Loading this page/);
});

test('page load errors switch the boundary into its retry state', () => {
  assert.deepEqual(PageLoadErrorBoundary.getDerivedStateFromError(new Error('chunk failed')), { hasError: true });

  const boundary = new PageLoadErrorBoundary({ children: null });
  boundary.state = { hasError: true };
  const markup = renderToStaticMarkup(boundary.render());
  assert.match(markup, /role="alert"/);
  assert.match(markup, /could not be loaded/);
  assert.match(markup, />Retry</);
});

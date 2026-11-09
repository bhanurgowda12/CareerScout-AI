import assert from 'node:assert/strict';
import test from 'node:test';
import { focusNavigationContent } from '../src/navigationAccessibility.js';
import { pageHashes } from '../src/pageRoutes.js';

function createTarget(name) {
  const attributes = new Map();
  const listeners = new Map();
  return {
    name,
    focusOptions: null,
    hasAttribute: (attribute) => attributes.has(attribute),
    getAttribute: (attribute) => attributes.get(attribute) ?? null,
    setAttribute: (attribute, value) => attributes.set(attribute, value),
    removeAttribute: (attribute) => attributes.delete(attribute),
    addEventListener: (event, callback) => listeners.set(event, callback),
    focus(options) {
      this.focusOptions = options;
    },
    blur() {
      listeners.get('blur')?.();
    },
  };
}

function createRoot({ heading = null, appContent = null, hashTargets = {} } = {}) {
  const targets = new Map(Object.entries(hashTargets));
  const root = {
    ownerDocument: { getElementById: (id) => targets.get(id) || null },
    querySelector(selector) {
      if (selector === 'h1') return heading;
      if (selector === '.app-content') return appContent;
      return null;
    },
    contains(target) {
      return target === heading || target === appContent || [...targets.values()].includes(target);
    },
  };
  return root;
}

test('route navigation focuses the new page heading without changing normal tab order', () => {
  const heading = createTarget('heading');
  const root = createRoot({ heading });

  assert.equal(focusNavigationContent(root, {
    hash: pageHashes.jobDiscovery,
    routeHashes: pageHashes,
  }), true);
  assert.deepEqual(heading.focusOptions, { preventScroll: true });
  assert.equal(heading.getAttribute('tabindex'), '-1');

  heading.blur();
  assert.equal(heading.hasAttribute('tabindex'), false);
});

test('hash navigation focuses its target, falling back to page content when unavailable', () => {
  const hashTarget = createTarget('explore');
  const heading = createTarget('heading');
  const appContent = createTarget('app content');
  const root = createRoot({ heading, appContent, hashTargets: { explore: hashTarget } });

  focusNavigationContent(root, { hash: '#explore', routeHashes: pageHashes });
  assert.deepEqual(hashTarget.focusOptions, { preventScroll: true });
  assert.equal(heading.focusOptions, null);

  const loadingRoot = createRoot({ appContent });
  focusNavigationContent(loadingRoot, { hash: pageHashes.dashboard, routeHashes: pageHashes });
  assert.deepEqual(appContent.focusOptions, { preventScroll: true });
});

test('missing roots do not trigger a focus change', () => {
  assert.equal(focusNavigationContent(null), false);
});

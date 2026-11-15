import assert from 'node:assert/strict';
import test from 'node:test';
import { getPageFromHash, pageHashes } from '../src/pageRoutes.js';

test('all supported page hashes resolve to their existing route', () => {
  for (const [page, hash] of Object.entries(pageHashes)) {
    if (hash) assert.equal(getPageFromHash(hash), page);
  }
});

test('student profile keeps its overview hash and exposes dedicated edit and history routes', () => {
  assert.equal(pageHashes.profile, '#student-profile');
  assert.equal(getPageFromHash('#student-profile'), 'profile');
  assert.equal(getPageFromHash('#student-profile-edit'), 'profileEdit');
  assert.equal(getPageFromHash('#student-profile-history'), 'profileHistory');
});

test('home and unknown hashes resolve to the home page', () => {
  assert.equal(getPageFromHash(''), 'home');
  assert.equal(getPageFromHash('#top'), 'home');
  assert.equal(getPageFromHash('#unknown-page'), 'home');
});

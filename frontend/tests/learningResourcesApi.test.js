import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isCurrentLearningResourceRequest,
  requestLearningResources,
} from '../src/learningResourcesApi.js';

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return body; },
  };
}

test('all skill requests use a Firebase ID-token bearer header', async () => {
  const tokenCalls = [];
  const headers = [];
  const user = {
    async getIdToken(forceRefresh) {
      tokenCalls.push(forceRefresh);
      return 'firebase-id-token';
    },
  };
  const fetchRequest = async (_url, options) => {
    headers.push(options.headers.Authorization);
    return response(200, { videos: [] });
  };

  await Promise.all(['React', 'HTML', 'Accessibility'].map((skill) => (
    requestLearningResources('http://localhost:8000', skill, 'en', user, null, fetchRequest)
  )));

  assert.deepEqual(tokenCalls, [false, false, false]);
  assert.deepEqual(headers, Array(3).fill('Bearer firebase-id-token'));
});

test('invalid token is refreshed and retried once', async () => {
  const tokenCalls = [];
  const headers = [];
  const user = {
    async getIdToken(forceRefresh) {
      tokenCalls.push(forceRefresh);
      return forceRefresh ? 'refreshed-id-token' : 'cached-id-token';
    },
  };
  const fetchRequest = async (_url, options) => {
    headers.push(options.headers.Authorization);
    return headers.length === 1
      ? response(401, { detail: { code: 'firebase-token-invalid' } })
      : response(200, { videos: [] });
  };

  const result = await requestLearningResources(
    'http://localhost:8000', 'Accessibility', 'en', user, null, fetchRequest,
  );

  assert.equal(result.response.status, 200);
  assert.deepEqual(tokenCalls, [false, true]);
  assert.deepEqual(headers, ['Bearer cached-id-token', 'Bearer refreshed-id-token']);
});

test('concurrent invalid-token responses share one token refresh', async () => {
  const tokenCalls = [];
  const retriedSkills = [];
  const user = {
    async getIdToken(forceRefresh) {
      tokenCalls.push(forceRefresh);
      if (!forceRefresh) return 'cached-id-token';
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 'refreshed-id-token';
    },
  };
  const fetchRequest = async (url, options) => {
    if (options.headers.Authorization === 'Bearer cached-id-token') {
      return response(401, { detail: { code: 'firebase-token-invalid' } });
    }
    retriedSkills.push(new URL(url).searchParams.get('skill'));
    return response(200, { videos: [] });
  };

  const results = await Promise.all(['CSS', 'Accessibility'].map((skill) => (
    requestLearningResources('http://localhost:8000', skill, 'en', user, null, fetchRequest)
  )));

  assert.deepEqual(results.map(({ response: item }) => item.status), [200, 200]);
  assert.equal(tokenCalls.filter(Boolean).length, 1);
  assert.deepEqual(retriedSkills.sort(), ['Accessibility', 'CSS']);
});

test('expired token is refreshed and retried once', async () => {
  let attempts = 0;
  const user = {
    async getIdToken(forceRefresh) {
      return forceRefresh ? 'fresh-id-token' : 'expired-id-token';
    },
  };
  const fetchRequest = async (_url, options) => {
    attempts += 1;
    if (attempts === 1) {
      assert.equal(options.headers.Authorization, 'Bearer expired-id-token');
      return response(401, { detail: { code: 'firebase-token-expired' } });
    }
    assert.equal(options.headers.Authorization, 'Bearer fresh-id-token');
    return response(200, { videos: [] });
  };

  const result = await requestLearningResources(
    'http://localhost:8000', 'Accessibility', 'en', user, null, fetchRequest,
  );

  assert.equal(result.response.status, 200);
  assert.equal(attempts, 2);
});

test('arbitrary focused skills use the authenticated API in each selected language', async () => {
  const requested = [];
  const user = { async getIdToken() { return 'id-token'; } };
  const fetchRequest = async (url, options) => {
    requested.push({
      url: new URL(url),
      authorization: options.headers.Authorization,
    });
    return response(200, { videos: [], nextPageToken: null });
  };

  const skill = 'Data storytelling & visualization';
  await Promise.all(['en', 'kn'].map((language) => (
    requestLearningResources('http://localhost:8000', skill, language, user, null, fetchRequest)
  )));

  assert.deepEqual(
    requested.map(({ url }) => [url.searchParams.get('skill'), url.searchParams.get('language')]).sort(),
    [[skill, 'en'], [skill, 'kn']].sort(),
  );
  assert(requested.every(({ authorization }) => authorization.startsWith('Bearer ')));
});

test('empty resource responses and API errors are returned without fabricated resources', async () => {
  const user = { async getIdToken() { return 'id-token'; } };
  const noResults = await requestLearningResources(
    'http://localhost:8000',
    'Accessibility Testing',
    'en',
    user,
    null,
    async () => response(200, { videos: [], nextPageToken: null }),
  );
  assert.deepEqual(noResults.result.videos, []);

  const unavailable = await requestLearningResources(
    'http://localhost:8000',
    'Accessibility Testing',
    'en',
    user,
    null,
    async () => response(503, { detail: 'Learning resources are temporarily unavailable.' }),
  );
  assert.equal(unavailable.response.status, 503);
  assert.equal(unavailable.result.detail, 'Learning resources are temporarily unavailable.');
  assert.equal(unavailable.result.videos, undefined);
});

test('pagination continues to pass the requested skill and page token through the authenticated helper', async () => {
  const user = { async getIdToken() { return 'id-token'; } };
  let requestedUrl;
  await requestLearningResources(
    'http://localhost:8000',
    'Python',
    'en',
    user,
    'next-page-token',
    async (url) => {
      requestedUrl = new URL(url);
      return response(200, { videos: [], nextPageToken: null });
    },
  );

  assert.equal(requestedUrl.searchParams.get('skill'), 'Python');
  assert.equal(requestedUrl.searchParams.get('pageToken'), 'next-page-token');
});

test('stale focused-skill results are rejected after skill, user, or generation changes', () => {
  const currentRequest = {
    requestGeneration: 4,
    currentGeneration: 4,
    requestedUserId: 'user-a',
    currentUserId: 'user-a',
    requestedSkill: 'Accessibility',
    activeSkill: 'Accessibility',
  };

  assert.equal(isCurrentLearningResourceRequest(currentRequest), true);
  assert.equal(isCurrentLearningResourceRequest({ ...currentRequest, activeSkill: 'Cloud security' }), false);
  assert.equal(isCurrentLearningResourceRequest({ ...currentRequest, currentUserId: 'user-b' }), false);
  assert.equal(isCurrentLearningResourceRequest({ ...currentRequest, currentGeneration: 5 }), false);
});
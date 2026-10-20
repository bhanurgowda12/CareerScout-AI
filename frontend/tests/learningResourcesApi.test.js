import assert from 'node:assert/strict';
import test from 'node:test';
import { requestLearningResources } from '../src/learningResourcesApi.js';

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
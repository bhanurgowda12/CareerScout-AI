import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApiNetworkError,
  fetchJsonWithTimeout,
  MalformedApiResponseError,
  RequestCancelledError,
  RequestTimeoutError,
} from '../src/apiRequest.js';

function jsonResponse(body) {
  return {
    status: 200,
    async json() { return body; },
  };
}

test('request timeout aborts the underlying fetch and reports a timeout error', async () => {
  let triggerTimeout;
  let requestSignal;
  const timerApi = {
    setTimeout(callback) {
      triggerTimeout = callback;
      return 1;
    },
    clearTimeout() {},
  };
  const request = fetchJsonWithTimeout(
    '/api/jobs',
    {},
    100,
    async (_url, options) => {
      requestSignal = options.signal;
      return new Promise(() => {});
    },
    timerApi,
  );

  await Promise.resolve();
  triggerTimeout();
  await assert.rejects(request, RequestTimeoutError);
  assert.equal(requestSignal.aborted, true);
});

test('external cancellation aborts fetch and is distinct from a timeout', async () => {
  const controller = new AbortController();
  let requestSignal;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const request = fetchJsonWithTimeout(
    '/api/jobs',
    { signal: controller.signal },
    10_000,
    async (_url, options) => {
      requestSignal = options.signal;
      markStarted();
      return new Promise(() => {});
    },
  );

  await started;
  controller.abort();
  await assert.rejects(request, RequestCancelledError);
  assert.equal(requestSignal.aborted, true);
});

test('network failures and malformed JSON responses keep distinct error types', async () => {
  await assert.rejects(
    fetchJsonWithTimeout('/api/jobs', {}, 1_000, async () => {
      throw new TypeError('network unavailable');
    }),
    ApiNetworkError,
  );

  await assert.rejects(
    fetchJsonWithTimeout('/api/jobs', {}, 1_000, async () => ({
      status: 200,
      async json() { throw new SyntaxError('invalid JSON'); },
    })),
    MalformedApiResponseError,
  );
});

test('valid JSON preserves the response and payload shape', async () => {
  const response = jsonResponse({ videos: [], nextPageToken: null });
  const result = await fetchJsonWithTimeout('/api/resources', {}, 1_000, async () => response);

  assert.equal(result.response, response);
  assert.deepEqual(result.result, { videos: [], nextPageToken: null });
});

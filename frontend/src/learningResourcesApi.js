import {
  DEFAULT_LEARNING_RESOURCES_TIMEOUT_MS,
  getApiTimeoutMs,
} from './environmentConfig.js';
import {
  fetchJsonWithTimeout,
  RequestCancelledError,
  waitForRequest,
  withRequestTimeout,
} from './apiRequest.js';

const RETRYABLE_AUTH_CODES = new Set([
  'firebase-token-expired',
  'firebase-token-invalid',
]);

const refreshesByUser = new WeakMap();
const LEARNING_RESOURCES_TIMEOUT_MS = getApiTimeoutMs(
  import.meta.env,
  'VITE_LEARNING_RESOURCES_TIMEOUT_MS',
  DEFAULT_LEARNING_RESOURCES_TIMEOUT_MS,
);

export function isCurrentLearningResourceRequest({
  requestGeneration,
  currentGeneration,
  requestedUserId,
  currentUserId,
  requestedSkill,
  activeSkill,
}) {
  return requestGeneration === currentGeneration
    && requestedUserId === currentUserId
    && requestedSkill === activeSkill;
}

async function readIdToken(user, forceRefresh, signal) {
  if (signal?.aborted) throw new RequestCancelledError();
  try {
    const idToken = await waitForRequest(user.getIdToken(forceRefresh), signal);
    if (signal?.aborted) throw new RequestCancelledError();
    if (typeof idToken !== 'string' || !idToken.trim()) throw new Error('Empty ID token.');
    return idToken;
  } catch (error) {
    if (error instanceof RequestCancelledError) throw error;
    throw new Error(forceRefresh
      ? 'Your sign-in could not be refreshed. Sign in again, then retry.'
      : 'Your sign-in could not be verified. Sign in again, then retry.');
  }
}

function refreshIdToken(user, signal) {
  const pendingRefresh = refreshesByUser.get(user);
  if (pendingRefresh) return waitForRequest(pendingRefresh, signal);

  let refresh;
  refresh = readIdToken(user, true).finally(() => {
    if (refreshesByUser.get(user) === refresh) refreshesByUser.delete(user);
  });
  refreshesByUser.set(user, refresh);
  return waitForRequest(refresh, signal);
}

async function sendRequest(
  apiBaseUrl,
  skill,
  language,
  idToken,
  pageToken,
  fetchRequest,
  signal,
  timeoutMs,
) {
  const parameters = new URLSearchParams({ skill, language });
  if (pageToken) parameters.set('pageToken', pageToken);
  const result = await fetchJsonWithTimeout(
    `${apiBaseUrl}/api/learning-resources?${parameters.toString()}`,
    {
      headers: { Authorization: `Bearer ${idToken}` },
      signal,
    },
    timeoutMs,
    fetchRequest,
  );
  if (!result.result || typeof result.result !== 'object' || Array.isArray(result.result)) {
    throw new Error('The learning resources service returned an invalid response.');
  }
  return result;
}

export async function requestLearningResources(
  apiBaseUrl,
  skill,
  language,
  user,
  pageToken = null,
  fetchRequest = globalThis.fetch,
  { signal, timeoutMs = LEARNING_RESOURCES_TIMEOUT_MS } = {},
) {
  if (!user || typeof user.getIdToken !== 'function' || typeof fetchRequest !== 'function') {
    throw new Error('Your sign-in could not be verified. Sign in again, then retry.');
  }

  return withRequestTimeout(async (requestSignal) => {
    const idToken = await readIdToken(user, false, requestSignal);
    let result = await sendRequest(
      apiBaseUrl, skill, language, idToken, pageToken, fetchRequest, requestSignal, timeoutMs,
    );
    const authCode = result.result?.detail?.code;
    if (result.response.status === 401 && RETRYABLE_AUTH_CODES.has(authCode)) {
      const refreshedIdToken = await refreshIdToken(user, requestSignal);
      result = await sendRequest(
        apiBaseUrl, skill, language, refreshedIdToken, pageToken, fetchRequest, requestSignal, timeoutMs,
      );
    }
    return result;
  }, { signal, timeoutMs });
}

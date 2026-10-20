const RETRYABLE_AUTH_CODES = new Set([
  'firebase-token-expired',
  'firebase-token-invalid',
]);

const refreshesByUser = new WeakMap();

async function readIdToken(user, forceRefresh) {
  try {
    const idToken = await user.getIdToken(forceRefresh);
    if (typeof idToken !== 'string' || !idToken.trim()) throw new Error('Empty ID token.');
    return idToken;
  } catch {
    throw new Error(forceRefresh
      ? 'Your sign-in could not be refreshed. Sign in again, then retry.'
      : 'Your sign-in could not be verified. Sign in again, then retry.');
  }
}

function refreshIdToken(user) {
  const pendingRefresh = refreshesByUser.get(user);
  if (pendingRefresh) return pendingRefresh;

  let refresh;
  refresh = readIdToken(user, true).finally(() => {
    if (refreshesByUser.get(user) === refresh) refreshesByUser.delete(user);
  });
  refreshesByUser.set(user, refresh);
  return refresh;
}

async function sendRequest(apiBaseUrl, skill, language, idToken, pageToken, fetchRequest) {
  const parameters = new URLSearchParams({ skill, language });
  if (pageToken) parameters.set('pageToken', pageToken);
  const response = await fetchRequest(
    `${apiBaseUrl}/api/learning-resources?${parameters.toString()}`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  const payload = await response.json().catch(() => ({}));
  const result = payload && typeof payload === 'object' ? payload : {};
  return { response, result };
}

export async function requestLearningResources(
  apiBaseUrl,
  skill,
  language,
  user,
  pageToken = null,
  fetchRequest = globalThis.fetch,
) {
  if (!user || typeof user.getIdToken !== 'function' || typeof fetchRequest !== 'function') {
    throw new Error('Your sign-in could not be verified. Sign in again, then retry.');
  }

  const idToken = await readIdToken(user, false);
  let result = await sendRequest(apiBaseUrl, skill, language, idToken, pageToken, fetchRequest);
  const authCode = result.result.detail?.code;
  if (result.response.status === 401 && RETRYABLE_AUTH_CODES.has(authCode)) {
    const refreshedIdToken = await refreshIdToken(user);
    result = await sendRequest(apiBaseUrl, skill, language, refreshedIdToken, pageToken, fetchRequest);
  }
  return result;
}
export class RequestTimeoutError extends Error {
  constructor() {
    super('The request timed out.');
    this.name = 'RequestTimeoutError';
  }
}

export class RequestCancelledError extends Error {
  constructor() {
    super('The request was cancelled.');
    this.name = 'RequestCancelledError';
  }
}

export class ApiNetworkError extends Error {
  constructor() {
    super('The service could not be reached.');
    this.name = 'ApiNetworkError';
  }
}

export class MalformedApiResponseError extends Error {
  constructor() {
    super('The service returned an unreadable response.');
    this.name = 'MalformedApiResponseError';
  }
}

export function waitForRequest(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new RequestCancelledError());

  return new Promise((resolve, reject) => {
    const handleAbort = () => reject(new RequestCancelledError());
    signal.addEventListener('abort', handleAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => {
        signal.removeEventListener('abort', handleAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', handleAbort);
        reject(error);
      },
    );
  });
}

function isAbortError(error) {
  return error?.name === 'AbortError';
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new MalformedApiResponseError();
  }
}

export async function withRequestTimeout(
  operation,
  { signal, timeoutMs, timerApi = globalThis } = {},
) {
  if (signal?.aborted) throw new RequestCancelledError();
  const controller = new AbortController();
  let timedOut = false;
  let externalAbortHandler;
  let timeoutId;
  const interrupted = new Promise((resolve, reject) => {
    timeoutId = timerApi.setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new RequestTimeoutError());
    }, timeoutMs);
    externalAbortHandler = () => {
      controller.abort();
      reject(new RequestCancelledError());
    };
    signal?.addEventListener('abort', externalAbortHandler, { once: true });
    if (signal?.aborted) externalAbortHandler();
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      interrupted,
    ]);
  } catch (error) {
    if (timedOut || error instanceof RequestTimeoutError) throw new RequestTimeoutError();
    if (signal?.aborted || error instanceof RequestCancelledError || isAbortError(error)) {
      throw new RequestCancelledError();
    }
    throw error;
  } finally {
    timerApi.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', externalAbortHandler);
  }
}

export async function fetchJsonWithTimeout(
  url,
  options = {},
  timeoutMs,
  fetchRequest = globalThis.fetch,
  timerApi = globalThis,
) {
  const { signal: externalSignal, ...fetchOptions } = options;
  if (typeof fetchRequest !== 'function') throw new ApiNetworkError();

  return withRequestTimeout(async (signal) => {
    let response;
    try {
      response = await fetchRequest(url, { ...fetchOptions, signal });
    } catch (error) {
      if (signal.aborted || isAbortError(error)) throw new RequestCancelledError();
      throw new ApiNetworkError();
    }
    return { response, result: await readJson(response) };
  }, { signal: externalSignal, timeoutMs, timerApi });
}

export function getApiRequestErrorMessage(error, {
  timeout = 'The request took too long. Please try again.',
  network = 'Could not connect to the service. Check your connection and try again.',
  malformed = 'The service returned an unreadable response. Please try again.',
} = {}) {
  if (error instanceof RequestTimeoutError) return timeout;
  if (error instanceof ApiNetworkError) return network;
  if (error instanceof MalformedApiResponseError) return malformed;
  return error instanceof Error ? error.message : network;
}

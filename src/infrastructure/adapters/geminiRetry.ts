import { ApiError } from "@google/genai";

const RETRYABLE_STATUS_CODES = new Set([429, 500, 503, 504]);
const RETRY_DELAYS_MS = [1000, 2500];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  return error instanceof ApiError && RETRYABLE_STATUS_CODES.has(error.status);
}

/**
 * Gemini's free tier frequently returns transient 429/503 "high demand, try again
 * later" errors that have nothing to do with the request itself. Retry those a
 * couple of times with a short backoff before giving up.
 */
export async function callGeminiWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
      if (isLastAttempt || !isRetryableError(error)) {
        throw error;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw new Error("Unreachable");
}

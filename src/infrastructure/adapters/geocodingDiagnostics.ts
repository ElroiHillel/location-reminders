// A tiny shared channel for surfacing WHY the last geocode failed (e.g. a
// misconfigured Google key), so the UI can show an actionable message instead
// of silently saving a reminder with no location.

let lastIssue: string | null = null;

export function setGeocodingIssue(message: string): void {
  lastIssue = message;
}

export function clearGeocodingIssue(): void {
  lastIssue = null;
}

/** Reads and clears the last geocoding issue (one-shot). */
export function takeGeocodingIssue(): string | null {
  const issue = lastIssue;
  lastIssue = null;
  return issue;
}

// Same one-shot channel for voice transcription (why Gemini returned nothing).
let lastTranscriptionIssue: string | null = null;

export function setTranscriptionIssue(message: string): void {
  lastTranscriptionIssue = message;
}

export function takeTranscriptionIssue(): string | null {
  const issue = lastTranscriptionIssue;
  lastTranscriptionIssue = null;
  return issue;
}

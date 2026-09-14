// Test-only, in-memory fault injection. This is inert unless explicitly enabled
// in an isolated development/preview environment and is never persisted.
const refetchFailures = new Set<string>();

export function integrationModeEnabled() {
  return process.env.INTEGRATION_TEST_MODE === "true" && process.env.VERCEL_ENV !== "production";
}

export function armSupportRefetchFailure(sessionId: string) {
  if (!integrationModeEnabled()) return false;
  refetchFailures.add(sessionId);
  return true;
}

export function consumeSupportRefetchFailure(sessionId: string) {
  if (!integrationModeEnabled() || !refetchFailures.has(sessionId)) return false;
  refetchFailures.delete(sessionId);
  return true;
}

import type { AppMode } from "./domain";

export function shouldShowVerifiedBadge(appMode: AppMode, sessionVerified: boolean, demoVerified: boolean) {
  if (appMode === "authenticated") return sessionVerified;
  return appMode === "demo" && demoVerified;
}

export function canCreateMarketplaceListing(appMode: AppMode) {
  return appMode === "demo" || appMode === "authenticated";
}

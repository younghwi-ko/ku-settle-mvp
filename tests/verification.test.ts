import { describe, expect, it } from "vitest";
import { canCreateMarketplaceListing, shouldShowVerifiedBadge } from "../app/lib/verification";

describe("verified badge visibility", () => {
  it("never treats legacy demo verification as a signed-out guest session", () => {
    expect(shouldShowVerifiedBadge("guest", false, true)).toBe(false);
  });

  it("shows the badge only for a verified authenticated session or an explicitly verified demo", () => {
    expect(shouldShowVerifiedBadge("authenticated", true, false)).toBe(true);
    expect(shouldShowVerifiedBadge("authenticated", false, true)).toBe(false);
    expect(shouldShowVerifiedBadge("demo", false, true)).toBe(true);
    expect(shouldShowVerifiedBadge("demo", false, false)).toBe(false);
  });
});

describe("marketplace listing gate", () => {
  it("blocks signed-out guests while preserving local Demo and authenticated listing flows", () => {
    expect(canCreateMarketplaceListing("guest")).toBe(false);
    expect(canCreateMarketplaceListing("demo")).toBe(true);
    expect(canCreateMarketplaceListing("authenticated")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { places } from "../app/data";
import { placeGuidance, placeVerificationRank } from "../app/lib/place-guidance";

describe("place guidance", () => {
  it("uses campus guidance for campus anchors instead of hospital advice", () => {
    const gate = places.find((place) => place.displayName === "고려대 정문");
    expect(gate).toBeDefined();
    const guidance = placeGuidance(gate!, "ko");
    expect(guidance.tip).toContain("건물 위치");
    expect(guidance.tip).not.toContain("진료과");
    expect(guidance.language).toBeUndefined();
  });

  it("classifies every static campus anchor before resolving guidance", () => {
    const campusAnchors = places.filter((place) => place.kind === "campus");
    expect(campusAnchors.length).toBeGreaterThan(0);
    expect(campusAnchors.every((place) => place.venueType === "campus-anchor")).toBe(true);
    expect(campusAnchors.every((place) => !placeGuidance(place, "ko").tip.includes("진료과"))).toBe(true);
  });

  it("keeps hospital language guidance and ranks verified places first", () => {
    const hospital = places.find((place) => place.category === "Hospital");
    expect(placeGuidance(hospital!, "en").language).toContain("language support");
    expect(placeVerificationRank({ verificationStatus: "official", source: "official" } as never)).toBeLessThan(placeVerificationRank({ verificationStatus: "needs_confirmation" } as never));
  });
});

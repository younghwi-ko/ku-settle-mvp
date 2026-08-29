import { describe, expect, it } from "vitest";
import { places } from "../app/data";
import { dedupePlaces, isValidCoordinates, kakaoPlaceToPlace } from "../app/lib/kakao";

describe("trusted local guide places", () => {
  it("keeps dietary records separate from generic food results", () => {
    expect(places.find((place) => place.id === 9101)?.halalStatus).toBe("menu-available");
    expect(places.find((place) => place.id === 9102)?.veganStatus).toBe("menu-available");
    expect(places.find((place) => place.id === 9104)?.veganStatus).toBe("needs-menu-check");
    expect(places.find((place) => place.id === 9101)?.venueType).toBe("campus-cafeteria");
  });

  it("does not promote malformed or unverified coordinates to map markers", () => {
    expect(isValidCoordinates(undefined)).toBe(false);
    expect(kakaoPlaceToPlace({ id: "1", place_name: "bad", x: "x", y: "y" }, new Date().toISOString())).toBeNull();
  });

  it("deduplicates API places by Kakao place id", () => {
    const first = kakaoPlaceToPlace({ id: "42", place_name: "Cafe", x: "127.03", y: "37.59", category_group_code: "CE7" }, new Date().toISOString());
    expect(first).not.toBeNull();
    expect(dedupePlaces([first!, { ...first!, id: 942, displayName: "Cafe duplicate" }])).toHaveLength(1);
  });
});

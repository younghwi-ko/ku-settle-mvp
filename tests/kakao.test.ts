import { describe, expect, it } from "vitest";
import { dedupePlaces, isKakaoPlaceAllowed, isValidCoordinates, kakaoCategoryCode, kakaoKeyword, kakaoPlaceToPlace, KU_CENTER } from "../app/lib/kakao";

describe("Kakao place integration helpers", () => {
  it("uses KU as the default center and maps supported categories", () => {
    expect(KU_CENTER.lat).toBeGreaterThan(37);
    expect(kakaoCategoryCode("Hospital")).toBe("HP8");
    expect(kakaoCategoryCode("Hair Salon")).toBeNull();
    expect(kakaoKeyword("Hair Salon")).toBe("미용실");
  });
  it("validates coordinates and ignores malformed Kakao results", () => {
    expect(isValidCoordinates({ lat: 37.59, lng: 127.03 })).toBe(true);
    expect(isValidCoordinates({ lat: 91, lng: 127.03 })).toBe(false);
    expect(kakaoPlaceToPlace({ id: "1", place_name: "Broken", x: "bad", y: "127" }, new Date().toISOString())).toBeNull();
  });
  it("normalizes Kakao fields and removes duplicate place ids", () => {
    const fetchedAt = "2026-08-29T00:00:00.000Z";
    const first = kakaoPlaceToPlace({ id: "123", place_name: "KU Pharmacy", category_group_code: "PM9", category_group_name: "약국", category_name: "의약품 > 약국", road_address_name: "서울 성북구", phone: "02-1234-5678", x: "127.032", y: "37.590", place_url: "https://place.map.kakao.com/123", distance: "250" }, fetchedAt);
    const second = kakaoPlaceToPlace({ id: "123", place_name: "KU Pharmacy", category_group_code: "PM9", x: "127.032", y: "37.590" }, fetchedAt);
    expect(first?.source).toBe("kakao");
    expect(first?.phone).toBe("02-1234-5678");
    expect(first?.coordinates).toEqual({ lat: 37.59, lng: 127.032 });
    expect(first?.kakaoCategoryGroupName).toBe("약국");
    expect(dedupePlaces([first!, second!])).toHaveLength(1);
  });

  it("keeps All results limited to supported place groups", () => {
    expect(isKakaoPlaceAllowed({ category_group_code: "FD6" }, "All")).toBe(true);
    expect(isKakaoPlaceAllowed({ category_group_code: "CE7" }, "All")).toBe(true);
    expect(isKakaoPlaceAllowed({ category_group_code: "" }, "All")).toBe(false);
    expect(isKakaoPlaceAllowed({ category_group_code: "SC4" }, "All")).toBe(false);
    expect(kakaoPlaceToPlace({ id: "42", place_name: "KU Main Building", category_group_code: "SC4", x: "127.032", y: "37.590" }, fetchedAtForTest())).toBeNull();
  });

  it("requires confirmation for keyword-only categories", () => {
    const place = kakaoPlaceToPlace({ id: "44", place_name: "Example Vegan Cafe", category_group_code: "CE7", category_group_name: "카페", x: "127.032", y: "37.590" }, fetchedAtForTest(), "Vegan");
    expect(place?.category).toBe("Vegan");
    expect(place?.verificationStatus).toBe("needs_confirmation");
  });
});

function fetchedAtForTest() { return "2026-08-29T00:00:00.000Z"; }

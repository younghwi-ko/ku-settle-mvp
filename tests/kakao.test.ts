import { describe, expect, it } from "vitest";
import { dedupePlaces, isValidCoordinates, kakaoCategoryCode, kakaoKeyword, kakaoPlaceToPlace, KU_CENTER } from "../app/lib/kakao";

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
    const first = kakaoPlaceToPlace({ id: "123", place_name: "KU Pharmacy", category_group_code: "PM9", category_name: "의약품", road_address_name: "서울 성북구", phone: "02-1234-5678", x: "127.032", y: "37.590", place_url: "https://place.map.kakao.com/123", distance: "250" }, fetchedAt);
    const second = kakaoPlaceToPlace({ id: "123", place_name: "KU Pharmacy", category_group_code: "PM9", x: "127.032", y: "37.590" }, fetchedAt);
    expect(first?.source).toBe("kakao");
    expect(first?.phone).toBe("02-1234-5678");
    expect(first?.coordinates).toEqual({ lat: 37.59, lng: 127.032 });
    expect(dedupePlaces([first!, second!])).toHaveLength(1);
  });
});

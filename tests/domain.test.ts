import { describe, expect, it } from "vitest";
import { googleMapsDirectionsUrl, googleMapsSearchUrl, isKuEmail, isOwnedMarketplaceProduct, isPickupPast, isValidImageDataUrl, isValidPickupSchedule, mapServiceError, mergeCompletedTaskIds, normalizeKuEmail, normalizeLocale, productToMarketplaceInsert, validateMarketplaceInput, validateProfileInput } from "../app/lib/domain";
import { expandedLifeGuideArticles } from "../app/guide-content";
import { renderOtpEmail } from "../supabase/functions/_shared/email-templates";

describe("KU email validation", () => {
  it("normalizes and accepts only the exact domain", () => {
    expect(normalizeKuEmail("  STUDENT@KOREA.AC.KR ")).toBe("student@korea.ac.kr");
    expect(isKuEmail("STUDENT@KOREA.AC.KR")).toBe(true);
    for (const value of ["student@sub.korea.ac.kr", "student@korea.ac.kr.example.com", "student@@korea.ac.kr", "@korea.ac.kr", "student@gmail.com"]) expect(isKuEmail(value)).toBe(false);
  });
});

describe("domain validation and migration", () => {
  it("separates owned demo listings from sample listings", () => {
    expect(isOwnedMarketplaceProduct({ userCreated: true, source: "demo" }, "demo")).toBe(true);
    expect(isOwnedMarketplaceProduct({ userCreated: true, source: "sample" }, "demo")).toBe(false);
    expect(isOwnedMarketplaceProduct({ userCreated: true, source: "live", ownedByCurrentUser: true }, "authenticated")).toBe(true);
    expect(isOwnedMarketplaceProduct({ userCreated: true, source: "live", ownedByCurrentUser: false }, "authenticated")).toBe(false);
  });
  it("creates encoded Google Maps links and validates image data", () => {
    expect(googleMapsSearchUrl("고려대 정문 & Gate")).toContain(encodeURIComponent("고려대 정문 & Gate"));
    expect(googleMapsDirectionsUrl("KU Main Gate")).toContain("destination=KU%20Main%20Gate");
    expect(isValidImageDataUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(isValidImageDataUrl("data:text/plain;base64,AAAA")).toBe(false);
  });
  it("validates pickup schedules and detects expired appointments", () => {
    const schedule = { pickupDate: "2026-08-29", pickupStartTime: "10:00", pickupEndTime: "11:00" };
    expect(isValidPickupSchedule(schedule)).toBe(true);
    expect(isValidPickupSchedule({ ...schedule, pickupEndTime: "09:00" })).toBe(false);
    expect(isPickupPast(schedule, new Date("2026-08-29T12:00:00"))).toBe(true);
  });
  it("contains expandable guide content for each lifecycle category", () => {
    expect(expandedLifeGuideArticles.length).toBeGreaterThanOrEqual(8);
    expect(new Set(expandedLifeGuideArticles.map((item) => item.category)).size).toBe(8);
    expect(expandedLifeGuideArticles.every((item) => item.id && item.checklist.length && item.locales.ko && item.locales.ja && item.locales["zh-CN"])).toBe(true);
  });
  it("validates profiles and listings", () => {
    expect(validateProfileInput({ name: " Mina ", arrivalDate: "2026-09-01", housing: "dorm" }).valid).toBe(true);
    expect(validateProfileInput({ name: "", arrivalDate: "bad", housing: "dorm" }).valid).toBe(false);
    expect(validateMarketplaceInput({ name: "Lamp", priceKrw: 8000, category: "Home", condition: "good", pickup: "KU gate", status: "Available" }).valid).toBe(true);
    expect(() => productToMarketplaceInsert({ id: "x", name: "Lamp", priceKrw: 0, category: "Home", condition: "good", pickup: "KU", status: "Available", icon: "lamp" }, "u", "Mina")).toThrow();
  });
  it("merges only stable known task IDs without downgrading completion", () => expect(mergeCompletedTaskIds(["arc"], ["arc", "bank", "unknown"], ["arc", "bank"])).toEqual(["arc", "bank"]));
  it("maps service failures to safe UI errors", () => expect(mapServiceError(new Error("rate limit"))).toBe("errors:rateLimit"));
});

describe("localized email templates", () => {
  it.each(["en", "ko", "ja", "zh-CN"] as const)("renders %s HTML and text", (locale) => {
    const result = renderOtpEmail(locale, "123456");
    expect(result.locale).toBe(locale); expect(result.html).toContain("123456"); expect(result.text).toContain("123456"); expect(result.subject.length).toBeGreaterThan(4);
  });
  it("falls back to English", () => expect(renderOtpEmail("invalid", "123456").locale).toBe("en"));
  it("normalizes locale metadata", () => expect(normalizeLocale("zh-TW")).toBe("en"));
});

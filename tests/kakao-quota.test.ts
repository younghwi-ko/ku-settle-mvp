import { afterEach, describe, expect, it } from "vitest";
import { canUseKakaoCall, currentQuotaMonth, kakaoMonthlyLimit, kakaoQuotaSnapshot, recordKakaoCall, resetKakaoQuotaForTests } from "../app/lib/kakao-quota";

describe("Kakao monthly quota guard", () => {
  afterEach(() => resetKakaoQuotaForTests());

  it("uses a safety margin below Kakao's documented free allowance by default", () => {
    expect(kakaoMonthlyLimit(undefined)).toBe(2_900_000);
  });

  it("blocks calls at the configured monthly limit", () => {
    const date = new Date("2026-08-29T00:00:00Z");
    expect(canUseKakaoCall(2, date)).toBe(true);
    recordKakaoCall(date);
    expect(canUseKakaoCall(2, date)).toBe(true);
    recordKakaoCall(date);
    expect(canUseKakaoCall(2, date)).toBe(false);
    expect(kakaoQuotaSnapshot(2, date)).toEqual({ month: "2026-08", calls: 2, limit: 2, remaining: 0 });
  });

  it("starts a fresh budget in a new UTC month", () => {
    recordKakaoCall(new Date("2026-08-31T23:59:00Z"));
    expect(kakaoQuotaSnapshot(2, new Date("2026-09-01T00:00:00Z"))).toEqual({ month: "2026-09", calls: 0, limit: 2, remaining: 2 });
    expect(currentQuotaMonth(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09");
  });
});

const DEFAULT_MONTHLY_LIMIT = 2_900_000;

type QuotaState = {
  month: string;
  calls: number;
};

let state: QuotaState = { month: "", calls: 0 };

export function kakaoMonthlyLimit(rawValue = process.env.KAKAO_MONTHLY_CALL_LIMIT) {
  const value = Number(rawValue);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MONTHLY_LIMIT;
}

export function currentQuotaMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function canUseKakaoCall(limit = kakaoMonthlyLimit(), date = new Date()) {
  const month = currentQuotaMonth(date);
  if (state.month !== month) state = { month, calls: 0 };
  return state.calls < limit;
}

export function recordKakaoCall(date = new Date()) {
  const month = currentQuotaMonth(date);
  if (state.month !== month) state = { month, calls: 0 };
  state.calls += 1;
  return state.calls;
}

export function kakaoQuotaSnapshot(limit = kakaoMonthlyLimit(), date = new Date()) {
  const month = currentQuotaMonth(date);
  if (state.month !== month) state = { month, calls: 0 };
  return { month, calls: state.calls, limit, remaining: Math.max(0, limit - state.calls) };
}

export function resetKakaoQuotaForTests() {
  state = { month: "", calls: 0 };
}

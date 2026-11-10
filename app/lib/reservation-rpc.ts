import { apiError } from "./server-api";

// SQL이 명시적으로 거절한 경우만 4xx로 표시한다. 연결/미설치/저장 오류는 재확인 가능한 502다.
export function reservationRpcError(error: { code?: string; message: string }, fallback: string) {
  const codes: Record<string, number> = {
    forbidden: 403, reservation_not_found: 404, version_conflict: 409,
    listing_unavailable: 409, cannot_reserve_own_listing: 409, idempotency_conflict: 409,
    reservation_restore_requires_cancelled: 409, reservation_already_closed: 409,
    invalid_pickup_schedule: 422, invalid_reservation_update: 422, invalid_reservation_status: 422,
    reservation_confirmation_pending: 502,
  };
  if (error.code === "23505") return apiError("listing_already_reserved", 409);
  return Object.hasOwn(codes, error.message)
    ? apiError(error.message, codes[error.message])
    : apiError(fallback, 502);
}

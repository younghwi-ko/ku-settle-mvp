import type { SupabaseClient } from "@supabase/supabase-js";
import { notifySession } from "./notifications";

// Called during normal reads and writes. This free-plan approach avoids a
// scheduler while still ensuring an expired reservation releases its listing.
export async function expireReservations(client: SupabaseClient) {
  const now = new Date().toISOString();
  const { data } = await client.from("guest_reservations").select("id,listing_id,buyer_session_id,version").eq("status", "active").lt("expires_at", now).limit(100);
  for (const reservation of data ?? []) {
    const { data, error } = await client.rpc("transition_guest_reservation", {
      p_id: reservation.id, p_session_id: null, p_status: "expired",
      p_version: reservation.version, p_mode: "expiry",
    });
    // 충돌/실패는 다음 조회에서 재시도한다. 예약과 상품은 RPC 안에서 함께 롤백된다.
    if (error || !data?.changed) continue;
    await notifySession(client, reservation.buyer_session_id, "reservation_expired", "예약이 만료되었습니다", "예약 시간이 지났습니다. 현재 상품 상태를 확인하세요.", "reservation", reservation.id);
  }
}

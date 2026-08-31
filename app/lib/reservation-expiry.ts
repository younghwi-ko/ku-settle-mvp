import type { SupabaseClient } from "@supabase/supabase-js";
import { notifySession } from "./notifications";

// Called during normal reads and writes. This free-plan approach avoids a
// scheduler while still ensuring an expired reservation releases its listing.
export async function expireReservations(client: SupabaseClient) {
  const now = new Date().toISOString();
  const { data } = await client.from("guest_reservations").select("id,listing_id,buyer_session_id,version").eq("status", "active").lt("expires_at", now).limit(100);
  for (const reservation of data ?? []) {
    const { data: changed } = await client.from("guest_reservations").update({ status: "expired", cancelled_at: now, updated_at: now, version: reservation.version + 1 }).eq("id", reservation.id).eq("version", reservation.version).eq("status", "active").select("id").maybeSingle();
    if (!changed) continue;
    await client.from("guest_listings").update({ status: "active", availability: "available" }).eq("id", reservation.listing_id).eq("status", "reserved");
    await notifySession(client, reservation.buyer_session_id, "reservation_expired", "예약이 만료되었습니다", "예약 시간이 지나 상품이 다시 공개되었습니다.", "reservation", reservation.id);
  }
}

const KST = "Asia/Seoul";

function dateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: KST, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: Number(pick("year")), month: Number(pick("month")), day: Number(pick("day")) };
}

function closedDates() {
  return new Set((process.env.PILOT_CLOSED_DATES ?? "").split(",").map((item) => item.trim()).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)));
}

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }

/** The second business day after receipt, at 18:00 Asia/Seoul. */
export function firstResponseDueAt(receivedAt = new Date()) {
  const { year, month, day } = dateParts(receivedAt);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  const closed = closedDates();
  let remaining = 2;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !closed.has(isoDate(cursor))) remaining -= 1;
  }
  // 18:00 KST is 09:00 UTC.  Korea does not observe daylight saving time.
  return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), 9, 0, 0));
}

export function isTicketOverdue(ticket: { first_response_due_at?: string | null; first_response_at?: string | null; status?: string }, now = new Date()) {
  return Boolean(ticket.first_response_due_at && !ticket.first_response_at && !["closed", "deleted"].includes(ticket.status ?? "") && new Date(ticket.first_response_due_at).getTime() < now.getTime());
}

const categories = new Set(["Food", "Halal", "Vegan", "Hospital", "Pharmacy", "Hair Salon", "Cafe", "Grocery"]);
const venueTypes = new Set(["commercial", "campus-cafeteria", "campus-anchor"]);
const campusPointTypes = new Set(["gate", "plaza", "residence", "international", "general"]);
const statuses = new Set(["active", "inactive", "deleted", "needs_confirmation"]);

const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
const url = (value: unknown) => typeof value === "string" && /^https?:\/\/[^\s]{1,500}$/i.test(value);
const coordinates = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const point = value as { lat?: unknown; lng?: unknown };
  return typeof point.lat === "number" && typeof point.lng === "number" && point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180;
};

export function validatePlacePayload(payload: Record<string, unknown>, required = false) {
  const category = payload.category;
  const venueType = payload.venueType;
  const campusPointType = payload.campusPointType;
  if (required && (!text(payload.displayName ?? payload.name, 160) || !text(payload.address, 500) || !text(payload.sourceName, 160) && !url(payload.officialUrl) || !text(payload.lastVerifiedAt, 20))) return "place_required_fields";
  if (category !== undefined && (typeof category !== "string" || !categories.has(category))) return "invalid_place_category";
  if (venueType !== undefined && (typeof venueType !== "string" || !venueTypes.has(venueType))) return "invalid_place_venue_type";
  if (campusPointType !== undefined && (typeof campusPointType !== "string" || !campusPointTypes.has(campusPointType))) return "invalid_campus_point_type";
  if (payload.status !== undefined && (typeof payload.status !== "string" || !statuses.has(payload.status))) return "invalid_place_status";
  if (payload.coordinates !== undefined && !coordinates(payload.coordinates)) return "invalid_place_coordinates";
  if (payload.officialUrl !== undefined && payload.officialUrl !== null && !url(payload.officialUrl)) return "invalid_place_url";
  for (const [key, max] of [["displayName", 160], ["name", 160], ["address", 500], ["phone", 80], ["hours", 160], ["closedDays", 160], ["sourceName", 160], ["usageConditions", 1000]] as const) if (payload[key] !== undefined && payload[key] !== null && !text(payload[key], max)) return "invalid_place_text";
  if (required && venueType === "campus-anchor" && !campusPointTypes.has(String(campusPointType))) return "campus_point_type_required";
  if (required && venueType === "campus-anchor" && !url(payload.officialUrl)) return "campus_official_url_required";
  if (required && category === "Hospital" && (!text(payload.phone, 80) || !["confirmed", "ask_provider", "unknown"].includes(String(payload.languageSupport ?? "")))) return "hospital_fields_required";
  if (required && ["Food", "Halal", "Vegan", "Cafe", "Grocery"].includes(String(category)) && !text(payload.hours, 160)) return "food_hours_required";
  if (required && category === "Pharmacy" && (!text(payload.hours, 160) || typeof payload.prescriptionAvailable !== "boolean")) return "pharmacy_fields_required";
  return null;
}

export function normalizePlaceText(value: unknown) { return typeof value === "string" ? value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ") : ""; }

// 사용자 GET과 변경 응답은 같은 공개 필드만 반환한다. 관리자 조회에는 적용하지 않는다.
export const publicServiceRequestColumns = "id,reference_code,listing_id,task_id,service_type,status,delivery_method,origin,destination,storage_duration,storage_location,estimated_cost_label,terms_note,version,created_at,updated_at";
const publicKeys = publicServiceRequestColumns.split(",");

export function publicServiceRequest(row: Record<string, unknown> | null) {
  return row ? Object.fromEntries(publicKeys.map((key) => [key, row[key]])) : null;
}

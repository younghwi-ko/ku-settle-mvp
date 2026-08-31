export type AdminListParams = { page: number; pageSize: number; search: string; status: string | null; includeDeleted: boolean };

export function adminListParams(request: Request): AdminListParams {
  const url = new URL(request.url);
  const parse = (value: string | null, fallback: number, maximum: number) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maximum) : fallback;
  };
  return {
    page: parse(url.searchParams.get("page"), 1, 100000),
    pageSize: parse(url.searchParams.get("pageSize"), 20, 100),
    // PostgREST pattern characters are removed so this remains a literal search.
    search: (url.searchParams.get("search") ?? "").trim().slice(0, 120).replace(/[%_(),]/g, ""),
    status: (url.searchParams.get("status") ?? "").trim().slice(0, 60) || null,
    includeDeleted: url.searchParams.get("includeDeleted") === "true",
  };
}

export function pagination(params: AdminListParams, total: number | null) {
  const count = total ?? 0;
  return { page: params.page, pageSize: params.pageSize, total: count, totalPages: Math.max(1, Math.ceil(count / params.pageSize)) };
}

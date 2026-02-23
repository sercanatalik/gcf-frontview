import type {
  TableQueryParams,
  TableQueryResponse,
  EnrichedTablesResponse,
} from "./types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_PATH}${path}`);
  if (!res.ok) throw new Error(`API error: ${path}`);
  return res.json();
}

export function fetchTables(): Promise<EnrichedTablesResponse> {
  return apiFetch("/api/tables");
}

export function fetchTableData(
  params: TableQueryParams
): Promise<TableQueryResponse> {
  const sp = new URLSearchParams();

  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  if (params.columns?.length) sp.set("columns", params.columns.join(","));
  if (params.orderBy) sp.set("order_by", params.orderBy);
  if (params.orderDir) sp.set("order_dir", params.orderDir);

  if (params.filters) {
    for (const [col, value] of Object.entries(params.filters)) {
      sp.set(`filter_${col}`, value);
    }
  }

  const qs = sp.toString();
  return apiFetch(`/api/tables/${params.table}${qs ? `?${qs}` : ""}`);
}

export async function fetchAllTableData(
  tableName: string,
  options: { asOfDate?: string; batchSize?: number } = {}
): Promise<Record<string, unknown>[]> {
  const { asOfDate, batchSize = 100_000 } = options;
  const allRows: Record<string, unknown>[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const sp = new URLSearchParams();
    sp.set("limit", String(batchSize));
    sp.set("offset", String(offset));
    if (asOfDate) sp.set("as_of_date", asOfDate);

    const data = await apiFetch<TableQueryResponse>(
      `/api/tables/${tableName}?${sp.toString()}`
    );

    allRows.push(...data.rows);
    hasMore = data.meta.hasMore;
    offset += batchSize;
  }

  return allRows;
}

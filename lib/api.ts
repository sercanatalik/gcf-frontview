import type {
  TablesResponse,
  TableQueryParams,
  TableQueryResponse,
  EnrichedTablesResponse,
} from "./types";

export async function fetchTables(): Promise<TablesResponse> {
  const res = await fetch("/api/tables");
  if (!res.ok) throw new Error("Failed to fetch tables");
  return res.json();
}

export async function fetchEnrichedTables(): Promise<EnrichedTablesResponse> {
  const res = await fetch("/api/tables");
  if (!res.ok) throw new Error("Failed to fetch tables");
  return res.json();
}

export async function fetchTableData(params: TableQueryParams): Promise<TableQueryResponse> {
  const searchParams = new URLSearchParams();

  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.offset != null) searchParams.set("offset", String(params.offset));
  if (params.columns?.length) searchParams.set("columns", params.columns.join(","));
  if (params.orderBy) searchParams.set("order_by", params.orderBy);
  if (params.orderDir) searchParams.set("order_dir", params.orderDir);

  if (params.filters) {
    for (const [col, value] of Object.entries(params.filters)) {
      searchParams.set(`filter_${col}`, value);
    }
  }

  const qs = searchParams.toString();
  const url = `/api/tables/${params.table}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch table '${params.table}'`);
  return res.json();
}

export async function fetchAllTableData(
  tableName: string,
  hasAsOfDate: boolean,
  batchSize = 100000
): Promise<Record<string, unknown>[]> {
  const allRows: Record<string, unknown>[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(batchSize));
    searchParams.set("offset", String(offset));
    if (hasAsOfDate) {
      searchParams.set("as_of_date", "__latest__");
    }

    const url = `/api/tables/${tableName}?${searchParams.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch table '${tableName}'`);
    const data: TableQueryResponse = await res.json();

    allRows.push(...data.rows);
    hasMore = data.meta.hasMore;
    offset += batchSize;
  }

  return allRows;
}

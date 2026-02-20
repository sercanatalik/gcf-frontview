export interface ColumnInfo {
  name: string;
  type: string;
  defaultType?: string;
  defaultExpression?: string;
  comment?: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
}

export interface TablesResponse {
  tables: TableInfo[];
}

export interface TableQueryParams {
  table: string;
  limit?: number;
  offset?: number;
  columns?: string[];
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  filters?: Record<string, string>;
}

export interface TableQueryMeta {
  totalRows: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TableQueryResponse {
  table: string;
  rows: Record<string, unknown>[];
  meta: TableQueryMeta;
}

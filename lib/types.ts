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

// Enriched types for dynamic Perspective loading

export interface EnrichedColumnInfo extends ColumnInfo {
  perspectiveType: "float" | "integer" | "string" | "datetime" | "boolean";
}

export interface EnrichedTableInfo {
  name: string;
  columns: EnrichedColumnInfo[];
  rowCount: number;
  hasAsOfDate: boolean;
  latestAsOfDate?: string;
}

export interface EnrichedTablesResponse {
  tables: EnrichedTableInfo[];
}

export type LoadingPhase =
  | "init-wasm"
  | "fetch-schemas"
  | "load-tables"
  | "restore-layout"
  | "done";

export interface LoadingProgress {
  phase: LoadingPhase;
  tablesTotal: number;
  tablesLoaded: number;
  currentTable: string;
  error?: string;
}

import { createClient, ClickHouseClient } from "@clickhouse/client";

const globalForClickHouse = globalThis as unknown as {
  clickhouse: ClickHouseClient | undefined;
};

export const clickhouse =
  globalForClickHouse.clickhouse ??
  createClient({
    url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
    username: process.env.CLICKHOUSE_USER ?? "default",
    password: process.env.CLICKHOUSE_PASSWORD ?? "",
    database: process.env.CLICKHOUSE_DATABASE ?? "default",
  });

if (process.env.NODE_ENV !== "production") {
  globalForClickHouse.clickhouse = clickhouse;
}

export const allowedTables: string[] = (process.env.CLICKHOUSE_TABLES || "risk_mv,hmsbook,trade")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

export function isTableAllowed(name: string): boolean {
  return allowedTables.length === 0 || allowedTables.includes(name);
}

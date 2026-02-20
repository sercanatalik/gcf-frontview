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

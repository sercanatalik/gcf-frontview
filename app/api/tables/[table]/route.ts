import { NextRequest, NextResponse } from "next/server";
import { clickhouse, isTableAllowed } from "@/lib/clickhouse";

const MAX_LIMIT = 1000000;
const DEFAULT_LIMIT = 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;

    // Validate table name: alphanumeric + underscores only
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      return NextResponse.json(
        { error: `Invalid table name: '${table}'` },
        { status: 400 }
      );
    }

    if (!isTableAllowed(table)) {
      return NextResponse.json(
        { error: `Table '${table}' not found` },
        { status: 404 }
      );
    }

    // Check table exists
    const existsResult = await clickhouse.query({
      query: `EXISTS TABLE ${table}`,
      format: "TabSeparated",
    });
    const existsText = (await existsResult.text()).trim();
    if (existsText !== "1") {
      return NextResponse.json(
        { error: `Table '${table}' not found` },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(
      Number(searchParams.get("limit") ?? DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const offset = Number(searchParams.get("offset") ?? 0);
    const orderBy = searchParams.get("order_by");
    const orderDir = searchParams.get("order_dir")?.toUpperCase() === "DESC" ? "DESC" : "ASC";
    const columns = searchParams.get("columns");
    const asOfDate = searchParams.get("as_of_date");

    // Build column selection
    const selectColumns = columns
      ? columns.split(",").map((c) => c.trim()).filter(Boolean)
      : ["*"];

    // Validate column names (alphanumeric and underscores only)
    for (const col of selectColumns) {
      if (col !== "*" && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
        return NextResponse.json(
          { error: `Invalid column name: '${col}'` },
          { status: 400 }
        );
      }
    }

    // Build WHERE clause from query params (filter_<column>=value)
    const whereClauses: string[] = [];
    const queryParams: Record<string, string> = {};
    let paramIndex = 0;

    // Handle as_of_date=__latest__ sentinel
    if (asOfDate === "__latest__") {
      const maxResult = await clickhouse.query({
        query: `SELECT max(as_of_date) as max_date FROM ${table}`,
        format: "JSONEachRow",
      });
      const maxRows = await maxResult.json<{ max_date: string }>();
      const maxDate = maxRows[0]?.max_date;
      if (maxDate) {
        const pName = `p${paramIndex++}`;
        whereClauses.push(`as_of_date = {${pName}:String}`);
        queryParams[pName] = maxDate;
      }
    } else if (asOfDate) {
      const pName = `p${paramIndex++}`;
      whereClauses.push(`as_of_date = {${pName}:String}`);
      queryParams[pName] = asOfDate;
    }

    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith("filter_")) {
        const column = key.slice(7);
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return NextResponse.json(
            { error: `Invalid filter column: '${column}'` },
            { status: 400 }
          );
        }
        const paramName = `p${paramIndex++}`;
        whereClauses.push(`${column} = {${paramName}:String}`);
        queryParams[paramName] = value;
      }
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Validate order_by column
    let orderSQL = "";
    if (orderBy) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(orderBy)) {
        return NextResponse.json(
          { error: `Invalid order_by column: '${orderBy}'` },
          { status: 400 }
        );
      }
      orderSQL = `ORDER BY ${orderBy} ${orderDir}`;
    }

    const final = table.endsWith("_mv") ? " FINAL" : "";
    const query = `SELECT ${selectColumns.join(", ")} FROM ${table}${final} ${whereSQL} ${orderSQL} LIMIT ${limit} OFFSET ${offset}`;

    const [dataResult, countResult] = await Promise.all([
      clickhouse.query({
        query,
        format: "JSONEachRow",
        query_params: queryParams,
      }),
      clickhouse.query({
        query: `SELECT count() as count FROM ${table}${final} ${whereSQL}`,
        format: "JSONEachRow",
        query_params: queryParams,
      }),
    ]);

    const rows = await dataResult.json();
    const countRows = await countResult.json<{ count: string }>();
    const totalRows = Number(countRows[0]?.count ?? 0);

    return NextResponse.json({
      table,
      rows,
      meta: {
        totalRows,
        limit,
        offset,
        hasMore: offset + limit < totalRows,
      },
    });
  } catch (error) {
    console.error("Failed to query table:", error);
    return NextResponse.json(
      { error: "Failed to query table" },
      { status: 500 }
    );
  }
}

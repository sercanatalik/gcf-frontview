"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { HTMLPerspectiveWorkspaceElement } from "@perspective-dev/workspace";
import type { LoadingProgress, EnrichedTableInfo } from "@/lib/types";
import { fetchEnrichedTables, fetchAllTableData } from "@/lib/api";

const STORAGE_KEY = "perspective-workspace-state";

const INITIAL_PROGRESS: LoadingProgress = {
  phase: "init-wasm",
  tablesTotal: 0,
  tablesLoaded: 0,
  currentTable: "",
};

function buildDefaultLayout(tables: EnrichedTableInfo[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewers: Record<string, any> = {};

  // Top: first table as datagrid (first 10 columns)
  if (tables.length > 0) {
    const first = tables[0];
    const cols = first.columns.slice(0, 10).map((c) => c.name);
    viewers["viewer-0"] = {
      plugin: "Datagrid",
      columns: cols,
      table: first.name,
    };
  }

  // If no ClickHouse tables, empty layout
  if (tables.length === 0) {
    return { sizes: [], viewers, detail: { main: null } };
  }

  return {
    sizes: [],
    viewers,
    detail: {
      main: {
        type: "tab-area" as const,
        widgets: ["viewer-0"],
        currentIndex: 0,
      },
    },
  };
}

export function usePerspective(
  workspaceRef: React.RefObject<HTMLPerspectiveWorkspaceElement | null>
) {
  const [loading, setLoading] = useState<LoadingProgress>(INITIAL_PROGRESS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);
  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    let cancelled = false;

    async function setup() {
      try {
        // Phase 1: Init WASM
        setLoading({ ...INITIAL_PROGRESS, phase: "init-wasm" });

        await import("@perspective-dev/viewer-datagrid");
        await import("@perspective-dev/viewer-d3fc");
        await import("@perspective-dev/viewer");
        await import("@perspective-dev/workspace");

        const perspective = (await import("@perspective-dev/client")).default;
        const viewer = await import("@perspective-dev/viewer");
        perspective.init_client(fetch("/perspective-js.wasm"));
        perspective.init_server(fetch("/perspective-server.wasm"));
        await viewer.init_client(fetch("/perspective-viewer.wasm"));
        const client = await perspective.worker();
        clientRef.current = client;
        if (cancelled) return;

        // Phase 2: Fetch schemas
        if (cancelled) return;
        setLoading((p) => ({ ...p, phase: "fetch-schemas" }));

        const { tables } = await fetchEnrichedTables();
        if (cancelled) return;

        // Phase 3: Load tables
        setLoading((p) => ({
          ...p,
          phase: "load-tables",
          tablesTotal: tables.length,
          tablesLoaded: 0,
        }));

        for (let i = 0; i < tables.length; i++) {
          const tableInfo = tables[i];
          if (cancelled) return;

          setLoading((p) => ({
            ...p,
            currentTable: tableInfo.name,
            tablesLoaded: i,
          }));

          // Build Perspective schema from enriched columns
          const schema: Record<string, string> = {};
          const colTypes = new Map<string, string>();
          for (const col of tableInfo.columns) {
            schema[col.name] = col.perspectiveType;
            colTypes.set(col.name, col.perspectiveType);
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await client.table(schema as any, { name: tableInfo.name });

          // Fetch data
          const rows = await fetchAllTableData(
            tableInfo.name,
            tableInfo.hasAsOfDate
          );

          // Coerce values to match Perspective schema types
          for (const row of rows) {
            for (const [key, val] of Object.entries(row)) {
              if (val == null) continue;
              const pType = colTypes.get(key);
              if (!pType) continue;
              switch (pType) {
                case "string":
                  if (typeof val !== "string") row[key] = String(val);
                  break;
                case "datetime":
                  row[key] = new Date(val as string | number);
                  break;
                case "integer":
                  if (typeof val === "string") row[key] = parseInt(val, 10);
                  break;
                case "float":
                  if (typeof val === "string") row[key] = parseFloat(val);
                  break;
                case "boolean":
                  if (typeof val !== "boolean") row[key] = Boolean(val);
                  break;
              }
            }
          }

          // Get table reference and update
          const tbl = await client.open_table(tableInfo.name);
          if (rows.length > 0) {
            await tbl.update(rows);
          }
        }

        setLoading((p) => ({
          ...p,
          tablesLoaded: tables.length,
        }));

        // Phase 4: Restore layout
        if (cancelled) return;
        setLoading((p) => ({ ...p, phase: "restore-layout" }));

        await customElements.whenDefined("perspective-workspace");
        const workspace = workspaceRef.current;
        if (!workspace) return;

        await workspace.load(client);

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            await workspace.restore(JSON.parse(saved));
          } catch {
            const layout = buildDefaultLayout(tables);
            await workspace.restore(layout);
          }
        } else {
          const layout = buildDefaultLayout(tables);
          await workspace.restore(layout);
        }

        workspace.addEventListener("workspace-layout-update", async () => {
          try {
            const state = await workspace.save();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          } catch {
            /* ignore */
          }
        });

        if (!cancelled) {
          setLoading((p) => ({ ...p, phase: "done" }));
        }
      } catch (err) {
        if (!cancelled) {
          setLoading((p) => ({
            ...p,
            error: err instanceof Error ? err.message : "Unknown error",
          }));
        }
      }
    }

    setup();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportLayout = useCallback(async () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const state = await workspace.save();
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workspace-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [workspaceRef]);

  const importLayout = useCallback(
    async (file: File) => {
      const text = await file.text();
      const workspace = workspaceRef.current;
      if (!workspace) return;
      const layout = JSON.parse(text);
      await workspace.restore(layout);
      localStorage.setItem(STORAGE_KEY, text);
    },
    [workspaceRef]
  );

  const resetLayout = useCallback(async () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    localStorage.removeItem(STORAGE_KEY);
    try {
      const { tables } = await fetchEnrichedTables();
      const layout = buildDefaultLayout(tables);
      await workspace.restore(layout);
    } catch {
      /* ignore - workspace will remain in current state */
    }
  }, [workspaceRef]);

  return {
    ready: loading.phase === "done",
    loading,
    exportLayout,
    importLayout,
    resetLayout,
  };
}

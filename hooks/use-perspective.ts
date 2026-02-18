"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { HTMLPerspectiveWorkspaceElement } from "@perspective-dev/workspace";

const STORAGE_KEY = "perspective-workspace-state";
const DEFAULT_LAYOUT_URL = "/dataset-layout.json";

type ColType = "float" | "integer" | "string" | "datetime" | "boolean";

export interface DataConfig {
  numRows: number;
  numBatches: number;
  batchDelay: number;
  numFloat: number;
  numInteger: number;
  numString: number;
  numStrings: number;
  numDatetime: number;
  numBoolean: number;
}

export const DEFAULT_CONFIG: DataConfig = {
  numRows: 100000,
  numBatches: 1000,
  batchDelay: 200,
  numFloat: 5,
  numInteger: 5,
  numString: 5,
  numStrings: 50,
  numDatetime: 5,
  numBoolean: 1,
};

const choose = <T,>(x: T[]): T => x[Math.floor(Math.random() * x.length)];
const range = (x: number, y: number) => Math.random() * (y - x) + x;
const randString = () => Math.random().toString(36).substring(7);
const colName = (type: string, idx: number) =>
  `${type.charAt(0).toUpperCase() + type.slice(1)} ${idx}`;

function buildSchema(cfg: DataConfig) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema: Record<string, any> = {};
  for (let i = 0; i < cfg.numFloat; i++) schema[`Float ${i}`] = "float";
  for (let i = 0; i < cfg.numInteger; i++) schema[`Integer ${i}`] = "integer";
  for (let i = 0; i < cfg.numString; i++) schema[`String ${i}`] = "string";
  for (let i = 0; i < cfg.numDatetime; i++)
    schema[`Datetime ${i}`] = "datetime";
  for (let i = 0; i < cfg.numBoolean; i++) schema[`Boolean ${i}`] = "boolean";
  return schema;
}

function buildColumns(cfg: DataConfig) {
  const columns: [ColType, number][] = [];
  for (let i = 0; i < cfg.numFloat; i++) columns.push(["float", i]);
  for (let i = 0; i < cfg.numInteger; i++) columns.push(["integer", i]);
  for (let i = 0; i < cfg.numString; i++) columns.push(["string", i]);
  for (let i = 0; i < cfg.numDatetime; i++) columns.push(["datetime", i]);
  for (let i = 0; i < cfg.numBoolean; i++) columns.push(["boolean", i]);
  return columns;
}

export function usePerspective(
  workspaceRef: React.RefObject<HTMLPerspectiveWorkspaceElement | null>
) {
  const [ready, setReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableRef = useRef<any>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load custom element definitions
  useEffect(() => {
    let cancelled = false;
    async function init() {
      await import("@perspective-dev/viewer-datagrid");
      await import("@perspective-dev/viewer-d3fc");
      await import("@perspective-dev/viewer");
      await import("@perspective-dev/workspace");
      if (!cancelled) setReady(true);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize client, tables, and workspace
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function setup() {
      const perspective = (await import("@perspective-dev/client")).default;
      const viewer = await import("@perspective-dev/viewer");
      perspective.init_client(fetch("/perspective-js.wasm"));
      perspective.init_server(fetch("/perspective-server.wasm"));
      await viewer.init_client(fetch("/perspective-viewer.wasm"));
      const client = await perspective.worker();
      clientRef.current = client;
      if (cancelled) return;

      // Stats table
      const statsTable = await client.table(
        {
          heap_size: "float",
          used_size: "float",
          cpu_time: "integer",
          cpu_time_epoch: "integer",
          version: "integer",
          timestamp: "datetime",
          client_used: "float",
          client_heap: "float",
        },
        { limit: 2000, name: "stats" }
      );

      const pollStats = async () => {
        if (cancelled) return;
        try {
          await statsTable.update([await client.system_info()]);
        } catch {
          /* ignore */
        }
        if (!cancelled) statsIntervalRef.current = setTimeout(pollStats, 200);
      };
      pollStats();

      // Data table
      const schema = buildSchema(DEFAULT_CONFIG);
      const tbl = await client.table(schema, { name: "superstore" });
      tableRef.current = tbl;

      // Workspace
      await customElements.whenDefined("perspective-workspace");
      const workspace = workspaceRef.current;
      if (!workspace) return;

      await workspace.load(client);

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          await workspace.restore(JSON.parse(saved));
        } catch {
          const layout = await fetch(DEFAULT_LAYOUT_URL).then((r) => r.json());
          await workspace.restore(layout);
        }
      } else {
        const layout = await fetch(DEFAULT_LAYOUT_URL).then((r) => r.json());
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

      if (!cancelled) pumpData(tbl, DEFAULT_CONFIG);
    }

    setup();
    return () => {
      cancelled = true;
      if (statsIntervalRef.current) clearTimeout(statsIntervalRef.current);
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function pumpData(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tbl: any,
    cfg: DataConfig
  ) {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);

    const columns = buildColumns(cfg);
    const stringCache: Record<number, string[]> = {};
    const getDict = (idx: number) => {
      if (!stringCache[idx]) {
        stringCache[idx] = Array.from({ length: cfg.numStrings }, () =>
          randString()
        );
      }
      return stringCache[idx];
    };

    const cellGenerators: Record<ColType, (idx: number) => unknown> = {
      float: () => range(-10, 10),
      integer: () => Math.floor(range(-10, 10)),
      string: (idx) => choose(getDict(idx)),
      datetime: () => new Date(),
      boolean: () => choose([true, false, null]),
    };

    const newRow = () => {
      const row: Record<string, unknown> = {};
      for (const [type, idx] of columns) {
        row[colName(type, idx)] = cellGenerators[type](idx);
      }
      return row;
    };

    let remaining = cfg.numRows;
    const batchSize = Math.max(1, Math.floor(cfg.numRows / cfg.numBatches));

    const generateBatch = () => {
      const rows = [];
      while (remaining > 0) {
        rows.push(newRow());
        remaining--;
        if (remaining > 0 && rows.length >= batchSize) {
          tbl.update(rows);
          batchTimerRef.current = setTimeout(generateBatch, cfg.batchDelay);
          return;
        }
      }
      if (rows.length > 0) tbl.update(rows);
    };
    generateBatch();
  }

  const generateData = useCallback(
    async (cfg: DataConfig) => {
      const tbl = tableRef.current;
      if (!tbl) return;
      await tbl.clear();
      pumpData(tbl, cfg);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const clearData = useCallback(async () => {
    const tbl = tableRef.current;
    if (!tbl) return;
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    await tbl.clear();
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
    const layout = await fetch(DEFAULT_LAYOUT_URL).then((r) => r.json());
    await workspace.restore(layout);
  }, [workspaceRef]);

  return {
    ready,
    generateData,
    clearData,
    exportLayout,
    importLayout,
    resetLayout,
  };
}

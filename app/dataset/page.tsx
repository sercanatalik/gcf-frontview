"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { HTMLPerspectiveWorkspaceElement } from "@perspective-dev/workspace";

const choose = <T,>(x: T[]): T => x[Math.floor(Math.random() * x.length)];
const range = (x: number, y: number) => Math.random() * (y - x) + x;
const randString = () => Math.random().toString(36).substring(7);

type ColType = "float" | "integer" | "string" | "datetime" | "boolean";

function buildSchema(cfg: {
  numFloat: number;
  numInteger: number;
  numString: number;
  numDatetime: number;
  numBoolean: number;
}) {
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

function buildColumns(cfg: {
  numFloat: number;
  numInteger: number;
  numString: number;
  numDatetime: number;
  numBoolean: number;
}) {
  const columns: [ColType, number][] = [];
  for (let i = 0; i < cfg.numFloat; i++) columns.push(["float", i]);
  for (let i = 0; i < cfg.numInteger; i++) columns.push(["integer", i]);
  for (let i = 0; i < cfg.numString; i++) columns.push(["string", i]);
  for (let i = 0; i < cfg.numDatetime; i++) columns.push(["datetime", i]);
  for (let i = 0; i < cfg.numBoolean; i++) columns.push(["boolean", i]);
  return columns;
}

const colName = (type: string, idx: number) =>
  `${type.charAt(0).toUpperCase() + type.slice(1)} ${idx}`;

export default function DatasetPage() {
  const workspaceRef = useRef<HTMLPerspectiveWorkspaceElement>(null);
  const [ready, setReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableRef = useRef<any>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [config, setConfig] = useState({
    numRows: 100000,
    numBatches: 1000,
    batchDelay: 200,
    numFloat: 5,
    numInteger: 5,
    numString: 5,
    numStrings: 50,
    numDatetime: 5,
    numBoolean: 1,
  });

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await import("@perspective-dev/viewer-datagrid");
      await import("@perspective-dev/viewer-d3fc");
      await import("@perspective-dev/viewer");
      await import("@perspective-dev/workspace");

      if (cancelled) return;
      setReady(true);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

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

      // Create stats table
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
        if (!cancelled) {
          statsIntervalRef.current = setTimeout(pollStats, 200);
        }
      };
      pollStats();

      // Create superstore table with default schema
      const schema = buildSchema({
        numFloat: 5,
        numInteger: 5,
        numString: 5,
        numDatetime: 5,
        numBoolean: 1,
      });
      const tbl = await client.table(schema, { name: "superstore" });
      tableRef.current = tbl;

      // Wait for custom element upgrade, then load workspace
      await customElements.whenDefined("perspective-workspace");
      const workspace = workspaceRef.current;
      if (!workspace) return;

      await workspace.load(client);
      const layout = await fetch("/dataset-layout.json").then((r) => r.json());
      await workspace.restore(layout);

      // Generate initial data into the table
      if (!cancelled) {
        pumpData(tbl, {
          numRows: 100000,
          numBatches: 1000,
          batchDelay: 200,
          numFloat: 5,
          numInteger: 5,
          numString: 5,
          numStrings: 50,
          numDatetime: 5,
          numBoolean: 1,
        });
      }
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
    cfg: typeof config
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
      if (rows.length > 0) {
        tbl.update(rows);
      }
    };
    generateBatch();
  }

  const generateData = useCallback(async () => {
    const tbl = tableRef.current;
    if (!tbl) return;

    // Clear existing data and pump new rows
    await tbl.clear();
    pumpData(tbl, config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const deleteData = useCallback(async () => {
    const tbl = tableRef.current;
    if (!tbl) return;
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    await tbl.clear();
  }, []);

  const updateConfig = (key: keyof typeof config, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: parseInt(value) || 0 }));
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#f2f4f6",
      }}
    >
      <div
        style={{
          display: "flex",
          padding: 12,
          gap: 12,
          fontFamily:
            'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        }}
      >
        <button onClick={generateData} style={buttonStyle}>
          Generate
        </button>
        <button onClick={deleteData} style={buttonStyle}>
          Delete
        </button>

        <ControlGroup>
          <ControlLabel>Rows</ControlLabel>
          <ControlInput
            value={config.numRows}
            min={25}
            max={1000000}
            onChange={(v) => updateConfig("numRows", v)}
          />
          <ControlLabel>Update batches</ControlLabel>
          <ControlInput
            value={config.numBatches}
            min={1}
            max={100}
            onChange={(v) => updateConfig("numBatches", v)}
          />
          <ControlLabel>Update delay (ms)</ControlLabel>
          <ControlInput
            value={config.batchDelay}
            min={100}
            max={10000}
            onChange={(v) => updateConfig("batchDelay", v)}
          />
        </ControlGroup>

        <ControlGroup>
          <ControlLabel>Float columns</ControlLabel>
          <ControlInput
            value={config.numFloat}
            min={0}
            max={50}
            onChange={(v) => updateConfig("numFloat", v)}
          />
        </ControlGroup>

        <ControlGroup>
          <ControlLabel>Integer columns</ControlLabel>
          <ControlInput
            value={config.numInteger}
            min={0}
            max={50}
            onChange={(v) => updateConfig("numInteger", v)}
          />
        </ControlGroup>

        <ControlGroup>
          <ControlLabel>String columns</ControlLabel>
          <ControlInput
            value={config.numString}
            min={0}
            max={50}
            onChange={(v) => updateConfig("numString", v)}
          />
          <ControlLabel>Dictionary size</ControlLabel>
          <ControlInput
            value={config.numStrings}
            min={1}
            max={500}
            onChange={(v) => updateConfig("numStrings", v)}
          />
        </ControlGroup>

        <ControlGroup>
          <ControlLabel>Datetime columns</ControlLabel>
          <ControlInput
            value={config.numDatetime}
            min={0}
            max={50}
            onChange={(v) => updateConfig("numDatetime", v)}
          />
        </ControlGroup>

        <ControlGroup>
          <ControlLabel>Bool columns</ControlLabel>
          <ControlInput
            value={config.numBoolean}
            min={0}
            max={50}
            onChange={(v) => updateConfig("numBoolean", v)}
          />
        </ControlGroup>
      </div>

      <perspective-workspace
        ref={workspaceRef}
        id="psp_workspace"
        style={{
          flex: 1,
          overflow: "hidden",
          border: "1px solid #666",
        }}
      />
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  fontFamily:
    'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  cursor: "pointer",
};

function ControlGroup({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {children}
    </div>
  );
}

function ControlLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 10 }}>{children}</span>;
}

function ControlInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontFamily:
          'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      }}
    />
  );
}

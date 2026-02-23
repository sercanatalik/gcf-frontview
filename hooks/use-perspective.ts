"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { HTMLPerspectiveWorkspaceElement } from "@perspective-dev/workspace";
import type { LoadingProgress, EnrichedTableInfo } from "@/lib/types";
import { fetchTables, fetchAllTableData } from "@/lib/api";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
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
  const [layouts, setLayouts] = useState<string[]>([]);
  const [activeLayout, setActiveLayout] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);
  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    let cancelled = false;

    // Suppress "View not found" from async Perspective internals
    // that fire during layout transitions (maximize/restore, filter
    // propagation, config-update handlers). These are benign WASM
    // errors on views that are momentarily absent while the dock
    // panel switches modes.
    const suppressViewNotFound = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? "";
      if (msg === "View not found") event.preventDefault();
    };
    window.addEventListener("unhandledrejection", suppressViewNotFound);

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
        perspective.init_client(fetch(`${BASE_PATH}/perspective-js.wasm`));
        perspective.init_server(fetch(`${BASE_PATH}/perspective-server.wasm`));
        await viewer.init_client(fetch(`${BASE_PATH}/perspective-viewer.wasm`));
        const client = await perspective.worker();
        clientRef.current = client;
        if (cancelled) return;

        // Phase 2: Fetch schemas
        if (cancelled) return;
        setLoading((p) => ({ ...p, phase: "fetch-schemas" }));

        const { tables } = await fetchTables();
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
          const rows = await fetchAllTableData(tableInfo.name, {
            asOfDate: tableInfo.hasAsOfDate ? "__latest__" : undefined,
          });

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

        // --- Perspective bug patches ---
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wsInternal = (workspace as any).workspace;
        if (wsInternal) {

          // Fix label crash: several commands use non-null assertions on
          // getWidgetByName() which returns null after a widget is closed.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cmdMap = (wsInternal.commands as any)?._commands as
            | Map<string, // eslint-disable-next-line @typescript-eslint/no-explicit-any
                any>
            | undefined;
          if (cmdMap) {
            const patchLabel = (id: string, fallback: string) => {
              const cmd = cmdMap.get(id);
              if (!cmd) return;
              const orig = cmd.label;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cmd.label = (...a: any[]) => {
                try {
                  return orig(...a);
                } catch {
                  return fallback;
                }
              };
            };
            patchLabel("workspace:master", "Global Filter");
            patchLabel("workspace:settings", "Settings");
            patchLabel("workspace:newview", "View");
          }

          // Add maximize/restore command + context menu item
          if (wsInternal.commands) {
            wsInternal.commands.addCommand("workspace:maximize", {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              execute: ({ widget_name }: any) => {
                const w = wsInternal.getWidgetByName(widget_name);
                if (w) wsInternal.toggleSingleDocument(w);
              },
              label: () =>
                wsInternal.dockpanel.mode === "single-document"
                  ? "Restore"
                  : "Maximize",
              mnemonic: 0,
            });

            const origCreateCtx =
              wsInternal.createContextMenu.bind(wsInternal);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            wsInternal.createContextMenu = (widget: any) => {
              const menu = origCreateCtx(widget);
              if (widget) {
                const widget_name = widget.viewer.getAttribute("slot");
                menu.insertItem(menu.items.length - 2, {
                  command: "workspace:maximize",
                  args: { widget_name },
                });
              }
              return menu;
            };
          }

          // Inject maximize button into each viewer's shadow DOM
          const MAXIMIZE_SVG =
            "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>'
            );
          const RESTORE_SVG =
            "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>'
            );

          function injectMaximizeButton(viewer: Element) {
            const shadow = viewer.shadowRoot;
            if (!shadow || shadow.querySelector("#maximize_button")) return;

            const settingsBtn = shadow.querySelector("#settings_button");
            if (!settingsBtn) return;

            // Add styles for the maximize button
            const style = document.createElement("style");
            style.textContent = `
              #maximize_button {
                background-color: var(--plugin--background);
                padding: 0;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                border: 1px solid var(--inactive--color);
                border-radius: 5px;
                font-size: 10px;
                font-weight: normal;
                cursor: pointer;
              }
              #maximize_button:hover {
                color: var(--plugin--background, inherit);
                background-color: var(--icon--color);
              }
              #maximize_button:hover:before {
                background-color: var(--plugin--background);
              }
              #maximize_button:before {
                content: "";
                display: inline-block;
                width: 20px;
                height: 20px;
                background-color: var(--icon--color);
                mask-size: cover;
                -webkit-mask-size: cover;
                background-repeat: no-repeat;
                -webkit-mask-image: var(--maximize-icon);
                mask-image: var(--maximize-icon);
              }
            `;
            shadow.appendChild(style);

            const maxBtn = document.createElement("div");
            maxBtn.id = "maximize_button";
            maxBtn.className = "noselect";
            const isMax =
              wsInternal.dockpanel.mode === "single-document";
            maxBtn.style.setProperty(
              "--maximize-icon",
              `url("${isMax ? RESTORE_SVG : MAXIMIZE_SVG}")`
            );
            const closeBtn = shadow.querySelector("#close_button");
            if (closeBtn) {
              closeBtn.before(maxBtn);
            } else {
              settingsBtn.after(maxBtn);
            }

            maxBtn.addEventListener("mousedown", (e) => {
              e.stopPropagation();
              e.preventDefault();
              const slotName = viewer.getAttribute("slot");
              const w = slotName
                ? wsInternal.getWidgetByName(slotName)
                : null;
              if (w) wsInternal.toggleSingleDocument(w);

              // Update all maximize button icons
              const nowMax =
                wsInternal.dockpanel.mode === "single-document";
              workspace!.querySelectorAll("perspective-viewer").forEach(
                (v: Element) => {
                  const btn = v.shadowRoot?.querySelector(
                    "#maximize_button"
                  ) as HTMLElement | null;
                  if (btn) {
                    btn.style.setProperty(
                      "--maximize-icon",
                      `url("${nowMax ? RESTORE_SVG : MAXIMIZE_SVG}")`
                    );
                  }
                }
              );
            });
          }

          // Inject into existing viewers
          workspace.querySelectorAll("perspective-viewer").forEach(
            (v: Element) => injectMaximizeButton(v)
          );

          // Observe for dynamically added viewers
          const maximizeObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
              for (const node of m.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (node.tagName === "PERSPECTIVE-VIEWER") {
                  injectMaximizeButton(node);
                }
                node
                  .querySelectorAll("perspective-viewer")
                  .forEach((v) => injectMaximizeButton(v));
              }
            }
          });
          maximizeObserver.observe(workspace, {
            childList: true,
            subtree: true,
          });
        }

        // Fetch available layouts
        try {
          const res = await fetch(`${BASE_PATH}/api/layouts`);
          const data = await res.json();
          if (data.layouts) {
            setLayouts(data.layouts.map((l: { name: string }) => l.name));
          }
        } catch {
          /* ignore — layouts list is optional */
        }

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
      window.removeEventListener("unhandledrejection", suppressViewNotFound);
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

  const switchLayout = useCallback(
    async (name: string) => {
      const workspace = workspaceRef.current;
      if (!workspace) return;
      try {
        const res = await fetch(`${BASE_PATH}/api/layouts/${encodeURIComponent(name)}`);
        if (!res.ok) return;
        const layout = await res.json();
        await workspace.restore(layout);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
        setActiveLayout(name);
      } catch {
        /* ignore */
      }
    },
    [workspaceRef]
  );

  const resetLayout = useCallback(async () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    localStorage.removeItem(STORAGE_KEY);
    try {
      const { tables } = await fetchTables();
      const layout = buildDefaultLayout(tables);
      await workspace.restore(layout);
    } catch {
      /* ignore - workspace will remain in current state */
    }
  }, [workspaceRef]);

  return {
    ready: loading.phase === "done",
    loading,
    layouts,
    activeLayout,
    switchLayout,
    exportLayout,
    importLayout,
    resetLayout,
  };
}

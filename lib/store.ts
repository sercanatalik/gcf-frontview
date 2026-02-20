import { useSyncExternalStore, useCallback } from "react";
import type { TableQueryParams } from "./types";

type Listener = () => void;

interface TableStore {
  activeTable: string | null;
  queryParams: Omit<TableQueryParams, "table">;
}

let state: TableStore = {
  activeTable: null,
  queryParams: { limit: 1000, offset: 0 },
};

const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): TableStore {
  return state;
}

function setActiveTable(table: string | null) {
  state = { ...state, activeTable: table, queryParams: { limit: 1000, offset: 0 } };
  emitChange();
}

function setQueryParams(params: Partial<Omit<TableQueryParams, "table">>) {
  state = { ...state, queryParams: { ...state.queryParams, ...params } };
  emitChange();
}

export function useTableStore() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...store,
    setActiveTable: useCallback(setActiveTable, []),
    setQueryParams: useCallback(setQueryParams, []),
    /** Resolved params ready for useTableData (null when no table selected) */
    resolvedParams: store.activeTable
      ? { table: store.activeTable, ...store.queryParams }
      : null,
  };
}

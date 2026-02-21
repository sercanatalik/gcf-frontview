import { useQuery } from "@tanstack/react-query";
import { fetchTables, fetchTableData } from "@/lib/api";
import type { TableQueryParams } from "@/lib/types";

export function useTables() {
  return useQuery({
    queryKey: ["tables"],
    queryFn: fetchTables,
    staleTime: 60_000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useTableData(params: TableQueryParams | null) {
  return useQuery({
    queryKey: ["table-data", params],
    queryFn: () => fetchTableData(params!),
    enabled: !!params?.table,
    staleTime: 30_000,
    refetchInterval: 5 * 60 * 1000,
  });
}

import { Terminal, CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import type { LoadingProgress, LoadingPhase } from "@/lib/types";

const PHASES: { key: LoadingPhase; label: string }[] = [
  { key: "init-wasm", label: "Initializing WASM runtime" },
  { key: "fetch-schemas", label: "Fetching table schemas" },
  { key: "load-tables", label: "Loading table data" },
  { key: "restore-layout", label: "Restoring workspace layout" },
];

const PHASE_ORDER: LoadingPhase[] = ["init-wasm", "fetch-schemas", "load-tables", "restore-layout", "done"];

function getPhaseStatus(phase: LoadingPhase, current: LoadingPhase): "done" | "active" | "pending" {
  const ci = PHASE_ORDER.indexOf(current);
  const pi = PHASE_ORDER.indexOf(phase);
  if (pi < ci) return "done";
  if (pi === ci) return "active";
  return "pending";
}

interface LoadingScreenProps {
  progress: LoadingProgress;
}

export function LoadingScreen({ progress }: LoadingScreenProps) {
  const progressPct =
    progress.tablesTotal > 0
      ? Math.round((progress.tablesLoaded / progress.tablesTotal) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "#1e1e1e" }}
    >
      <div className="w-full max-w-md px-6">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-8" style={{ color: "#33ff33" }}>
          <Terminal size={20} strokeWidth={2.5} />
          <span className="font-mono text-sm font-semibold tracking-wide">
            GCF Workspace
          </span>
        </div>

        {/* Phases */}
        <div className="space-y-3">
          {PHASES.map(({ key, label }) => {
            const status = getPhaseStatus(key, progress.phase);
            return (
              <div key={key} className="flex items-center gap-3 font-mono text-xs">
                {status === "done" && (
                  <CheckCircle2 size={14} style={{ color: "#33ff33" }} />
                )}
                {status === "active" && (
                  <Loader2
                    size={14}
                    className="animate-spin"
                    style={{ color: "#33ff33" }}
                  />
                )}
                {status === "pending" && (
                  <Circle size={14} style={{ color: "#555" }} />
                )}
                <span
                  style={{
                    color: status === "pending" ? "#555" : "#33ff33",
                  }}
                >
                  {label}
                  {key === "load-tables" && status === "active" && progress.currentTable && (
                    <span style={{ color: "#22aa22" }}>
                      {" "}({progress.tablesLoaded}/{progress.tablesTotal}) {progress.currentTable}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar for table loading */}
        {progress.phase === "load-tables" && progress.tablesTotal > 0 && (
          <div className="mt-5">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "#333" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  backgroundColor: "#33ff33",
                  width: `${progressPct}%`,
                }}
              />
            </div>
            <div
              className="font-mono text-[10px] mt-1.5 text-right"
              style={{ color: "#555" }}
            >
              {progressPct}%
            </div>
          </div>
        )}

        {/* Error */}
        {progress.error && (
          <div className="mt-5 flex items-start gap-2 font-mono text-xs" style={{ color: "#ff4444" }}>
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{progress.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

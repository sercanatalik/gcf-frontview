"use client";

import { useRef } from "react";
import type { HTMLPerspectiveWorkspaceElement } from "@perspective-dev/workspace";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { usePerspective } from "@/hooks/use-perspective";

export default function DatasetPage() {
  const workspaceRef = useRef<HTMLPerspectiveWorkspaceElement>(null);
  const { ready, exportLayout, importLayout, resetLayout } =
    usePerspective(workspaceRef);

  if (!ready) return null;

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
      <WorkspaceHeader
        onExport={exportLayout}
        onImport={importLayout}
        onReset={resetLayout}
      />

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

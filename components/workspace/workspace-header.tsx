import { useRef, ChangeEvent } from "react";
import { Download, Upload, RotateCcw, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkspaceHeaderProps {
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

export function WorkspaceHeader({
  onExport,
  onImport,
  onReset,
}: WorkspaceHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = "";
    }
  };

  return (
    <header className="flex items-center justify-between px-3 py-2 bg-[#1e1e1e] text-[#33ff33] font-mono text-[13px] font-semibold tracking-wide border-b-2 border-[#33ff33]">
      <div className="flex items-center gap-2.5">
        <Terminal size={16} strokeWidth={2.5} />
        <span>GCF Workspace</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onExport}
          title="Export layout"
          className="text-[#33ff33] hover:bg-[#33ff3322] hover:text-[#33ff33]"
        >
          <Download size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => fileInputRef.current?.click()}
          title="Import layout"
          className="text-[#33ff33] hover:bg-[#33ff3322] hover:text-[#33ff33]"
        >
          <Upload size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onReset}
          title="Reset layout"
          className="text-[#33ff33] hover:bg-[#33ff3322] hover:text-[#33ff33]"
        >
          <RotateCcw size={14} />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </header>
  );
}

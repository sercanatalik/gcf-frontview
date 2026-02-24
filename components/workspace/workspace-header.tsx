import { useRef, ChangeEvent } from "react";
import { Download, Upload, RotateCcw, LayoutGrid, EllipsisVertical, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WorkspaceHeaderProps {
  layouts: string[];
  activeLayout: string;
  onSwitchLayout: (name: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
  chatOpen: boolean;
  onChatToggle: () => void;
}

export function WorkspaceHeader({
  layouts,
  activeLayout,
  onSwitchLayout,
  onExport,
  onImport,
  onReset,
  chatOpen,
  onChatToggle,
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
    <header className="flex h-8 items-center gap-2 border-b bg-background px-2">
      <span className="text-xs font-semibold tracking-tight text-foreground">
        GCF Frontview
      </span>

      <Separator orientation="vertical" className="!h-3.5" />

      {layouts.length > 0 && (
        <Select value={activeLayout} onValueChange={onSwitchLayout}>
          <SelectTrigger size="sm" className="h-5 min-w-24 text-[11px]">
            <LayoutGrid className="size-3 text-muted-foreground" />
            <SelectValue placeholder="Layout" />
          </SelectTrigger>
          <SelectContent>
            {layouts.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onChatToggle}
        aria-label="Toggle AI Chat"
        className={chatOpen ? "bg-muted" : ""}
      >
        <MessageSquare className="size-3.5" />
      </Button>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs">
            <EllipsisVertical className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onExport}>
            <Download />
            Export layout
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
            <Upload />
            Import layout
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onReset}>
            <RotateCcw />
            Reset layout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </header>
  );
}

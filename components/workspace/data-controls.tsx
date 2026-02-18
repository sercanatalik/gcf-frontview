import { Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DataConfig } from "@/hooks/use-perspective";

interface DataControlsProps {
  config: DataConfig;
  onConfigChange: (key: keyof DataConfig, value: number) => void;
  onGenerate: () => void;
  onClear: () => void;
}

export function DataControls({
  config,
  onConfigChange,
  onGenerate,
  onClear,
}: DataControlsProps) {
  const handleChange = (key: keyof DataConfig, raw: string) => {
    onConfigChange(key, parseInt(raw) || 0);
  };

  return (
    <div className="flex items-start gap-3 p-3 font-mono">
      <Button variant="outline" size="icon" onClick={onGenerate} title="Generate data">
        <Play size={14} />
      </Button>
      <Button variant="outline" size="icon" onClick={onClear} title="Clear data">
        <Trash2 size={14} />
      </Button>

      <FieldGroup>
        <Field label="Rows">
          <Input
            type="number"
            value={config.numRows}
            min={25}
            max={1000000}
            onChange={(e) => handleChange("numRows", e.target.value)}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Update batches">
          <Input
            type="number"
            value={config.numBatches}
            min={1}
            max={100}
            onChange={(e) => handleChange("numBatches", e.target.value)}
            className="w-20 font-mono"
          />
        </Field>
        <Field label="Update delay (ms)">
          <Input
            type="number"
            value={config.batchDelay}
            min={100}
            max={10000}
            onChange={(e) => handleChange("batchDelay", e.target.value)}
            className="w-20 font-mono"
          />
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field label="Float columns">
          <Input
            type="number"
            value={config.numFloat}
            min={0}
            max={50}
            onChange={(e) => handleChange("numFloat", e.target.value)}
            className="w-16 font-mono"
          />
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field label="Integer columns">
          <Input
            type="number"
            value={config.numInteger}
            min={0}
            max={50}
            onChange={(e) => handleChange("numInteger", e.target.value)}
            className="w-16 font-mono"
          />
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field label="String columns">
          <Input
            type="number"
            value={config.numString}
            min={0}
            max={50}
            onChange={(e) => handleChange("numString", e.target.value)}
            className="w-16 font-mono"
          />
        </Field>
        <Field label="Dictionary size">
          <Input
            type="number"
            value={config.numStrings}
            min={1}
            max={500}
            onChange={(e) => handleChange("numStrings", e.target.value)}
            className="w-16 font-mono"
          />
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field label="Datetime columns">
          <Input
            type="number"
            value={config.numDatetime}
            min={0}
            max={50}
            onChange={(e) => handleChange("numDatetime", e.target.value)}
            className="w-16 font-mono"
          />
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field label="Bool columns">
          <Input
            type="number"
            value={config.numBoolean}
            min={0}
            max={50}
            onChange={(e) => handleChange("numBoolean", e.target.value)}
            className="w-16 font-mono"
          />
        </Field>
      </FieldGroup>
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex flex-col gap-1.5">{children}</div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

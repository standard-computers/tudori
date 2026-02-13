import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalculatedColumn } from "./types";
import { entities } from "./entities";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CalculatedColumnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: CalculatedColumn[];
  onSave: (columns: CalculatedColumn[]) => void;
  activeEntities: string[];
}

export const CalculatedColumnsDialog = ({
  open,
  onOpenChange,
  columns,
  onSave,
  activeEntities,
}: CalculatedColumnsDialogProps) => {
  const [localColumns, setLocalColumns] = useState<CalculatedColumn[]>(columns);

  const handleAdd = () => {
    setLocalColumns([
      ...localColumns,
      {
        id: crypto.randomUUID(),
        name: `calc_${localColumns.length + 1}`,
        expression: "",
        resultType: "number",
      },
    ]);
  };

  const handleRemove = (id: string) => {
    setLocalColumns(localColumns.filter((c) => c.id !== id));
  };

  const handleUpdate = (id: string, updates: Partial<CalculatedColumn>) => {
    setLocalColumns(localColumns.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleSave = () => {
    onSave(localColumns.filter((c) => c.name && c.expression));
    onOpenChange(false);
  };

  // Get available fields for reference
  const availableFields = activeEntities.flatMap((entityName) => {
    const entity = entities.find((e) => e.name === entityName);
    if (!entity) return [];
    return entity.fields
      .filter((f) => f.type === "number")
      .map((f) => ({
        ref: `${entity.table}.${f.key}`,
        label: `${entityName} → ${f.label}`,
      }));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculated Columns
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {availableFields.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Available numeric fields:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {availableFields.map((f) => (
                  <Badge key={f.ref} variant="outline" className="text-xs font-mono">
                    {f.ref}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {localColumns.map((col) => (
            <div key={col.id} className="space-y-2 p-3 border rounded-md">
              <div className="flex items-center gap-2">
                <Input
                  value={col.name}
                  onChange={(e) => handleUpdate(col.id, { name: e.target.value })}
                  placeholder="Column name"
                  className="h-8 text-sm flex-1"
                />
                <Select
                  value={col.resultType}
                  onValueChange={(v) => handleUpdate(col.id, { resultType: v as CalculatedColumn["resultType"] })}
                >
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="string">Text</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemove(col.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={col.expression}
                onChange={(e) => handleUpdate(col.id, { expression: e.target.value })}
                placeholder="e.g. products.price - products.cost"
                className="h-8 text-sm font-mono"
              />
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={handleAdd} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Calculated Column
          </Button>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

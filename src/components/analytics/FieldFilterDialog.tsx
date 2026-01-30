import { useState, useEffect } from "react";
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
import { ReportField, FieldFilter, EntityField } from "./types";
import { Trash2 } from "lucide-react";

interface FieldFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: ReportField | null;
  onSave: (filter: FieldFilter | undefined) => void;
}

const getOperatorsForType = (type: EntityField["type"]) => {
  const common = [
    { value: "eq", label: "Equals" },
    { value: "neq", label: "Not equals" },
    { value: "is_null", label: "Is empty" },
    { value: "not_null", label: "Is not empty" },
  ];

  switch (type) {
    case "number":
      return [
        ...common,
        { value: "gt", label: "Greater than" },
        { value: "gte", label: "Greater than or equal" },
        { value: "lt", label: "Less than" },
        { value: "lte", label: "Less than or equal" },
      ];
    case "string":
      return [
        ...common,
        { value: "like", label: "Contains (case-sensitive)" },
        { value: "ilike", label: "Contains" },
      ];
    case "date":
      return [
        ...common,
        { value: "gt", label: "After" },
        { value: "gte", label: "On or after" },
        { value: "lt", label: "Before" },
        { value: "lte", label: "On or before" },
      ];
    case "boolean":
      return [
        { value: "eq", label: "Equals" },
        { value: "is_null", label: "Is empty" },
        { value: "not_null", label: "Is not empty" },
      ];
    default:
      return common;
  }
};

export const FieldFilterDialog = ({
  open,
  onOpenChange,
  field,
  onSave,
}: FieldFilterDialogProps) => {
  const [operator, setOperator] = useState<FieldFilter["operator"]>("eq");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (field?.filter) {
      setOperator(field.filter.operator);
      setValue(field.filter.value);
    } else {
      setOperator("eq");
      setValue("");
    }
  }, [field]);

  if (!field) return null;

  const operators = getOperatorsForType(field.fieldType);
  const needsValue = !["is_null", "not_null"].includes(operator);

  const handleSave = () => {
    if (needsValue && !value.trim()) {
      onSave(undefined);
    } else {
      onSave({
        fieldKey: field.fieldKey,
        operator,
        value: needsValue ? value : "",
      });
    }
    onOpenChange(false);
  };

  const handleRemoveFilter = () => {
    onSave(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Filter: {field.fieldLabel}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label>Condition</Label>
            <Select value={operator} onValueChange={(v) => setOperator(v as FieldFilter["operator"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsValue && (
            <div className="space-y-2">
              <Label>Value</Label>
              {field.fieldType === "boolean" ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select value..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              ) : field.fieldType === "date" ? (
                <Input
                  type="date"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              ) : (
                <Input
                  type={field.fieldType === "number" ? "number" : "text"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={`Enter ${field.fieldLabel.toLowerCase()}...`}
                />
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {field.filter && (
            <Button variant="destructive" onClick={handleRemoveFilter} className="mr-auto">
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Filter
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

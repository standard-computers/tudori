import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ReportField, AggregateFunction } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, GripVertical, Filter, Hash, Calendar, ToggleLeft, Type } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportBuilderDropZoneProps {
  fields: ReportField[];
  onRemoveField: (id: string) => void;
  onFieldClick: (field: ReportField) => void;
  onAggregateChange: (fieldId: string, aggregate: AggregateFunction) => void;
}

const getFieldIcon = (type: ReportField["fieldType"]) => {
  switch (type) {
    case "number":
      return Hash;
    case "date":
      return Calendar;
    case "boolean":
      return ToggleLeft;
    default:
      return Type;
  }
};

const aggregateOptions: { value: AggregateFunction; label: string }[] = [
  { value: "none", label: "Raw" },
  { value: "count", label: "COUNT" },
  { value: "count_distinct", label: "COUNT DISTINCT" },
  { value: "sum", label: "SUM" },
  { value: "avg", label: "AVG" },
  { value: "min", label: "MIN" },
  { value: "max", label: "MAX" },
];

const getAggregateOptionsForType = (type: ReportField["fieldType"]) => {
  if (type === "number") return aggregateOptions;
  if (type === "date") return aggregateOptions.filter(o => ["none", "count", "count_distinct", "min", "max"].includes(o.value));
  return aggregateOptions.filter(o => ["none", "count", "count_distinct"].includes(o.value));
};

const SortableField = ({
  field,
  onRemove,
  onClick,
  onAggregateChange,
}: {
  field: ReportField;
  onRemove: () => void;
  onClick: () => void;
  onAggregateChange: (aggregate: AggregateFunction) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = getFieldIcon(field.fieldType);
  const aggOptions = getAggregateOptionsForType(field.fieldType);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 bg-background border rounded-md group",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <button
        onClick={onClick}
        className="flex-1 text-left text-sm hover:text-primary transition-colors min-w-0"
      >
        <span className="font-medium truncate">{field.fieldLabel}</span>
        <span className="text-muted-foreground ml-1 text-xs">({field.entityName})</span>
      </button>
      {aggOptions.length > 1 && (
        <Select
          value={field.aggregate || "none"}
          onValueChange={(v) => onAggregateChange(v as AggregateFunction)}
        >
          <SelectTrigger className="h-7 w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {aggOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field.filter && (
        <Badge variant="secondary" className="text-xs">
          <Filter className="h-3 w-3 mr-1" />
          Filtered
        </Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};

export const ReportBuilderDropZone = ({
  fields,
  onRemoveField,
  onFieldClick,
  onAggregateChange,
}: ReportBuilderDropZoneProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "report-drop-zone",
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[200px] rounded-lg border-2 border-dashed p-4 transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        fields.length === 0 && "flex items-center justify-center"
      )}
    >
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center">
          Drag fields from any data object to build your report. Related tables are joined automatically.
        </p>
      ) : (
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {fields.map((field) => (
              <SortableField
                key={field.id}
                field={field}
                onRemove={() => onRemoveField(field.id)}
                onClick={() => onFieldClick(field)}
                onAggregateChange={(agg) => onAggregateChange(field.id, agg)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};

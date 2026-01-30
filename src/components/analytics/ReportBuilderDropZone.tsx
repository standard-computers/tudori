import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ReportField } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, GripVertical, Filter, Hash, Calendar, ToggleLeft, Type } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportBuilderDropZoneProps {
  fields: ReportField[];
  onRemoveField: (id: string) => void;
  onFieldClick: (field: ReportField) => void;
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

const SortableField = ({
  field,
  onRemove,
  onClick,
}: {
  field: ReportField;
  onRemove: () => void;
  onClick: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = getFieldIcon(field.fieldType);

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
        className="flex-1 text-left text-sm hover:text-primary transition-colors"
      >
        <span className="font-medium">{field.fieldLabel}</span>
        <span className="text-muted-foreground ml-1">({field.entityName})</span>
      </button>
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
          Drag fields from the sidebar here to build your report
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
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};

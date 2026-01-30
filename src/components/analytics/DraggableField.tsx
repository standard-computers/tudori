import { useDraggable } from "@dnd-kit/core";
import { EntityField } from "./types";
import { Hash, Calendar, ToggleLeft, Type, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableFieldProps {
  entityName: string;
  field: EntityField;
  isSelected: boolean;
}

const getFieldIcon = (type: EntityField["type"]) => {
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

export const DraggableField = ({ entityName, field, isSelected }: DraggableFieldProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${entityName}-${field.key}`,
    data: {
      entityName,
      field,
    },
  });

  const Icon = getFieldIcon(field.type);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-grab active:cursor-grabbing",
        "hover:bg-accent/50 transition-colors",
        isDragging && "opacity-50",
        isSelected && "bg-primary/10 text-primary"
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/50" />
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{field.label}</span>
    </div>
  );
};

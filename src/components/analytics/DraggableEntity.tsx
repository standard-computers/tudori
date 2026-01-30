import { useDraggable } from "@dnd-kit/core";
import { EntityConfig } from "./types";
import { Folder, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableEntityProps {
  entity: EntityConfig;
}

export const DraggableEntity = ({ entity }: DraggableEntityProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entity-${entity.name}`,
    data: {
      isEntity: true,
      entity,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-sm">{entity.name}</span>
    </div>
  );
};

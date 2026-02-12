import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { supabase } from '@/integrations/supabase/client';
import { generatePUNumber } from '@/lib/packaging-units';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Plus, GripVertical, Undo2, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  pu_id: string | null;
  uom_id: string | null;
  product?: {
    name: string;
    product_id: string;
    unit?: string | null;
  };
  packaging_unit?: { pu_number: string } | null;
  uom?: { id: string; name: string; abbreviation: string | null; conversion_factor?: number } | null;
}

interface PackingTabProps {
  deliveryItems: DeliveryItem[];
  companyId: string;
  deliveryId: string;
  onRefreshItems: () => void;
}

// ─── Draggable item card ───────────────────────────────────────────────
function DraggableItem({ item, overlay }: { item: DeliveryItem; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });

  const uomLabel = item.uom?.abbreviation || item.uom?.name || item.product?.unit || 'EA';

  if (overlay) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary bg-card p-2 shadow-lg text-sm w-64">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0 truncate">
          <span className="font-medium">{item.product?.name || 'Unknown'}</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
          {item.quantity} {uomLabel}
        </span>
      </div>
    );
  }

  // Apply inline transform so the original element follows the pointer (prevents offset)
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 50 : undefined }
    : {};

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`flex items-center gap-2 rounded-md border bg-card p-2 text-sm cursor-grab active:cursor-grabbing transition-opacity ${isDragging ? 'opacity-30' : 'hover:border-primary/50'}`}
    >
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.product?.name || 'Unknown'}</div>
        <div className="text-xs text-muted-foreground font-mono">{item.product?.product_id}</div>
      </div>
      <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
        {item.quantity} {uomLabel}
      </span>
    </div>
  );
}

// ─── Droppable package zone ────────────────────────────────────────────
function DroppablePackage({
  puId,
  puNumber,
  items,
  onUnpack,
  onDelete,
}: {
  puId: string;
  puNumber: string;
  items: DeliveryItem[];
  onUnpack: (itemId: string) => void;
  onDelete: (puId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `package-${puId}` });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-3 transition-colors ${isOver ? 'border-primary bg-primary/5' : 'border-border'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Package className="w-4 h-4 text-primary" />
        <span className="font-mono text-sm font-semibold text-primary">{puNumber}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
        {items.length === 0 && (
          <button
            type="button"
            onClick={() => onDelete(puId)}
            className="text-muted-foreground hover:text-destructive transition-colors ml-1"
            title="Delete empty package"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Drop items here
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            const uomLabel = item.uom?.abbreviation || item.uom?.name || item.product?.unit || 'EA';
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded border bg-muted/50 px-2 py-1.5 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block">{item.product?.name || 'Unknown'}</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {item.quantity} {uomLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onUnpack(item.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Unpack"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main PackingTab component ─────────────────────────────────────────
export function PackingTab({ deliveryItems, companyId, deliveryId, onRefreshItems }: PackingTabProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [emptyPackages, setEmptyPackages] = useState<Array<{ id: string; pu_number: string }>>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Fetch packaging units that exist for this delivery's company but have no items assigned
  const fetchEmptyPackages = useCallback(async () => {
    const usedPuIds = deliveryItems.filter((i) => i.pu_id).map((i) => i.pu_id!);

    const { data } = await supabase
      .from('packaging_units' as any)
      .select('id, pu_number')
      .eq('company_id', companyId)
      .eq('delivery_id', deliveryId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (data) {
      const empty = (data as unknown as Array<{ id: string; pu_number: string }>)
        .filter((pu) => !usedPuIds.includes(pu.id));
      setEmptyPackages(empty);
    }
  }, [companyId, deliveryId, deliveryItems]);

  useEffect(() => {
    fetchEmptyPackages();
  }, [fetchEmptyPackages]);

  // Separate unpacked items and grouped packages
  const { unpackedItems, packages } = useMemo(() => {
    const unpacked: DeliveryItem[] = [];
    const pkgMap = new Map<string, { puNumber: string; items: DeliveryItem[] }>();

    for (const item of deliveryItems) {
      if (!item.pu_id) {
        unpacked.push(item);
      } else {
        const existing = pkgMap.get(item.pu_id);
        if (existing) {
          existing.items.push(item);
        } else {
          pkgMap.set(item.pu_id, {
            puNumber: item.packaging_unit?.pu_number || item.pu_id.slice(0, 8),
            items: [item],
          });
        }
      }
    }

    for (const ep of emptyPackages) {
      if (!pkgMap.has(ep.id)) {
        pkgMap.set(ep.id, { puNumber: ep.pu_number, items: [] });
      }
    }

    return {
      unpackedItems: unpacked,
      packages: Array.from(pkgMap.entries()).map(([id, data]) => ({ id, ...data })),
    };
  }, [deliveryItems, emptyPackages]);

  const activeItem = activeId ? deliveryItems.find((i) => i.id === activeId) : null;

  // ─── Create new package ───────────────────────────────────────────
  const handleAddPackage = async () => {
    setIsCreating(true);
    try {
      const puNumber = await generatePUNumber(companyId);
      if (!puNumber) {
        toast.error('Failed to generate PU number');
        return;
      }

      const { error } = await supabase
        .from('packaging_units' as any)
        .insert({
          pu_number: puNumber,
          company_id: companyId,
          delivery_id: deliveryId,
          product_id: null,
          quantity: 0,
          status: 'active',
        });

      if (error) {
        toast.error('Failed to create package');
        return;
      }

      toast.success(`Package ${puNumber} created`);
      fetchEmptyPackages();
      onRefreshItems();
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Delete empty package ─────────────────────────────────────────
  const handleDeletePackage = async (puId: string) => {
    const { error } = await supabase
      .from('packaging_units' as any)
      .delete()
      .eq('id', puId);

    if (error) {
      toast.error('Failed to delete package');
      return;
    }

    toast.success('Package deleted');
    setEmptyPackages((prev) => prev.filter((p) => p.id !== puId));
    onRefreshItems();
  };

  // ─── Assign / unassign item to package ────────────────────────────
  const assignItemToPackage = async (itemId: string, puId: string | null) => {
    const { error } = await supabase
      .from('delivery_items')
      .update({ pu_id: puId })
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to update packing');
      return;
    }

    onRefreshItems();
  };

  // ─── DnD handlers ────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    const overId = over.id as string;

    if (overId === 'unpacked-zone') {
      assignItemToPackage(itemId, null);
    } else if (overId.startsWith('package-')) {
      const puId = overId.replace('package-', '');
      const item = deliveryItems.find((i) => i.id === itemId);
      if (item?.pu_id !== puId) {
        assignItemToPackage(itemId, puId);
      }
    }
  };

  // Droppable for the unpacked zone
  const { setNodeRef: setUnpackedRef, isOver: isOverUnpacked } = useDroppable({
    id: 'unpacked-zone',
  });

  if (deliveryItems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
        Add items first to configure packing
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-2 gap-4 h-full">
        {/* ─── Left: Unpacked Items ───────────────────────────────────── */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-foreground">
              Unpacked Items
              {unpackedItems.length > 0 && (
                <span className="ml-1.5 text-muted-foreground font-normal">({unpackedItems.length})</span>
              )}
            </h4>
          </div>

          <div
            ref={setUnpackedRef}
            className={`flex-1 min-h-[120px] rounded-lg border-2 border-dashed p-2 transition-colors ${isOverUnpacked ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <ScrollArea className="h-full max-h-[340px]">
              {unpackedItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  All items are packed
                </p>
              ) : (
                <div className="space-y-1.5 pr-2">
                  {unpackedItems.map((item) => (
                    <DraggableItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* ─── Right: Packages ────────────────────────────────────────── */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-foreground">
              Packages
              {packages.length > 0 && (
                <span className="ml-1.5 text-muted-foreground font-normal">({packages.length})</span>
              )}
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddPackage}
              disabled={isCreating}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Package
            </Button>
          </div>

          <ScrollArea className="flex-1 max-h-[340px]">
            {packages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
                <Package className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No packages yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a package, then drag items to pack them
                </p>
              </div>
            ) : (
              <div className="space-y-3 pr-2">
                {packages.map((pkg) => (
                  <DroppablePackage
                    key={pkg.id}
                    puId={pkg.id}
                    puNumber={pkg.puNumber}
                    items={pkg.items}
                    onUnpack={(itemId) => assignItemToPackage(itemId, null)}
                    onDelete={handleDeletePackage}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* ─── Drag overlay ────────────────────────────────────────────── */}
      <DragOverlay dropAnimation={null}>
        {activeItem ? <DraggableItem item={activeItem} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

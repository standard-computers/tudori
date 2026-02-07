import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Area {
  id: string;
  area_id: string;
  name: string;
}

interface Bin {
  id: string;
  bin_id: string;
  name: string;
  area_id: string;
}

interface AreaWithBins extends Area {
  bins: Bin[];
}

interface AreaBinSelectorProps {
  locationId: string;
  selectedBinIds: Set<string>;
  onSelectionChange: (binIds: Set<string>) => void;
  includeUnbinned: boolean;
  onIncludeUnbinnedChange: (value: boolean) => void;
}

export const AreaBinSelector = ({
  locationId,
  selectedBinIds,
  onSelectionChange,
  includeUnbinned,
  onIncludeUnbinnedChange,
}: AreaBinSelectorProps) => {
  const [areas, setAreas] = useState<AreaWithBins[]>([]);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const fetchAreasAndBins = useCallback(async () => {
    if (!locationId) return;
    setIsLoading(true);

    const [areasRes, binsRes] = await Promise.all([
      supabase
        .from('areas')
        .select('id, area_id, name')
        .eq('location_id', locationId)
        .order('name'),
      supabase
        .from('bins')
        .select('id, bin_id, name, area_id, area:areas!inner(location_id)')
        .eq('area.location_id', locationId)
        .order('name'),
    ]);

    setIsLoading(false);

    const areasData = (areasRes.data || []) as Area[];
    const binsData = ((binsRes.data || []) as unknown as (Bin & { area: { location_id: string } })[]).map(
      ({ area, ...bin }) => bin
    );

    const areasWithBins: AreaWithBins[] = areasData.map((a) => ({
      ...a,
      bins: binsData.filter((b) => b.area_id === a.id),
    }));

    setAreas(areasWithBins);

    // Default: select all bins
    const allBinIds = new Set(binsData.map((b) => b.id));
    onSelectionChange(allBinIds);
  }, [locationId]);

  useEffect(() => {
    fetchAreasAndBins();
  }, [fetchAreasAndBins]);

  const toggleArea = (areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const isAreaFullySelected = (area: AreaWithBins) =>
    area.bins.length > 0 && area.bins.every((b) => selectedBinIds.has(b.id));

  const isAreaPartiallySelected = (area: AreaWithBins) =>
    area.bins.some((b) => selectedBinIds.has(b.id)) && !isAreaFullySelected(area);

  const handleAreaToggle = (area: AreaWithBins) => {
    const next = new Set(selectedBinIds);
    if (isAreaFullySelected(area)) {
      area.bins.forEach((b) => next.delete(b.id));
    } else {
      area.bins.forEach((b) => next.add(b.id));
    }
    onSelectionChange(next);
  };

  const handleBinToggle = (binId: string) => {
    const next = new Set(selectedBinIds);
    if (next.has(binId)) next.delete(binId);
    else next.add(binId);
    onSelectionChange(next);
  };

  const handleSelectAll = () => {
    const allBinIds = new Set(areas.flatMap((a) => a.bins.map((b) => b.id)));
    onSelectionChange(allBinIds);
    onIncludeUnbinnedChange(true);
  };

  const handleDeselectAll = () => {
    onSelectionChange(new Set());
    onIncludeUnbinnedChange(false);
  };

  const totalBins = areas.reduce((sum, a) => sum + a.bins.length, 0);
  const selectedCount = selectedBinIds.size + (includeUnbinned ? 1 : 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {selectedBinIds.size} of {totalBins} bin{totalBins !== 1 ? 's' : ''} selected
          {includeUnbinned && ' + unbinned items'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDeselectAll}>
            Deselect All
          </Button>
        </div>
      </div>

      <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
        {/* Unbinned inventory option */}
        <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50">
          <Checkbox
            checked={includeUnbinned}
            onCheckedChange={() => onIncludeUnbinnedChange(!includeUnbinned)}
          />
          <span className="text-sm text-muted-foreground italic">Unbinned inventory</span>
        </div>

        {areas.map((area) => (
          <div key={area.id}>
            {/* Area row */}
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50">
              <button
                type="button"
                className="p-0.5 rounded hover:bg-muted"
                onClick={() => toggleArea(area.id)}
              >
                {expandedAreas.has(area.id) ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <Checkbox
                checked={isAreaFullySelected(area)}
                // @ts-ignore - indeterminate is valid for radix checkbox
                data-state={isAreaPartiallySelected(area) ? 'indeterminate' : undefined}
                onCheckedChange={() => handleAreaToggle(area)}
              />
              <span className="text-sm font-medium">{area.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {area.bins.length} bin{area.bins.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Bin rows */}
            {expandedAreas.has(area.id) && (
              <div className="bg-muted/30">
                {area.bins.length === 0 ? (
                  <div className="pl-12 pr-3 py-1.5 text-xs text-muted-foreground italic">
                    No bins in this area
                  </div>
                ) : (
                  area.bins.map((bin) => (
                    <div
                      key={bin.id}
                      className="flex items-center gap-2 pl-12 pr-3 py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedBinIds.has(bin.id)}
                        onCheckedChange={() => handleBinToggle(bin.id)}
                      />
                      <span className="text-sm">{bin.name}</span>
                      <span className="text-xs text-muted-foreground font-mono ml-auto">
                        {bin.bin_id}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}

        {areas.length === 0 && (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            No areas configured for this location
          </div>
        )}
      </div>
    </div>
  );
};

export type { AreaBinSelectorProps };

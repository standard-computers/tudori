import { useState, useEffect, useMemo } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Kbd } from '@/components/ui/kbd';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Wand2, Loader2, MapPin, Search, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface Location {
  id: string;
  name: string;
  location_id: string;
}

interface AutoMakeLedgersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  companyId: string | null;
  onCreated: () => void;
}

interface PreviewItem {
  ledger_id: string;
  name: string;
  location_id: string;
  location_name: string;
}

export const AutoMakeLedgersDialog = ({
  open,
  onOpenChange,
  locations,
  companyId,
  onCreated,
}: AutoMakeLedgersDialogProps) => {
  const [activeTab, setActiveTab] = useState('general');
  const [isCreating, setIsCreating] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();

  // General settings
  const [ledgerIdTemplate, setLedgerIdTemplate] = useState('@-LDGR');
  const [ledgerNameTemplate, setLedgerNameTemplate] = useState('$ Ledger');
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());
  const [locationSearch, setLocationSearch] = useState('');

  useEffect(() => {
    if (open) {
      setActiveTab('general');
      setLedgerIdTemplate('@-LDGR');
      setLedgerNameTemplate('$ Ledger');
      setSelectedLocationIds(new Set());
      setLocationSearch('');
      setIsMaximized(false);
    }
  }, [open]);

  const applyTemplate = (template: string, locationCode: string, locationName: string): string => {
    return template
      .replace(/@/g, locationCode)
      .replace(/\$/g, locationName);
  };

  const filteredLocations = useMemo(() => {
    if (!locationSearch.trim()) return locations;
    const q = locationSearch.toLowerCase();
    return locations.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.location_id.toLowerCase().includes(q)
    );
  }, [locations, locationSearch]);

  const toggleLocation = (locationId: string) => {
    setSelectedLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  };

  const toggleAllLocations = (checked: boolean) => {
    if (checked) {
      setSelectedLocationIds(new Set(filteredLocations.map((l) => l.id)));
    } else {
      setSelectedLocationIds(new Set());
    }
  };

  const selectedLocations = useMemo(
    () => locations.filter((l) => selectedLocationIds.has(l.id)),
    [locations, selectedLocationIds]
  );

  const previewItems: PreviewItem[] = useMemo(() => {
    return selectedLocations.slice(0, 5).map((loc) => ({
      ledger_id: applyTemplate(ledgerIdTemplate, loc.location_id, loc.name),
      name: applyTemplate(ledgerNameTemplate, loc.location_id, loc.name),
      location_id: loc.location_id,
      location_name: loc.name,
    }));
  }, [selectedLocations, ledgerIdTemplate, ledgerNameTemplate]);

  const handleCreate = async () => {
    if (selectedLocations.length === 0) {
      toast.error('Please select at least one location');
      return;
    }

    if (!companyId) return;

    setIsCreating(true);

    try {
      const ledgersToCreate = selectedLocations.map((loc) => ({
        company_id: companyId,
        ledger_id: applyTemplate(ledgerIdTemplate, loc.location_id, loc.name),
        name: applyTemplate(ledgerNameTemplate, loc.location_id, loc.name),
        location_id: loc.id,
        is_active: true,
      }));

      const { error } = await supabase
        .from('ledgers' as any)
        .insert(ledgersToCreate);

      if (error) {
        if (error.code === '23505') {
          toast.error('Duplicate ledger ID detected. Adjust template or selected locations.');
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Created ${selectedLocations.length} ledgers successfully`);
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      console.error('AutoMake error:', err);
      toast.error(err.message || 'Failed to create ledgers');
    } finally {
      setIsCreating(false);
    }
  };

  const allFilteredSelected =
    filteredLocations.length > 0 &&
    filteredLocations.every((l) => selectedLocationIds.has(l.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMaximized ? "!max-w-[95vw] !h-[95vh] flex flex-col" : "sm:max-w-[600px] max-h-[85vh] flex flex-col"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            AutoMake Ledgers
          </DialogTitle>
          <DialogDescription>
            Bulk create ledgers for selected locations using templates. Use @ for location ID and $ for location name.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => setIsMaximized(prev => !prev)}
          className="absolute right-12 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          <span className="sr-only">{isMaximized ? 'Minimize' : 'Maximize'}</span>
        </button>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col mt-2">
          <TabsList className="mx-6 grid grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="locations">
              Locations
              {selectedLocationIds.size > 0 && (
                <span className="ml-1.5 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                  {selectedLocationIds.size}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto px-6 py-4">
            <TabsContent value="general" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Ledger ID Template</Label>
                <Input
                  value={ledgerIdTemplate}
                  onChange={(e) => setLedgerIdTemplate(e.target.value)}
                  placeholder="@-LDGR"
                />
                <p className="text-xs text-muted-foreground">
                  @ = Location ID, $ = Location Name
                </p>
              </div>

              <div className="space-y-2">
                <Label>Ledger Name Template</Label>
                <Input
                  value={ledgerNameTemplate}
                  onChange={(e) => setLedgerNameTemplate(e.target.value)}
                  placeholder="$ Ledger"
                />
                <p className="text-xs text-muted-foreground">
                  @ = Location ID, $ = Location Name
                </p>
              </div>

              {/* Preview */}
              <div className="border rounded-md p-3 bg-muted/30">
                <p className="text-sm font-medium mb-2">
                  Preview (first {Math.min(selectedLocations.length, 5)} of {selectedLocations.length})
                </p>
                {previewItems.length > 0 ? (
                  <div className="space-y-1.5 text-sm font-mono">
                    {previewItems.map((item, idx) => (
                      <div key={idx} className="flex flex-wrap gap-x-4 gap-y-0.5">
                        <span>
                          <span className="text-muted-foreground">ID:</span> {item.ledger_id}
                        </span>
                        <span>
                          <span className="text-muted-foreground">Name:</span> {item.name}
                        </span>
                      </div>
                    ))}
                    {selectedLocations.length > 5 && (
                      <p className="text-muted-foreground text-xs mt-1">
                        ... and {selectedLocations.length - 5} more
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select locations in the Locations tab to see preview
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="locations" className="space-y-3 mt-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  placeholder="Search locations..."
                  className="pl-9"
                />
              </div>

              <div className="border rounded-lg overflow-hidden max-h-[340px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={(checked) => toggleAllLocations(!!checked)}
                        />
                      </TableHead>
                      <TableHead>Location ID</TableHead>
                      <TableHead>Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLocations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No locations found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLocations.map((loc) => (
                        <TableRow
                          key={loc.id}
                          className="cursor-pointer"
                          onClick={() => toggleLocation(loc.id)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedLocationIds.has(loc.id)}
                              onCheckedChange={() => toggleLocation(loc.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{loc.location_id}</TableCell>
                          <TableCell>{loc.name}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground">
                {selectedLocationIds.size} of {locations.length} locations selected
              </p>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
            <Kbd className="ml-2">Esc</Kbd>
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || selectedLocationIds.size === 0}
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-2" />
            )}
            Create {selectedLocationIds.size} Ledger{selectedLocationIds.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

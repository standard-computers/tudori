import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { toast } from 'sonner';

interface SafetyStock {
  id?: string;
  location_id: string;
  location_name: string;
  location_code: string;
  safety_stock_quantity: number;
}

interface SafetyStockTabProps {
  productId: string | null;
  companyId: string;
  isEditing: boolean;
  safetyStocks: SafetyStock[];
  setSafetyStocks: (stocks: SafetyStock[]) => void;
}

export const SafetyStockTab = ({
  productId,
  companyId,
  isEditing,
  safetyStocks,
  setSafetyStocks,
}: SafetyStockTabProps) => {
  const [locations, setLocations] = useState<SearchableSelectOption[]>([]);
  const [newStock, setNewStock] = useState({ location_id: '', quantity: '' });

  useEffect(() => {
    fetchLocations();
  }, [companyId]);

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, location_id, name')
      .eq('company_id', companyId)
      .order('name');

    if (data) {
      setLocations(
        data.map((loc) => ({
          value: loc.id,
          label: loc.name,
          sublabel: loc.location_id,
        }))
      );
    }
  };

  const handleAddSafetyStock = async () => {
    if (!newStock.location_id || !newStock.quantity) {
      toast.error('Please select a location and enter a quantity');
      return;
    }

    const quantity = parseInt(newStock.quantity);
    if (isNaN(quantity) || quantity < 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (safetyStocks.some((s) => s.location_id === newStock.location_id)) {
      toast.error('Safety stock for this location already exists');
      return;
    }

    const location = locations.find((l) => l.value === newStock.location_id);
    if (!location) return;

    const newStockEntry: SafetyStock = {
      location_id: newStock.location_id,
      location_name: location.label,
      location_code: location.sublabel || '',
      safety_stock_quantity: quantity,
    };

    setSafetyStocks([...safetyStocks, newStockEntry]);
    setNewStock({ location_id: '', quantity: '' });
  };

  const handleRemoveSafetyStock = (locationId: string) => {
    setSafetyStocks(safetyStocks.filter((s) => s.location_id !== locationId));
  };

  const handleUpdateQuantity = (locationId: string, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    setSafetyStocks(
      safetyStocks.map((s) =>
        s.location_id === locationId
          ? { ...s, safety_stock_quantity: qty }
          : s
      )
    );
  };

  const availableLocations = locations.filter(
    (loc) => !safetyStocks.some((s) => s.location_id === loc.value)
  );

  return (
    <div className="space-y-4 mt-4">
      <div className="bg-muted/50 rounded-lg p-4 mb-4">
        <p className="text-sm text-muted-foreground">
          Set minimum safety stock quantities for this product at each location.
          These levels are used in planning to ensure sufficient inventory.
        </p>
      </div>

      {safetyStocks.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead className="w-40 text-right">Safety Stock</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safetyStocks.map((stock) => (
                <TableRow key={stock.location_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{stock.location_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {stock.location_code}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min="0"
                      value={stock.safety_stock_quantity}
                      onChange={(e) =>
                        handleUpdateQuantity(stock.location_id, e.target.value)
                      }
                      className="w-24 text-right ml-auto"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSafetyStock(stock.location_id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {safetyStocks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No safety stock levels configured</p>
          <p className="text-sm">Add a location below to set safety stock</p>
        </div>
      )}

      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium text-sm">Add Safety Stock</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="safety_stock_location" className="text-xs">
              Location *
            </Label>
            <SearchableSelect
              options={availableLocations}
              value={newStock.location_id}
              onValueChange={(value) =>
                setNewStock({ ...newStock, location_id: value })
              }
              placeholder="Select location..."
              allowClear
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="safety_stock_qty" className="text-xs">
              Quantity *
            </Label>
            <Input
              id="safety_stock_qty"
              type="number"
              min="0"
              value={newStock.quantity}
              onChange={(e) =>
                setNewStock({ ...newStock, quantity: e.target.value })
              }
              placeholder="e.g., 100"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddSafetyStock}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Safety Stock
        </Button>
      </div>
    </div>
  );
};

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  pu_id: string | null;
  uom_id: string | null;
  product?: { name: string; product_id: string; unit?: string | null };
  uom?: { id: string; name: string; abbreviation: string | null } | null;
}

interface Product {
  id: string;
  name: string;
  product_id: string;
  unit?: string | null;
}

interface ProductUom {
  id: string;
  product_id: string;
  name: string;
  abbreviation: string | null;
}

interface ViewDeliveryItemsTabProps {
  viewItems: DeliveryItem[];
  viewDelivery: { id: string } | null;
  products: Product[];
  productUoms: ProductUom[];
  isEditable: boolean;
  onAddItem: (productId: string, quantity: number) => Promise<void>;
  onRemoveItem: (itemId: string) => Promise<void>;
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void>;
  onUpdateUom: (itemId: string, uomId: string | null) => Promise<void>;
}

export const ViewDeliveryItemsTab = ({
  viewItems,
  viewDelivery,
  products,
  productUoms,
  isEditable,
  onAddItem,
  onRemoveItem,
  onUpdateQuantity,
  onUpdateUom,
}: ViewDeliveryItemsTabProps) => {
  const [newProductId, setNewProductId] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);

  const handleAdd = async () => {
    if (!newProductId) return;
    await onAddItem(newProductId, newQuantity);
    setNewProductId('');
    setNewQuantity(1);
  };

  const getUomDisplay = (item: DeliveryItem) => {
    if (item.uom) return item.uom.abbreviation || item.uom.name;
    return item.product?.unit || '—';
  };

  return (
    <div className="space-y-4">
      {isEditable && (
        <div className="flex items-center justify-between">
          <Label>Delivery Items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!newProductId}
          >
            <Plus className="w-4 h-4" />
            Add Item
          </Button>
        </div>
      )}

      {isEditable && (
        <div className="flex gap-2">
          <Select value={newProductId} onValueChange={setNewProductId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select product..." />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.product_id} - {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            value={newQuantity}
            onChange={(e) => setNewQuantity(parseInt(e.target.value) || 1)}
            className="w-20 text-right"
            placeholder="Qty"
          />
        </div>
      )}

      {viewItems.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          {isEditable ? 'No items yet. Select a product above to add.' : 'No items in this delivery'}
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead className={isEditable ? 'w-[40%]' : ''}>Product</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                {isEditable && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewItems.map((item, index) => {
                const itemUoms = productUoms.filter(u => u.product_id === item.product_id);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.product?.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {item.product?.product_id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isEditable && itemUoms.length > 0 ? (
                        <Select
                          value={item.uom_id || '_base'}
                          onValueChange={(value) => onUpdateUom(item.id, value === '_base' ? null : value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={item.product?.unit || 'Base'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_base">
                              {item.product?.unit || 'Base'}
                            </SelectItem>
                            {itemUoms.map((uom) => (
                              <SelectItem key={uom.id} value={uom.id}>
                                {uom.abbreviation || uom.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">{getUomDisplay(item)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditable ? (
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                          className="w-20 text-right ml-auto"
                        />
                      ) : (
                        item.quantity
                      )}
                    </TableCell>
                    {isEditable && (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

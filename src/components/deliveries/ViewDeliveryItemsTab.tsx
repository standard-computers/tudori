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
  product?: { name: string; product_id: string };
}

interface Product {
  id: string;
  name: string;
  product_id: string;
}

interface ViewDeliveryItemsTabProps {
  viewItems: DeliveryItem[];
  viewDelivery: { id: string } | null;
  products: Product[];
  isEditable: boolean;
  onAddItem: (productId: string, quantity: number) => Promise<void>;
  onRemoveItem: (itemId: string) => Promise<void>;
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void>;
}

export const ViewDeliveryItemsTab = ({
  viewItems,
  viewDelivery,
  products,
  isEditable,
  onAddItem,
  onRemoveItem,
  onUpdateQuantity,
}: ViewDeliveryItemsTabProps) => {
  const [newProductId, setNewProductId] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);

  const handleAdd = async () => {
    if (!newProductId) return;
    await onAddItem(newProductId, newQuantity);
    setNewProductId('');
    setNewQuantity(1);
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
                <TableHead className={isEditable ? 'w-[60%]' : ''}>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                {isEditable && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.product?.name || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground font-mono">
                        {item.product?.product_id}
                      </div>
                    </div>
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

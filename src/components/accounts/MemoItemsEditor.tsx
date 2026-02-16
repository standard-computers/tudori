import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus } from 'lucide-react';

export interface MemoItem {
  id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  notes: string;
}

interface Product {
  id: string;
  name: string;
  product_id: string;
  base_price?: number;
}

interface MemoItemsEditorProps {
  items: MemoItem[];
  onItemsChange: (items: MemoItem[]) => void;
  products: Product[];
  readOnly?: boolean;
}

export const MemoItemsEditor = ({ items, onItemsChange, products, readOnly = false }: MemoItemsEditorProps) => {
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return products.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: p.product_id,
    }));
  }, [products]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [items]);

  const addItem = () => {
    onItemsChange([...items, { product_id: '', quantity: 1, unit_price: 0, notes: '' }]);
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof MemoItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-fill price when product is selected
    if (field === 'product_id') {
      const product = products.find((p) => p.id === value);
      if (product?.base_price && updated[index].unit_price === 0) {
        updated[index].unit_price = product.base_price;
      }
    }
    
    onItemsChange(updated);
  };

  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product ? `${product.product_id} - ${product.name}` : '-';
  };

  if (readOnly) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Items</p>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-20 text-right">Qty</TableHead>
                <TableHead className="w-28 text-right">Unit Price</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="text-sm">{getProductName(item.product_id)}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">${(item.quantity * item.unit_price).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">Total</TableCell>
                <TableCell className="text-right font-semibold">${total.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Items</p>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-3 w-3 mr-1" />
          Add Item
        </Button>
      </div>

      {items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="w-20">Qty</TableHead>
              <TableHead className="w-28">Price</TableHead>
              <TableHead className="w-28 text-right">Total</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="p-1">
                  <SearchableSelect
                    options={productOptions}
                    value={item.product_id}
                    onValueChange={(value) => updateItem(index, 'product_id', value)}
                    placeholder="Product"
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </TableCell>
                <TableCell className="text-right font-medium p-1">
                  ${(item.quantity * item.unit_price).toFixed(2)}
                </TableCell>
                <TableCell className="p-1">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(index)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} className="text-right font-medium">Total</TableCell>
              <TableCell className="text-right font-semibold">${total.toFixed(2)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
};

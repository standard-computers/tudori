import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Package } from 'lucide-react';
import { toast } from '@/lib/toast';

interface Product {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price: number | null;
  image_url: string | null;
}

interface POSSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  locationName: string;
  companyId: string;
  onSaved: () => void;
}

const POSSettingsDialog = ({
  open,
  onOpenChange,
  locationId,
  locationName,
  companyId,
  onSaved,
}: POSSettingsDialogProps) => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && locationId) {
      fetchData();
    }
  }, [open, locationId]);

  const fetchData = async () => {
    setLoading(true);
    const [productsRes, assignedRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, product_id, name, sku, price, image_url')
        .eq('company_id', companyId)
        .eq('status', 'Active')
        .order('name'),
      supabase
        .from('pos_location_products')
        .select('product_id')
        .eq('location_id', locationId),
    ]);

    if (productsRes.data) setAllProducts(productsRes.data);
    if (assignedRes.data) {
      setSelectedProductIds(new Set(assignedRes.data.map((r) => r.product_id)));
    }
    setLoading(false);
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0) {
      // If all filtered are selected, deselect them
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing assignments
      await supabase
        .from('pos_location_products')
        .delete()
        .eq('location_id', locationId);

      // Insert new assignments
      if (selectedProductIds.size > 0) {
        const rows = Array.from(selectedProductIds).map((product_id) => ({
          location_id: locationId,
          product_id,
        }));
        const { error } = await supabase
          .from('pos_location_products')
          .insert(rows);
        if (error) throw error;
      }

      toast.success('POS settings saved');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Failed to save POS settings');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = allProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProductIds.has(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>POS Settings — {locationName}</DialogTitle>
          <DialogDescription>
            Select which products are available at this POS location.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{selectedProductIds.size} of {allProducts.length} selected</span>
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {allFilteredSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
                  {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-muted-foreground">
                      <Package className="w-8 h-8 mb-2" />
                      <p className="text-sm">No products found</p>
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <label
                        key={product.id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.product_id}
                            {product.sku ? ` · ${product.sku}` : ''}
                            {product.price != null ? ` · $${product.price.toFixed(2)}` : ''}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default POSSettingsDialog;

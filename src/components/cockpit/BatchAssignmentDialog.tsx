import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Layers, AlertCircle } from 'lucide-react';

export interface BatchLine {
  batchNumber: string;
  expirationDate: string;
  quantity: number;
}

export interface BatchedProduct {
  itemId: string;
  productId: string;
  productName: string;
  productCode: string;
  totalQuantity: number;
  batchLines: BatchLine[];
}

interface BatchAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchedProducts: BatchedProduct[];
  onConfirm: (products: BatchedProduct[]) => void;
}

export const BatchAssignmentDialog = ({
  open,
  onOpenChange,
  batchedProducts: initialProducts,
  onConfirm,
}: BatchAssignmentDialogProps) => {
  const [products, setProducts] = useState<BatchedProduct[]>([]);

  // Reset state when dialog opens with new data
  useEffect(() => {
    if (open && initialProducts.length > 0) {
      setProducts(initialProducts.map(p => ({
        ...p,
        batchLines: p.batchLines.length > 0 ? p.batchLines : [{ batchNumber: '', expirationDate: '', quantity: p.totalQuantity }],
      })));
    }
  }, [open, initialProducts]);

  const addLine = (productIndex: number) => {
    setProducts(prev => {
      const updated = [...prev];
      updated[productIndex] = {
        ...updated[productIndex],
        batchLines: [...updated[productIndex].batchLines, { batchNumber: '', expirationDate: '', quantity: 0 }],
      };
      return updated;
    });
  };

  const removeLine = (productIndex: number, lineIndex: number) => {
    setProducts(prev => {
      const updated = [...prev];
      const lines = [...updated[productIndex].batchLines];
      lines.splice(lineIndex, 1);
      updated[productIndex] = { ...updated[productIndex], batchLines: lines };
      return updated;
    });
  };

  const updateLine = (productIndex: number, lineIndex: number, field: keyof BatchLine, value: string | number) => {
    setProducts(prev => {
      const updated = [...prev];
      const lines = [...updated[productIndex].batchLines];
      lines[lineIndex] = { ...lines[lineIndex], [field]: value };
      updated[productIndex] = { ...updated[productIndex], batchLines: lines };
      return updated;
    });
  };

  const getAssignedQty = (product: BatchedProduct) =>
    product.batchLines.reduce((sum, line) => sum + line.quantity, 0);

  const getRemainingQty = (product: BatchedProduct) =>
    product.totalQuantity - getAssignedQty(product);

  const allValid = products.every(p => {
    const remaining = getRemainingQty(p);
    const allHaveBatchName = p.batchLines.every(l => l.batchNumber.trim() !== '');
    const allHaveQty = p.batchLines.every(l => l.quantity > 0);
    return remaining === 0 && allHaveBatchName && allHaveQty;
  });

  const handleConfirm = () => {
    onConfirm(products);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Assign Batches
          </DialogTitle>
          <DialogDescription>
            Assign batch numbers and optional expiration dates for batch-managed products. All quantities must be accounted for.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {products.map((product, pIdx) => {
              const remaining = getRemainingQty(product);
              return (
                <div key={product.itemId} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{product.productName}</div>
                      <div className="text-sm text-muted-foreground font-mono">{product.productCode}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Total Qty</div>
                      <div className="font-semibold">{product.totalQuantity}</div>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch</TableHead>
                        <TableHead>Expiration Date</TableHead>
                        <TableHead className="w-24 text-right">Qty</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {product.batchLines.map((line, lIdx) => (
                        <TableRow key={lIdx}>
                          <TableCell>
                            <Input
                              placeholder="Batch name..."
                              value={line.batchNumber}
                              onChange={(e) => updateLine(pIdx, lIdx, 'batchNumber', e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={line.expirationDate}
                              onChange={(e) => updateLine(pIdx, lIdx, 'expirationDate', e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              max={product.totalQuantity}
                              value={line.quantity}
                              onChange={(e) => updateLine(pIdx, lIdx, 'quantity', parseInt(e.target.value) || 0)}
                              className="h-8 w-20 text-right ml-auto"
                            />
                          </TableCell>
                          <TableCell>
                            {product.batchLines.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => removeLine(pIdx, lIdx)}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={() => addLine(pIdx)}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Line
                    </Button>
                    {remaining !== 0 && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        <span className={remaining > 0 ? 'text-amber-600' : 'text-destructive'}>
                          {remaining > 0 ? `${remaining} remaining` : `${Math.abs(remaining)} over-assigned`}
                        </span>
                      </div>
                    )}
                    {remaining === 0 && (
                      <span className="text-sm text-green-600">✓ Fully assigned</span>
                    )}
                  </div>

                  {pIdx < products.length - 1 && <div className="border-t" />}
                </div>
              );
            })}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button onClick={handleConfirm} disabled={!allValid}>
            Confirm Batches
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

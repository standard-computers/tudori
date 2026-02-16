import { useEffect, useState, useCallback, useMemo } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { supabase } from '@/integrations/supabase/client';
import { useTableSort } from '@/hooks/use-table-sort';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SortableTableHead } from '@/components/SortableTableHead';
import {
  Table as ItemsTable,
  TableBody as ItemsTableBody,
  TableCell as ItemsTableCell,
  TableHead as ItemsTableHead,
  TableHeader as ItemsTableHeader,
  TableRow as ItemsTableRow,
} from '@/components/ui/table';
import { Eye, MoreHorizontal, Maximize2, Minimize2, Truck, SendHorizonal, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { toast } from '@/lib/toast';

interface OutboundDeliveryItem {
  id: string;
  outbound_delivery_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product?: { name: string; product_id: string } | null;
}

interface OutboundDelivery {
  id: string;
  delivery_number: string;
  status: string;
  from_location_id: string | null;
  to_location_id: string | null;
  purchase_order_id: string | null;
  sales_order_id: string | null;
  customer_id: string | null;
  carrier: string | null;
  tracking_number: string | null;
  shipped_date: string | null;
  delivered_date: string | null;
  notes: string | null;
  created_at: string;
  from_location?: { name: string } | null;
  to_location?: { name: string } | null;
  purchase_order?: { po_number: string } | null;
  sales_order?: { so_number: string } | null;
  customer?: { name: string } | null;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'in_transit': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'partial': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'delivered': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'shipped': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

interface OutboundDeliveriesTabProps {
  companyId: string;
}

export function OutboundDeliveriesTab({ companyId }: OutboundDeliveriesTabProps) {
  const [outboundDeliveries, setOutboundDeliveries] = useState<OutboundDelivery[]>([]);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewDelivery, setViewDelivery] = useState<OutboundDelivery | null>(null);
  const [isViewMaximized, setIsViewMaximized] = useMaximizedState();
  const [viewItems, setViewItems] = useState<OutboundDeliveryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inTransitConfirmOpen, setInTransitConfirmOpen] = useState(false);
  const [isBulkInTransit, setIsBulkInTransit] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    sortedAndFilteredData,
  } = useTableSort(outboundDeliveries, 'delivery_number', 'desc');

  const fetchOutboundDeliveries = useCallback(async () => {
    const { data, error } = await supabase
      .from('outbound_deliveries')
      .select(`
        *,
        from_location:locations!outbound_deliveries_from_location_id_fkey(name),
        to_location:locations!outbound_deliveries_to_location_id_fkey(name),
        purchase_order:purchase_orders!outbound_deliveries_purchase_order_id_fkey(po_number),
        sales_order:sales_orders!outbound_deliveries_sales_order_id_fkey(so_number),
        customer:customers!outbound_deliveries_customer_id_fkey(name)
      `)
      .eq('company_id', companyId)
      .order('delivery_number', { ascending: false });

    if (error) {
      console.error('Failed to load outbound deliveries:', error);
      toast.error('Failed to load outbound deliveries');
      return;
    }

    setOutboundDeliveries((data || []) as unknown as OutboundDelivery[]);
  }, [companyId]);

  useEffect(() => {
    fetchOutboundDeliveries();
  }, [fetchOutboundDeliveries]);

  const fetchOutboundDeliveryItems = useCallback(async (deliveryId: string) => {
    const { data } = await supabase
      .from('outbound_delivery_items' as any)
      .select(`
        *,
        product:products(name, product_id)
      `)
      .eq('outbound_delivery_id', deliveryId);
    setViewItems((data || []) as unknown as OutboundDeliveryItem[]);
  }, []);

  const handleView = (delivery: OutboundDelivery) => {
    setViewDelivery(delivery);
    fetchOutboundDeliveryItems(delivery.id);
    setIsViewOpen(true);
  };

  const outboundInTransitEligibleCount = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const d = outboundDeliveries.find(del => del.id === id);
      return d && d.status === 'pending';
    }).length;
  }, [selectedIds, outboundDeliveries]);

  const bulkDeleteEligibleCount = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const d = outboundDeliveries.find(del => del.id === id);
      return d && (d.status === 'pending');
    }).length;
  }, [selectedIds, outboundDeliveries]);

  const handleBulkDelete = async () => {
    const eligibleIds = Array.from(selectedIds).filter(id => {
      const d = outboundDeliveries.find(del => del.id === id);
      return d && d.status === 'pending';
    });
    if (eligibleIds.length === 0) return;
    setIsBulkDeleting(true);
    // Delete items first, then deliveries
    await supabase
      .from('outbound_delivery_items' as any)
      .delete()
      .in('outbound_delivery_id', eligibleIds);
    const { error } = await supabase
      .from('outbound_deliveries')
      .delete()
      .in('id', eligibleIds);
    if (error) {
      toast.error('Failed to delete deliveries');
    } else {
      toast.success(`${eligibleIds.length} deliver${eligibleIds.length === 1 ? 'y' : 'ies'} deleted`);
      setSelectedIds(new Set());
      fetchOutboundDeliveries();
    }
    setIsBulkDeleting(false);
    setBulkDeleteConfirmOpen(false);
  };

  const handleBulkMarkInTransit = async () => {
    const eligibleIds = Array.from(selectedIds).filter(id => {
      const d = outboundDeliveries.find(del => del.id === id);
      return d && d.status === 'pending';
    });
    if (eligibleIds.length === 0) return;
    setIsBulkInTransit(true);
    const { error } = await supabase
      .from('outbound_deliveries')
      .update({ status: 'in_transit' })
      .in('id', eligibleIds);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`${eligibleIds.length} deliver${eligibleIds.length === 1 ? 'y' : 'ies'} marked as In Transit`);
      setSelectedIds(new Set());
      fetchOutboundDeliveries();
    }
    setIsBulkInTransit(false);
    setInTransitConfirmOpen(false);
  };

  if (outboundDeliveries.length === 0) {
    return (
      <div className="text-center py-12">
        <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No outbound deliveries yet</h3>
        <p className="text-muted-foreground">
          Outbound deliveries are created when internal transfer POs are confirmed.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden">
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            {outboundInTransitEligibleCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInTransitConfirmOpen(true)}
                disabled={isBulkInTransit}
              >
                <SendHorizonal className="w-4 h-4 mr-2" />
                Mark In Transit ({outboundInTransitEligibleCount})
              </Button>
            )}
            {bulkDeleteEligibleCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkDeleteConfirmOpen(true)}
                disabled={isBulkDeleting}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({bulkDeleteEligibleCount})
              </Button>
            )}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={sortedAndFilteredData.length > 0 && sortedAndFilteredData.every(d => selectedIds.has(d.id))}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedIds(new Set(sortedAndFilteredData.map(d => d.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                />
              </TableHead>
              <SortableTableHead
                label="ID"
                sortKey="delivery_number"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['delivery_number'] || ''}
                onFilter={(value) => setFilter('delivery_number', value)}
                className="w-28"
              />
              <SortableTableHead
                label="PO"
                sortKey="purchase_order.po_number"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['purchase_order.po_number'] || ''}
                onFilter={(value) => setFilter('purchase_order.po_number', value)}
              />
              <SortableTableHead
                label="From"
                sortKey="from_location.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['from_location.name'] || ''}
                onFilter={(value) => setFilter('from_location.name', value)}
              />
              <SortableTableHead
                label="To"
                sortKey="to_location.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['to_location.name'] || ''}
                onFilter={(value) => setFilter('to_location.name', value)}
              />
              <SortableTableHead
                label="Customer"
                sortKey="customer.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['customer.name'] || ''}
                onFilter={(value) => setFilter('customer.name', value)}
              />
              <SortableTableHead
                label="Carrier"
                sortKey="carrier"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['carrier'] || ''}
                onFilter={(value) => setFilter('carrier', value)}
              />
              <SortableTableHead
                label="Shipped"
                sortKey="shipped_date"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterable={false}
              />
              <SortableTableHead
                label="Status"
                sortKey="status"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['status'] || ''}
                onFilter={(value) => setFilter('status', value)}
              />
              <SortableTableHead
                label="Actions"
                sortKey=""
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={() => {}}
                filterable={false}
                className="w-24"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.map((delivery) => (
              <TableRow key={delivery.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(delivery.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds);
                      if (checked) next.add(delivery.id); else next.delete(delivery.id);
                      setSelectedIds(next);
                    }}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">
                  <button
                    onClick={() => handleView(delivery)}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    {delivery.delivery_number}
                  </button>
                </TableCell>
                <TableCell>{delivery.purchase_order?.po_number || '—'}</TableCell>
                <TableCell>{delivery.from_location?.name || '—'}</TableCell>
                <TableCell>{delivery.to_location?.name || '—'}</TableCell>
                <TableCell>{delivery.customer?.name || '—'}</TableCell>
                <TableCell>{delivery.carrier || '—'}</TableCell>
                <TableCell>
                  {delivery.shipped_date
                    ? format(new Date(delivery.shipped_date), 'MMM d, yyyy')
                    : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(delivery.status)}>
                    {delivery.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleView(delivery)}
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* View Outbound Delivery Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className={`flex flex-col transition-all duration-200 ${isViewMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[900px] max-h-[85vh]'}`}>
          <button
            type="button"
            onClick={() => setIsViewMaximized(!isViewMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isViewMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <DialogHeader>
            <DialogTitle>View Outbound Delivery</DialogTitle>
            <DialogDescription>
              {viewDelivery?.delivery_number}
            </DialogDescription>
          </DialogHeader>
          {viewDelivery && (
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Status</Label>
                  <div>
                    <Badge variant="outline" className={getStatusColor(viewDelivery.status)}>
                      {viewDelivery.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Purchase Order</Label>
                  <p className="text-sm font-mono">{viewDelivery.purchase_order?.po_number || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">From Location</Label>
                  <p className="text-sm">{viewDelivery.from_location?.name || '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">To Location</Label>
                  <p className="text-sm">{viewDelivery.to_location?.name || '—'}</p>
                </div>
              </div>
              {viewDelivery.customer?.name && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="text-sm">{viewDelivery.customer.name}</p>
                </div>
              )}
              {viewDelivery.sales_order?.so_number && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Sales Order</Label>
                  <p className="text-sm font-mono">{viewDelivery.sales_order.so_number}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Carrier</Label>
                  <p className="text-sm">{viewDelivery.carrier || '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Tracking Number</Label>
                  <p className="text-sm font-mono">{viewDelivery.tracking_number || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Shipped Date</Label>
                  <p className="text-sm">
                    {viewDelivery.shipped_date
                      ? format(new Date(viewDelivery.shipped_date), 'MMM d, yyyy')
                      : '—'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Delivered Date</Label>
                  <p className="text-sm">
                    {viewDelivery.delivered_date
                      ? format(new Date(viewDelivery.delivered_date), 'MMM d, yyyy')
                      : '—'}
                  </p>
                </div>
              </div>
              {viewDelivery.notes && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm">{viewDelivery.notes}</p>
                </div>
              )}
              {/* Items */}
              {viewItems.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Items</Label>
                  <ItemsTable>
                    <ItemsTableHeader>
                      <ItemsTableRow>
                        <ItemsTableHead className="w-12">#</ItemsTableHead>
                        <ItemsTableHead>Product</ItemsTableHead>
                        <ItemsTableHead className="w-24 text-right">Qty</ItemsTableHead>
                      </ItemsTableRow>
                    </ItemsTableHeader>
                    <ItemsTableBody>
                      {viewItems.map((item, idx) => (
                        <ItemsTableRow key={item.id}>
                          <ItemsTableCell className="text-muted-foreground">{idx + 1}</ItemsTableCell>
                          <ItemsTableCell>
                            <div>
                              <div className="font-medium">{item.product?.name || 'Unknown'}</div>
                              <div className="text-sm text-muted-foreground font-mono">{item.product?.product_id || ''}</div>
                            </div>
                          </ItemsTableCell>
                          <ItemsTableCell className="text-right">{item.quantity}</ItemsTableCell>
                        </ItemsTableRow>
                      ))}
                    </ItemsTableBody>
                  </ItemsTable>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk In Transit Confirmation */}
      <AlertDialog open={inTransitConfirmOpen} onOpenChange={setInTransitConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as In Transit?</AlertDialogTitle>
            <AlertDialogDescription>
              {outboundInTransitEligibleCount} deliver{outboundInTransitEligibleCount === 1 ? 'y' : 'ies'} will be marked as In Transit. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkMarkInTransit}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deliveries?</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkDeleteEligibleCount} deliver{bulkDeleteEligibleCount === 1 ? 'y' : 'ies'} will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

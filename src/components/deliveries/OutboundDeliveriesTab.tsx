import { useEffect, useState, useCallback, useMemo } from 'react';
import { useShiftSelect } from '@/hooks/use-shift-select';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { supabase } from '@/integrations/supabase/client';
import { useTableSort } from '@/hooks/use-table-sort';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
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
import { ImportProgressDialog } from '@/components/ImportProgressDialog';
import {
  Table as ItemsTable,
  TableBody as ItemsTableBody,
  TableCell as ItemsTableCell,
  TableHead as ItemsTableHead,
  TableHeader as ItemsTableHeader,
  TableRow as ItemsTableRow,
} from '@/components/ui/table';
import { Eye, MoreHorizontal, Maximize2, Minimize2, Truck, SendHorizonal, Trash2, Pencil, Undo2 } from 'lucide-react';
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
import { format, parseISO } from 'date-fns';
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

/** Check if outbound delivery has no dependent docs (GI, inbound deliveries) */
const canEditOutbound = async (deliveryId: string): Promise<boolean> => {
  const [giResult, delResult] = await Promise.all([
    supabase
      .from('goods_issues')
      .select('id', { count: 'exact', head: true })
      .eq('outbound_delivery_id', deliveryId),
    supabase
      .from('deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('outbound_delivery_id', deliveryId),
  ]);
  return (giResult.count ?? 0) === 0 && (delResult.count ?? 0) === 0;
};

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

  // Edit state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDelivery, setEditDelivery] = useState<OutboundDelivery | null>(null);
  const [editForm, setEditForm] = useState({
    carrier: '',
    tracking_number: '',
    shipped_date: '',
    notes: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  // Revert to pending state
  const [revertConfirmOpen, setRevertConfirmOpen] = useState(false);
  const [revertDeliveryId, setRevertDeliveryId] = useState<string | null>(null);
  const [isBulkRevertPending, setIsBulkRevertPending] = useState(false);

  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    sortedAndFilteredData,
  } = useTableSort(outboundDeliveries, 'delivery_number', 'desc');

  const outboundOrderedIds = useMemo(() => sortedAndFilteredData.map(d => d.id), [sortedAndFilteredData]);
  const { handleRowSelect: handleOutboundShiftSelect } = useShiftSelect(outboundOrderedIds, selectedIds, setSelectedIds);

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

  const handleEdit = async (delivery: OutboundDelivery) => {
    const editable = await canEditOutbound(delivery.id);
    if (!editable) {
      toast.error('Cannot edit — this delivery has goods issues or inbound deliveries against it');
      return;
    }
    setEditDelivery(delivery);
    setEditForm({
      carrier: delivery.carrier || '',
      tracking_number: delivery.tracking_number || '',
      shipped_date: delivery.shipped_date || '',
      notes: delivery.notes || '',
    });
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editDelivery) return;
    setEditSaving(true);
    const { error } = await supabase
      .from('outbound_deliveries')
      .update({
        carrier: editForm.carrier || null,
        tracking_number: editForm.tracking_number || null,
        shipped_date: editForm.shipped_date || null,
        notes: editForm.notes || null,
      })
      .eq('id', editDelivery.id);
    setEditSaving(false);
    if (error) {
      toast.error('Failed to update delivery');
    } else {
      toast.success('Delivery updated');
      setIsEditOpen(false);
      fetchOutboundDeliveries();
    }
  };

  const handleRevertToPending = async (deliveryId: string) => {
    const editable = await canEditOutbound(deliveryId);
    if (!editable) {
      toast.error('Cannot revert — this delivery has goods issues or inbound deliveries against it');
      return;
    }
    setRevertDeliveryId(deliveryId);
    setRevertConfirmOpen(true);
  };

  const confirmRevertToPending = async () => {
    if (!revertDeliveryId) return;
    const { error } = await supabase
      .from('outbound_deliveries')
      .update({ status: 'pending' })
      .eq('id', revertDeliveryId);
    if (error) {
      toast.error('Failed to revert to pending');
    } else {
      toast.success('Delivery reverted to Pending');
      fetchOutboundDeliveries();
    }
    setRevertConfirmOpen(false);
    setRevertDeliveryId(null);
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

  const bulkRevertEligibleCount = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const d = outboundDeliveries.find(del => del.id === id);
      return d && d.status === 'in_transit';
    }).length;
  }, [selectedIds, outboundDeliveries]);

  const handleBulkDelete = async () => {
    const eligibleIds = Array.from(selectedIds).filter(id => {
      const d = outboundDeliveries.find(del => del.id === id);
      return d && d.status === 'pending';
    });
    if (eligibleIds.length === 0) return;
    setIsBulkDeleting(true);
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

  const [transitProgressOpen, setTransitProgressOpen] = useState(false);
  const [transitProgressTotal, setTransitProgressTotal] = useState(0);
  const [transitProgressProcessed, setTransitProgressProcessed] = useState(0);
  const [transitProgressResults, setTransitProgressResults] = useState<import('@/components/ImportProgressDialog').ImportResult[]>([]);
  const [transitProgressComplete, setTransitProgressComplete] = useState(false);

  const [revertProgressOpen, setRevertProgressOpen] = useState(false);
  const [revertProgressTotal, setRevertProgressTotal] = useState(0);
  const [revertProgressProcessed, setRevertProgressProcessed] = useState(0);
  const [revertProgressResults, setRevertProgressResults] = useState<import('@/components/ImportProgressDialog').ImportResult[]>([]);
  const [revertProgressComplete, setRevertProgressComplete] = useState(false);

  const handleBulkMarkInTransit = async () => {
    const eligibleIds = Array.from(selectedIds).filter(id => {
      const d = outboundDeliveries.find(del => del.id === id);
      return d && d.status === 'pending';
    });
    if (eligibleIds.length === 0) return;
    setInTransitConfirmOpen(false);
    setIsBulkInTransit(true);
    setTransitProgressOpen(true);
    setTransitProgressTotal(eligibleIds.length);
    setTransitProgressProcessed(0);
    setTransitProgressResults([]);
    setTransitProgressComplete(false);

    for (let i = 0; i < eligibleIds.length; i++) {
      const id = eligibleIds[i];
      const d = outboundDeliveries.find(del => del.id === id);
      const label = d?.delivery_number || id.slice(0, 8);
      const { error } = await supabase
        .from('outbound_deliveries')
        .update({ status: 'in_transit' })
        .eq('id', id);
      setTransitProgressProcessed(i + 1);
      setTransitProgressResults(prev => [...prev, {
        row: i + 1,
        status: error ? 'error' as const : 'success' as const,
        message: error ? `${label}: ${error.message}` : `${label} marked as In Transit`,
      }]);
    }

    setTransitProgressComplete(true);
    setSelectedIds(new Set());
    fetchOutboundDeliveries();
    setIsBulkInTransit(false);
  };

  const handleBulkRevertPending = async () => {
    const eligibleIds = Array.from(selectedIds).filter(id => {
      const d = outboundDeliveries.find(del => del.id === id);
      return d && d.status === 'in_transit';
    });
    if (eligibleIds.length === 0) return;
    setIsBulkRevertPending(true);
    setRevertProgressOpen(true);
    setRevertProgressTotal(eligibleIds.length);
    setRevertProgressProcessed(0);
    setRevertProgressResults([]);
    setRevertProgressComplete(false);

    for (let i = 0; i < eligibleIds.length; i++) {
      const id = eligibleIds[i];
      const d = outboundDeliveries.find(del => del.id === id);
      const label = d?.delivery_number || id.slice(0, 8);
      const editable = await canEditOutbound(id);
      if (!editable) {
        setRevertProgressProcessed(i + 1);
        setRevertProgressResults(prev => [...prev, {
          row: i + 1,
          status: 'error' as const,
          message: `${label}: has dependent documents`,
        }]);
        continue;
      }
      const { error } = await supabase
        .from('outbound_deliveries')
        .update({ status: 'pending' })
        .eq('id', id);
      setRevertProgressProcessed(i + 1);
      setRevertProgressResults(prev => [...prev, {
        row: i + 1,
        status: error ? 'error' as const : 'success' as const,
        message: error ? `${label}: ${error.message}` : `${label} reverted to Pending`,
      }]);
    }

    setRevertProgressComplete(true);
    setSelectedIds(new Set());
    fetchOutboundDeliveries();
    setIsBulkRevertPending(false);
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
            {bulkRevertEligibleCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkRevertPending}
                disabled={isBulkRevertPending}
              >
                <Undo2 className="w-4 h-4 mr-2" />
                Revert to Pending ({bulkRevertEligibleCount})
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
                label="Created"
                sortKey="created_at"
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
                <TableCell onClick={(e) => {
                  handleOutboundShiftSelect(delivery.id, !selectedIds.has(delivery.id), e.shiftKey);
                }}>
                  <Checkbox
                    checked={selectedIds.has(delivery.id)}
                    onCheckedChange={() => {}}
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
                    ? format(parseISO(delivery.shipped_date), 'MMM d, yyyy')
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
                    {(delivery.status === 'pending' || delivery.status === 'in_transit') && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {delivery.status === 'in_transit' && (
                            <>
                              <DropdownMenuItem onClick={() => handleEdit(delivery)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRevertToPending(delivery.id)}>
                                <Undo2 className="w-4 h-4 mr-2" />
                                Revert to Pending
                              </DropdownMenuItem>
                            </>
                          )}
                          {delivery.status === 'pending' && (
                            <DropdownMenuItem onClick={() => handleEdit(delivery)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Outbound Delivery Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Outbound Delivery</DialogTitle>
            <DialogDescription>
              {editDelivery?.delivery_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-carrier">Carrier</Label>
              <Input
                id="edit-carrier"
                value={editForm.carrier}
                onChange={(e) => setEditForm(prev => ({ ...prev, carrier: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tracking">Tracking Number</Label>
              <Input
                id="edit-tracking"
                value={editForm.tracking_number}
                onChange={(e) => setEditForm(prev => ({ ...prev, tracking_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-shipped-date">Shipped Date</Label>
              <Input
                id="edit-shipped-date"
                type="date"
                value={editForm.shipped_date}
                onChange={(e) => setEditForm(prev => ({ ...prev, shipped_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      ? format(parseISO(viewDelivery.shipped_date), 'MMM d, yyyy')
                      : '—'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Delivered Date</Label>
                  <p className="text-sm">
                    {viewDelivery.delivered_date
                      ? format(parseISO(viewDelivery.delivered_date), 'MMM d, yyyy')
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

      {/* Revert to Pending Confirmation */}
      <AlertDialog open={revertConfirmOpen} onOpenChange={setRevertConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert to Pending?</AlertDialogTitle>
            <AlertDialogDescription>
              This delivery will be reverted to Pending status. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevertToPending}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <ImportProgressDialog
        open={transitProgressOpen}
        onOpenChange={setTransitProgressOpen}
        title="Marking Deliveries In Transit"
        totalRows={transitProgressTotal}
        processedRows={transitProgressProcessed}
        results={transitProgressResults}
        isComplete={transitProgressComplete}
      />

      <ImportProgressDialog
        open={revertProgressOpen}
        onOpenChange={setRevertProgressOpen}
        title="Reverting Deliveries to Pending"
        totalRows={revertProgressTotal}
        processedRows={revertProgressProcessed}
        results={revertProgressResults}
        isComplete={revertProgressComplete}
      />
    </>
  );
}

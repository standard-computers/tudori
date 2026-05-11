import { useEffect, useState } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { useSaveShortcut, useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useVendorSources } from '@/hooks/use-vendor-sources';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { useExcel } from '@/hooks/use-excel';
import { ImportExportButtons } from '@/components/ImportExportButtons';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/SortableTableHead';
import { ArrowLeft, Plus, Pencil, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { useTableSort } from '@/hooks/use-table-sort';
import { Kbd } from '@/components/ui/kbd';
import { toast } from '@/lib/toast';

interface Location { id: string; location_id: string; name: string; }
interface Product { id: string; product_id: string; name: string; }
interface Vendor { id: string; vendor_id: string; name: string; }

interface Assignment {
  id: string;
  assignment_id: string;
  product_id: string;
  vendor_id: string | null;
  source_location_id: string | null;
  destination_location_id: string;
  priority: number;
  price: number;
  is_active: boolean;
  notes: string | null;
  product?: { id: string; product_id: string; name: string } | null;
  vendor?: { id: string; vendor_id: string; name: string } | null;
  source_location?: { id: string; location_id: string; name: string } | null;
  destination_location?: { id: string; location_id: string; name: string } | null;
}

const Assignments = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();

  useKeyboardShortcut('F1', () => navigate(-1));
  useKeyboardShortcut('n', () => openNewAssignmentDialog());

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [importProgress, setImportProgress] = useState<{ open: boolean; total: number; current: number; imported: number; failed: number }>({ open: false, total: 0, current: 0, imported: 0, failed: 0 });

  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    assignment_id: '',
    product_id: '',
    source_value: '',
    destination_location_id: '',
    priority: 1,
    price: 0,
    is_active: true,
    notes: '',
  });

  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();
  const { vendorOptions, parseVendorValue } = useVendorSources(companyId, { includeAllLocations: true });

  const {
    sortConfig: assignmentSortConfig,
    filters: assignmentFilters,
    handleSort: handleAssignmentSort,
    setFilter: setAssignmentFilter,
    sortedAndFilteredData: sortedAssignments,
  } = useTableSort<Assignment>(assignments, 'assignment_id', 'asc');

  useSaveShortcut(() => {
    if (isAssignmentDialogOpen && assignmentForm.assignment_id && assignmentForm.product_id && assignmentForm.source_value && assignmentForm.destination_location_id) {
      handleSaveAssignment();
    }
  }, isAssignmentDialogOpen);

  useEffect(() => {
    if (isAssignmentDialogOpen) {
      setTransaction(editingAssignment ? 'asn/edit' : 'asn/new');
    } else {
      setTransaction('asn');
    }
  }, [isAssignmentDialogOpen, editingAssignment, setTransaction]);

  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('company_id').eq('user_id', user.id).single();
      if (data?.company_id) setCompanyId(data.company_id);
    };
    fetchCompanyId();
  }, [user]);

  useEffect(() => {
    if (companyId) {
      fetchLocations();
      fetchProducts();
      fetchVendors();
      fetchAssignments();
    }
  }, [companyId]);

  const fetchLocations = async () => {
    if (!companyId) return;
    const { data } = await supabase.from('locations').select('id, location_id, name').eq('company_id', companyId).order('name');
    if (data) setLocations(data);
  };
  const fetchProducts = async () => {
    if (!companyId) return;
    const { data } = await supabase.from('products').select('id, product_id, name').eq('company_id', companyId).order('name');
    if (data) setProducts(data);
  };
  const fetchVendors = async () => {
    if (!companyId) return;
    const { data } = await supabase.from('vendors').select('id, vendor_id, name').eq('company_id', companyId).order('name');
    if (data) setVendors(data);
  };
  const fetchAssignments = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('assignments')
      .select(`*,
        product:products(id, product_id, name),
        vendor:vendors(id, vendor_id, name),
        source_location:locations!assignments_source_location_id_fkey(id, location_id, name),
        destination_location:locations!assignments_destination_location_id_fkey(id, location_id, name)
      `)
      .eq('company_id', companyId)
      .order('assignment_id');
    if (error) console.error('Failed to load assignments:', error);
    else setAssignments(data || []);
  };

  const getNextAssignmentId = async (): Promise<string> => {
    if (!companyId) return 'ASN-0001';
    const { data, error } = await supabase.rpc('generate_assignment_id', { p_company_id: companyId });
    if (error || !data) return 'ASN-0001';
    return data;
  };

  const openNewAssignmentDialog = async () => {
    const nextId = await getNextAssignmentId();
    setAssignmentForm({
      assignment_id: nextId, product_id: '', source_value: '', destination_location_id: '',
      priority: 1, price: 0, is_active: true, notes: '',
    });
    setEditingAssignment(null);
    setIsAssignmentDialogOpen(true);
  };

  const openEditAssignmentDialog = (assignment: Assignment) => {
    let sourceValue = '';
    if (assignment.vendor_id) sourceValue = `vendor:${assignment.vendor_id}`;
    else if (assignment.source_location_id) sourceValue = `location:${assignment.source_location_id}`;
    setAssignmentForm({
      assignment_id: assignment.assignment_id,
      product_id: assignment.product_id,
      source_value: sourceValue,
      destination_location_id: assignment.destination_location_id,
      priority: assignment.priority,
      price: assignment.price || 0,
      is_active: assignment.is_active,
      notes: assignment.notes || '',
    });
    setEditingAssignment(assignment);
    setIsAssignmentDialogOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!companyId || !assignmentForm.assignment_id || !assignmentForm.product_id || !assignmentForm.source_value || !assignmentForm.destination_location_id) return;
    const parsed = parseVendorValue(assignmentForm.source_value);
    if (!parsed) { toast.error('Invalid source selection'); return; }
    const assignmentData = {
      company_id: companyId,
      assignment_id: assignmentForm.assignment_id,
      product_id: assignmentForm.product_id,
      vendor_id: parsed.type === 'vendor' ? parsed.id : null,
      source_location_id: parsed.type === 'location' ? parsed.id : null,
      destination_location_id: assignmentForm.destination_location_id,
      priority: assignmentForm.priority,
      price: assignmentForm.price,
      is_active: assignmentForm.is_active,
      notes: assignmentForm.notes || null,
    };
    if (editingAssignment) {
      const { error } = await supabase.from('assignments').update(assignmentData).eq('id', editingAssignment.id);
      if (error) toast.error(error.message);
      else { toast.success('Assignment updated'); setIsAssignmentDialogOpen(false); fetchAssignments(); }
    } else {
      const { error } = await supabase.from('assignments').insert(assignmentData);
      if (error) {
        if (error.message.includes('duplicate')) toast.error('This product-vendor-location assignment already exists');
        else toast.error(error.message);
      } else { toast.success('Assignment created'); setIsAssignmentDialogOpen(false); fetchAssignments(); }
    }
  };

  const handleDeleteAssignment = async (assignment: Assignment) => {
    if (!confirm(`Delete assignment "${assignment.assignment_id}"?`)) return;
    const { error } = await supabase.from('assignments').delete().eq('id', assignment.id);
    if (error) toast.error(error.message);
    else { toast.success('Assignment deleted'); fetchAssignments(); }
  };

  // ---- Import/Export ----
  const ASSIGNMENT_TEMPLATE_COLUMNS = [
    { header: 'Product', key: 'Product', width: 20 },
    { header: 'Source Type', key: 'Source Type', width: 15 },
    { header: 'Source ID', key: 'Source ID', width: 20 },
    { header: 'Destination Location', key: 'Destination Location', width: 25 },
    { header: 'Priority', key: 'Priority', width: 10 },
    { header: 'Price', key: 'Price', width: 12 },
    { header: 'Notes', key: 'Notes', width: 30 },
    { header: 'Active', key: 'Active', width: 10 },
  ];
  const handleAssignmentDownloadTemplate = async () => {
    await exportToExcel([{
      Product: 'PRD-0001', 'Source Type': 'vendor', 'Source ID': 'VEN-0001',
      'Destination Location': 'LOC-0001', Priority: '1', Price: '10.00',
      Notes: '', Active: 'true',
    }], 'assignment_import_template.xlsx', 'Assignments', ASSIGNMENT_TEMPLATE_COLUMNS);
    toast.success('Template downloaded');
  };
  const handleAssignmentImport = async (file: File) => {
    if (!companyId) return;
    try {
      const rows = await readExcel(file);
      if (rows.length === 0) { toast.error('No data found in file'); return; }
      let imported = 0, failed = 0;
      setImportProgress({ open: true, total: rows.length, current: 0, imported: 0, failed: 0 });
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const productIdStr = row['Product']?.toString()?.trim();
        const sourceType = row['Source Type']?.toString()?.trim()?.toLowerCase();
        const sourceIdStr = row['Source ID']?.toString()?.trim();
        const destLocStr = row['Destination Location']?.toString()?.trim();
        if (!productIdStr || !sourceType || !sourceIdStr || !destLocStr) { failed++; setImportProgress(p => ({ ...p, current: i + 1, failed })); continue; }
        const productMatch = products.find(p => p.product_id === productIdStr);
        const destLoc = locations.find(l => l.location_id === destLocStr);
        if (!productMatch || !destLoc) { failed++; setImportProgress(p => ({ ...p, current: i + 1, failed })); continue; }
        let vendorId: string | null = null;
        let sourceLocationId: string | null = null;
        if (sourceType === 'vendor') {
          const v = vendors.find(v => v.vendor_id === sourceIdStr);
          if (!v) { failed++; setImportProgress(p => ({ ...p, current: i + 1, failed })); continue; }
          vendorId = v.id;
        } else {
          const l = locations.find(l => l.location_id === sourceIdStr);
          if (!l) { failed++; setImportProgress(p => ({ ...p, current: i + 1, failed })); continue; }
          sourceLocationId = l.id;
        }
        const { data: aid } = await supabase.rpc('generate_assignment_id', { p_company_id: companyId });
        const { error } = await supabase.from('assignments').insert({
          company_id: companyId, assignment_id: aid || `IMP-${Date.now()}`,
          product_id: productMatch.id, vendor_id: vendorId, source_location_id: sourceLocationId,
          destination_location_id: destLoc.id,
          priority: parseInt(row['Priority']?.toString()) || 1,
          price: parseFloat(row['Price']?.toString()) || 0,
          is_active: row['Active']?.toString()?.toLowerCase() !== 'false',
          notes: row['Notes']?.toString()?.trim() || null,
        });
        if (error) { failed++; } else { imported++; }
        setImportProgress(p => ({ ...p, current: i + 1, imported, failed }));
      }
      if (imported > 0) { toast.success(`Imported ${imported} assignment${imported > 1 ? 's' : ''}${failed > 0 ? ` (${failed} failed)` : ''}`); fetchAssignments(); }
      else { toast.error(`Import failed: ${failed} row${failed > 1 ? 's' : ''} could not be imported`); }
    } catch { toast.error('Failed to read file'); }
    finally { setTimeout(() => setImportProgress(p => ({ ...p, open: false })), 1500); }
  };
  const handleAssignmentExport = async () => {
    if (assignments.length === 0) { toast.info('No assignments to export'); return; }
    const data = assignments.map(a => ({
      'Assignment ID': a.assignment_id,
      Product: a.product?.product_id || '',
      'Source Type': a.vendor_id ? 'vendor' : 'location',
      'Source ID': a.vendor ? a.vendor.vendor_id : a.source_location?.location_id || '',
      'Destination Location': a.destination_location?.location_id || '',
      Priority: a.priority, Price: Number(a.price || 0).toFixed(2),
      Notes: a.notes || '', Active: a.is_active ? 'true' : 'false',
    }));
    await exportToExcel(data, `assignments_export_${new Date().toISOString().split('T')[0]}.xlsx`, 'Assignments');
    toast.success('Assignments exported');
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
              <ArrowLeft className="h-5 w-5" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
            </Button>
            <h1 className="text-xl font-semibold">Assignments</h1>
          </div>
          <div className="flex items-center gap-2 pr-12">
            <ImportExportButtons
              importEnabled={isImportEnabled('assignment')}
              exportEnabled={isExportEnabled('assignment')}
              onImport={handleAssignmentImport}
              onExport={handleAssignmentExport}
              onDownloadTemplate={handleAssignmentDownloadTemplate}
              entityName="Assignments"
            />
            <Button onClick={openNewAssignmentDialog} size="icon" className="relative">
              <Plus className="h-4 w-4" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
            </Button>
          </div>
        </div>
      </header>

      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <SortableTableHead
              label="Assignment ID"
              sortKey="assignment_id"
              currentSortKey={assignmentSortConfig.key}
              currentSortDirection={assignmentSortConfig.direction}
              onSort={handleAssignmentSort}
              filterValue={assignmentFilters['assignment_id'] || ''}
              onFilter={(value) => setAssignmentFilter('assignment_id', value)}
            />
            <TableHead>Product</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Destination Location</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAssignments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No assignments configured. Create your first assignment to define vendor fulfillment.
              </TableCell>
            </TableRow>
          ) : (
            sortedAssignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell className="font-mono">{assignment.assignment_id}</TableCell>
                <TableCell>{assignment.product ? `${assignment.product.product_id} - ${assignment.product.name}` : '-'}</TableCell>
                <TableCell>
                  {assignment.vendor
                    ? `${assignment.vendor.vendor_id} - ${assignment.vendor.name}`
                    : assignment.source_location
                      ? `${assignment.source_location.location_id} - ${assignment.source_location.name}`
                      : '-'}
                </TableCell>
                <TableCell>{assignment.destination_location?.name || '-'}</TableCell>
                <TableCell>{assignment.priority}</TableCell>
                <TableCell>{Number(assignment.price || 0).toFixed(2)}</TableCell>
                <TableCell><Checkbox checked={assignment.is_active} disabled /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditAssignmentDialog(assignment)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteAssignment(assignment)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Assignment Dialog */}
      <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'max-w-xl max-h-[85vh]'}`}>
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingAssignment ? 'Edit Assignment' : 'New Assignment'}</DialogTitle>
            <DialogDescription>
              {editingAssignment ? 'Update assignment configuration' : 'Assign a vendor to fulfill a product at a location'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-6">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assignment_id">Assignment ID *</Label>
                  <Input id="assignment_id" value={assignmentForm.assignment_id}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, assignment_id: e.target.value })}
                    disabled={!!editingAssignment} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignment_priority">Priority</Label>
                  <Input id="assignment_priority" type="number" min={1} value={assignmentForm.priority}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, priority: parseInt(e.target.value) || 1 })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Product *</Label>
                <SearchableSelect
                  options={products.map((p) => ({ value: p.id, label: `${p.product_id} - ${p.name}` }))}
                  value={assignmentForm.product_id}
                  onValueChange={(value) => setAssignmentForm({ ...assignmentForm, product_id: value })}
                  placeholder="Select product"
                />
              </div>

              <div className="space-y-2">
                <Label>Source (Vendor / Location) *</Label>
                <SearchableSelect
                  options={vendorOptions}
                  value={assignmentForm.source_value}
                  onValueChange={(value) => setAssignmentForm({ ...assignmentForm, source_value: value })}
                  placeholder="Select vendor or location"
                />
              </div>

              <div className="space-y-2">
                <Label>Destination Location *</Label>
                <SearchableSelect
                  options={locations.map((l) => ({ value: l.id, label: `${l.location_id} - ${l.name}` }))}
                  value={assignmentForm.destination_location_id}
                  onValueChange={(value) => setAssignmentForm({ ...assignmentForm, destination_location_id: value })}
                  placeholder="Select destination location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignment_price">Price</Label>
                <Input id="assignment_price" type="number" min={0} step="0.01" value={assignmentForm.price}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, price: parseFloat(e.target.value) || 0 })} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignment_notes">Notes</Label>
                <Input id="assignment_notes" value={assignmentForm.notes}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })} />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="assignment_is_active" checked={assignmentForm.is_active}
                  onCheckedChange={(checked) => setAssignmentForm({ ...assignmentForm, is_active: checked as boolean })} />
                <Label htmlFor="assignment_is_active">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button onClick={handleSaveAssignment}
              disabled={!assignmentForm.assignment_id || !assignmentForm.product_id || !assignmentForm.source_value || !assignmentForm.destination_location_id}>
              {editingAssignment ? 'Update' : 'Create'}
              <Kbd>⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Progress Dialog */}
      <Dialog open={importProgress.open}>
        <DialogContent draggable={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importing...</DialogTitle>
            <DialogDescription>Processing {importProgress.current} of {importProgress.total} rows</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6">
            <Progress value={importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span className="text-success">{importProgress.imported} imported</span>
              {importProgress.failed > 0 && <span className="text-destructive">{importProgress.failed} failed</span>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Assignments;

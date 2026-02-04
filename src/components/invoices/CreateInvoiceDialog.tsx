import { useEffect, useState, useMemo } from 'react';
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { Plus, Loader2, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  rate_type: string;
  is_default: boolean;
}

interface SelectedTaxRate {
  tax_rate_id: string;
  name: string;
  rate: number;
  rate_type: string;
}

interface Account {
  id: string;
  name: string;
  account_id: string;
  type: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  ledger_id: string | null;
  status: string;
}

interface SalesOrder {
  id: string;
  so_number: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  ledger_id: string | null;
  status: string;
}

interface ReferenceItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  product?: { name: string; product_id: string; price: number | null } | null;
}

interface Product {
  id: string;
  name: string;
  product_id: string;
  price: number | null;
  unit: string | null;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountId?: string;
  onSuccess?: () => void;
}

export const CreateInvoiceDialog = ({
  open,
  onOpenChange,
  defaultAccountId,
  onSuccess,
}: CreateInvoiceDialogProps) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([]);
  const [loadingReferenceItems, setLoadingReferenceItems] = useState(false);

  const [formData, setFormData] = useState({
    account_id: '',
    reference_type: 'purchase_order' as 'purchase_order' | 'sales_order',
    purchase_order_id: '',
    sales_order_id: '',
    invoice_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: '',
    notes: '',
  });

  const [invoiceItems, setInvoiceItems] = useState<{ product_id: string; quantity: number; unit_price: number; selected: boolean }[]>([]);
  const [selectedTaxRates, setSelectedTaxRates] = useState<SelectedTaxRate[]>([]);

  useSaveShortcut(() => {
    if (open && !isSubmitting) {
      handleCreate();
    }
  }, open);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId) {
      fetchAccounts();
      fetchPurchaseOrders();
      fetchSalesOrders();
      fetchProducts();
      fetchTaxRates();
    }
  }, [companyId]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const defaultRate = taxRates.find(r => r.is_default);
      setFormData({
        account_id: defaultAccountId || '',
        reference_type: 'purchase_order',
        purchase_order_id: '',
        sales_order_id: '',
        invoice_date: format(new Date(), 'yyyy-MM-dd'),
        due_date: '',
        notes: '',
      });
      setInvoiceItems([]);
      setReferenceItems([]);
      setSelectedTaxRates(defaultRate ? [{ tax_rate_id: defaultRate.id, name: defaultRate.name, rate: defaultRate.rate, rate_type: defaultRate.rate_type || 'percent' }] : []);
      setIsMaximized(false);
    }
  }, [open, defaultAccountId, taxRates]);

  const fetchCompanyId = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user!.id)
      .single();

    if (profile?.company_id) {
      setCompanyId(profile.company_id);
    }
  };

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts' as any)
      .select('id, name, account_id, type')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    setAccounts((data as any) || []);
  };

  const fetchPurchaseOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select('id, po_number, total_amount, subtotal, tax_amount, ledger_id, status')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setPurchaseOrders(data || []);
  };

  const fetchSalesOrders = async () => {
    const { data } = await supabase
      .from('sales_orders' as any)
      .select('id, so_number, total_amount, subtotal, tax_amount, ledger_id, status')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setSalesOrders((data as any) || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, product_id, price, unit')
      .eq('company_id', companyId)
      .order('name');
    setProducts(data || []);
  };

  const fetchTaxRates = async () => {
    const { data } = await supabase
      .from('tax_rates')
      .select('id, name, rate, rate_type, is_default')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    setTaxRates(data || []);
  };

  const calculateDueDate = (invoiceDate: string, paymentTerms: number | null): string => {
    const terms = paymentTerms ?? 30;
    const date = new Date(invoiceDate);
    date.setDate(date.getDate() + terms);
    return format(date, 'yyyy-MM-dd');
  };

  const fetchReferenceItems = async () => {
    setLoadingReferenceItems(true);
    setReferenceItems([]);
    setInvoiceItems([]);

    try {
      if (formData.reference_type === 'purchase_order' && formData.purchase_order_id) {
        // Fetch PO with vendor payment terms
        const { data: poData } = await supabase
          .from('purchase_orders')
          .select('vendor_id, vendor:vendors(payment_terms)')
          .eq('id', formData.purchase_order_id)
          .single();
        
        const paymentTerms = (poData as any)?.vendor?.payment_terms ?? null;
        const dueDate = calculateDueDate(formData.invoice_date, paymentTerms);
        setFormData(prev => ({ ...prev, due_date: dueDate }));

        const { data } = await supabase
          .from('purchase_order_items')
          .select('id, product_id, quantity, unit_price, total_price, product:products(name, product_id, price)')
          .eq('purchase_order_id', formData.purchase_order_id);
        
        const items = (data as any[] || []) as ReferenceItem[];
        setReferenceItems(items);
        setInvoiceItems(items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price || item.product?.price || 0,
          selected: true
        })));

        const { data: poTaxRates } = await supabase
          .from('purchase_order_tax_rates' as any)
          .select('tax_rate_id, tax_rate:tax_rates(name, rate, rate_type)')
          .eq('purchase_order_id', formData.purchase_order_id);
        
        if (poTaxRates && poTaxRates.length > 0) {
          setSelectedTaxRates((poTaxRates as any[]).map((tr: any) => ({
            tax_rate_id: tr.tax_rate_id,
            name: tr.tax_rate?.name || '',
            rate: tr.tax_rate?.rate || 0,
            rate_type: tr.tax_rate?.rate_type || 'percent'
          })));
        }
      } else if (formData.reference_type === 'sales_order' && formData.sales_order_id) {
        // Fetch SO with customer payment terms
        const { data: soData } = await supabase
          .from('sales_orders' as any)
          .select('customer_id, customer:customers(payment_terms)')
          .eq('id', formData.sales_order_id)
          .single();
        
        const paymentTerms = (soData as any)?.customer?.payment_terms ?? null;
        const dueDate = calculateDueDate(formData.invoice_date, paymentTerms);
        setFormData(prev => ({ ...prev, due_date: dueDate }));

        const { data } = await supabase
          .from('sales_order_items' as any)
          .select('id, product_id, quantity, unit_price, total_price, product:products(name, product_id, price)')
          .eq('sales_order_id', formData.sales_order_id);
        
        const items = (data as any[] || []) as ReferenceItem[];
        setReferenceItems(items);
        setInvoiceItems(items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price || item.product?.price || 0,
          selected: true
        })));

        const { data: soTaxRates } = await supabase
          .from('sales_order_tax_rates' as any)
          .select('tax_rate_id, tax_rate:tax_rates(name, rate, rate_type)')
          .eq('sales_order_id', formData.sales_order_id);
        
        if (soTaxRates && soTaxRates.length > 0) {
          setSelectedTaxRates((soTaxRates as any[]).map((tr: any) => ({
            tax_rate_id: tr.tax_rate_id,
            name: tr.tax_rate?.name || '',
            rate: tr.tax_rate?.rate || 0,
            rate_type: tr.tax_rate?.rate_type || 'percent'
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching reference items:', error);
    } finally {
      setLoadingReferenceItems(false);
    }
  };

  useEffect(() => {
    if ((formData.reference_type === 'purchase_order' && formData.purchase_order_id) ||
        (formData.reference_type === 'sales_order' && formData.sales_order_id)) {
      fetchReferenceItems();
    } else {
      setReferenceItems([]);
      setInvoiceItems([]);
    }
  }, [formData.purchase_order_id, formData.sales_order_id, formData.reference_type]);

  const accountOptions: SearchableSelectOption[] = useMemo(() => {
    return accounts.map((a) => ({
      value: a.id,
      label: a.name,
      sublabel: `${a.account_id} • ${a.type}`,
    }));
  }, [accounts]);

  const poOptions: SearchableSelectOption[] = useMemo(() => {
    return purchaseOrders.map((po) => ({
      value: po.id,
      label: po.po_number,
      sublabel: `$${po.total_amount?.toFixed(2) || '0.00'} • ${po.status}`,
    }));
  }, [purchaseOrders]);

  const soOptions: SearchableSelectOption[] = useMemo(() => {
    return salesOrders.map((so) => ({
      value: so.id,
      label: so.so_number,
      sublabel: `$${so.total_amount?.toFixed(2) || '0.00'} • ${so.status}`,
    }));
  }, [salesOrders]);

  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return products.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: `$${p.price?.toFixed(2) || '0.00'}`,
    }));
  }, [products]);

  const selectedItems = useMemo(() => invoiceItems.filter(item => item.selected), [invoiceItems]);
  
  const subtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [selectedItems]);

  const taxCalculations = useMemo(() => {
    const percentRates = selectedTaxRates.filter(r => r.rate_type === 'percent');
    const flatRates = selectedTaxRates.filter(r => r.rate_type === 'flat');
    
    const percentTaxes = percentRates.map(rate => ({
      ...rate,
      amount: subtotal * (rate.rate / 100)
    }));
    
    const flatTaxes = flatRates.map(rate => ({
      ...rate,
      amount: rate.rate
    }));
    
    return [...percentTaxes, ...flatTaxes];
  }, [selectedTaxRates, subtotal]);

  const totalTax = useMemo(() => {
    return taxCalculations.reduce((sum, calc) => sum + calc.amount, 0);
  }, [taxCalculations]);

  const grandTotal = subtotal + totalTax;

  const addInvoiceItem = () => {
    setInvoiceItems([...invoiceItems, { product_id: '', quantity: 1, unit_price: 0, selected: true }]);
  };

  const updateInvoiceItem = (index: number, field: string, value: any) => {
    const updated = [...invoiceItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated[index].unit_price = product.price || 0;
      }
    }
    
    setInvoiceItems(updated);
  };

  const removeInvoiceItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const toggleTaxRate = (rate: TaxRate) => {
    const exists = selectedTaxRates.find(r => r.tax_rate_id === rate.id);
    if (exists) {
      setSelectedTaxRates(selectedTaxRates.filter(r => r.tax_rate_id !== rate.id));
    } else {
      setSelectedTaxRates([...selectedTaxRates, { 
        tax_rate_id: rate.id, 
        name: rate.name, 
        rate: rate.rate, 
        rate_type: rate.rate_type || 'percent' 
      }]);
    }
  };

  const handleCreate = async () => {
    if (!formData.account_id) {
      toast.error('Please select an account');
      return;
    }

    const hasReference =
      (formData.reference_type === 'purchase_order' && formData.purchase_order_id) ||
      (formData.reference_type === 'sales_order' && formData.sales_order_id);

    if (!hasReference) {
      toast.error('Please select a Purchase Order or Sales Order');
      return;
    }

    if (selectedItems.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: invoiceNumber } = await supabase.rpc('get_next_invoice_number', {
        p_company_id: companyId,
      });

      let ledgerId: string | null = null;

      if (formData.reference_type === 'purchase_order' && formData.purchase_order_id) {
        const po = purchaseOrders.find((p) => p.id === formData.purchase_order_id);
        ledgerId = po?.ledger_id || null;
      } else if (formData.reference_type === 'sales_order' && formData.sales_order_id) {
        const so = salesOrders.find((s) => s.id === formData.sales_order_id);
        ledgerId = so?.ledger_id || null;
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices' as any)
        .insert({
          company_id: companyId,
          invoice_number: invoiceNumber,
          account_id: formData.account_id,
          purchase_order_id: formData.reference_type === 'purchase_order' ? formData.purchase_order_id : null,
          sales_order_id: formData.reference_type === 'sales_order' ? formData.sales_order_id : null,
          ledger_id: ledgerId,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date || null,
          subtotal,
          tax_amount: totalTax,
          amount: grandTotal,
          status: 'pending',
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const itemsToInsert = selectedItems.map(item => ({
        invoice_id: (invoice as any).id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
      }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items' as any)
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      if (selectedTaxRates.length > 0) {
        const taxRatesToInsert = taxCalculations.map(calc => ({
          invoice_id: (invoice as any).id,
          tax_rate_id: calc.tax_rate_id,
          tax_amount: calc.amount,
        }));

        const { error: taxError } = await supabase
          .from('invoice_tax_rates' as any)
          .insert(taxRatesToInsert);
        if (taxError) throw taxError;
      }

      if (ledgerId) {
        const transactionAmount = formData.reference_type === 'sales_order' ? grandTotal : -grandTotal;
        const referenceNumber =
          formData.reference_type === 'purchase_order'
            ? purchaseOrders.find((p) => p.id === formData.purchase_order_id)?.po_number
            : salesOrders.find((s) => s.id === formData.sales_order_id)?.so_number;

        const { error: txError } = await supabase.from('ledger_transactions' as any).insert({
          ledger_id: ledgerId,
          transaction_type: 'invoice',
          reference_id: (invoice as any).id,
          reference_number: invoiceNumber,
          amount: transactionAmount,
          description: `Invoice ${invoiceNumber} for ${referenceNumber}`,
        });

        if (txError) {
          console.error('Error creating ledger transaction:', txError);
        }
      }

      toast.success('Invoice created successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'max-w-3xl max-h-[85vh]'}`}>
        <button
          type="button"
          onClick={() => setIsMaximized(!isMaximized)}
          className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Create a new invoice linked to a PO or SO
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pb-6">
          {/* Header Fields */}
          <div className="grid grid-cols-3 gap-4 pb-4 border-b px-6">
            <div className="space-y-2">
              <Label>Account *</Label>
              <SearchableSelect
                options={accountOptions}
                value={formData.account_id}
                onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                placeholder="Select account"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Reference Type *</Label>
              <Select
                value={formData.reference_type}
                onValueChange={(value: 'purchase_order' | 'sales_order') =>
                  setFormData({
                    ...formData,
                    reference_type: value,
                    purchase_order_id: '',
                    sales_order_id: '',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="purchase_order">Purchase Order</SelectItem>
                  <SelectItem value="sales_order">Sales Order</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.reference_type === 'purchase_order' ? (
              <div className="space-y-2">
                <Label>Purchase Order *</Label>
                <SearchableSelect
                  options={poOptions}
                  value={formData.purchase_order_id}
                  onValueChange={(value) => setFormData({ ...formData, purchase_order_id: value })}
                  placeholder="Select PO"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Sales Order *</Label>
                <SearchableSelect
                  options={soOptions}
                  value={formData.sales_order_id}
                  onValueChange={(value) => setFormData({ ...formData, sales_order_id: value })}
                  placeholder="Select SO"
                />
              </div>
            )}
          </div>

          {/* Second Row Header Fields */}
          <div className="grid grid-cols-3 gap-4 py-4 border-b px-6">
            <div className="space-y-2">
              <Label>Invoice Date *</Label>
              <Input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="items" className="w-full px-6">
            <TabsList className="grid w-full grid-cols-4 mt-4">
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="rates">Rates</TabsTrigger>
              <TabsTrigger value="reference">Reference</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label>Invoice Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addInvoiceItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              {invoiceItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  No items added yet. Select a PO/SO to auto-populate or click "Add Item".
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="w-[40%]">Product</TableHead>
                        <TableHead className="w-[15%] text-right">Qty</TableHead>
                        <TableHead className="w-[18%] text-right">Unit Price</TableHead>
                        <TableHead className="w-[15%] text-right">Total</TableHead>
                        <TableHead className="w-[5%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceItems.map((item, index) => (
                        <TableRow key={index} className={!item.selected ? 'opacity-50' : ''}>
                          <TableCell className="p-2">
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={(checked) => updateInvoiceItem(index, 'selected', checked)}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <SearchableSelect
                              options={productOptions}
                              value={item.product_id}
                              onValueChange={(value) => updateInvoiceItem(index, 'product_id', value)}
                              placeholder="Select product"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateInvoiceItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="text-right"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateInvoiceItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="text-right"
                            />
                          </TableCell>
                          <TableCell className="p-2 text-right font-mono">
                            ${(item.quantity * item.unit_price).toFixed(2)}
                          </TableCell>
                          <TableCell className="p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeInvoiceItem(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-end gap-8 text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono">${subtotal.toFixed(2)}</span>
                </div>
                {taxCalculations.filter(c => c.rate_type === 'percent').map((calc) => (
                  <div key={calc.tax_rate_id} className="flex justify-end gap-8 text-sm">
                    <span className="text-muted-foreground">
                      {calc.name} ({calc.rate}%):
                    </span>
                    <span className="font-mono">
                      ${calc.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
                {taxCalculations.filter(c => c.rate_type === 'percent').length === 0 && (
                  <div className="flex justify-end gap-8 text-sm">
                    <span className="text-muted-foreground">Tax:</span>
                    <span className="font-mono">$0.00</span>
                  </div>
                )}
                {taxCalculations.filter(c => c.rate_type === 'flat').map((calc) => (
                  <div key={calc.tax_rate_id} className="flex justify-end gap-8 text-sm">
                    <span className="text-muted-foreground">
                      {calc.name} (Fee):
                    </span>
                    <span className="font-mono">
                      ${calc.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-end gap-8 text-base font-semibold">
                  <span>Total:</span>
                  <span className="font-mono">${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rates" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label>Tax Rates</Label>
                {taxRates.filter(r => !selectedTaxRates.find(sr => sr.tax_rate_id === r.id)).length > 0 && (
                  <Select onValueChange={(id) => {
                    const rate = taxRates.find(r => r.id === id);
                    if (rate) toggleTaxRate(rate);
                  }}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Add tax rate" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {taxRates.filter(r => !selectedTaxRates.find(sr => sr.tax_rate_id === r.id)).map((rate) => (
                        <SelectItem key={rate.id} value={rate.id}>
                          {rate.name} ({rate.rate_type === 'flat' ? `$${rate.rate.toFixed(2)}` : `${rate.rate}%`})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {selectedTaxRates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  No tax rates applied
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedTaxRates.map((sr) => (
                    <Badge key={sr.tax_rate_id} variant="secondary" className="flex items-center gap-1 py-1">
                      {sr.name} ({sr.rate_type === 'flat' ? `$${sr.rate.toFixed(2)}` : `${sr.rate}%`})
                      <button
                        type="button"
                        onClick={() => toggleTaxRate({ id: sr.tax_rate_id, name: sr.name, rate: sr.rate, rate_type: sr.rate_type, is_default: false })}
                        className="ml-1 hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {selectedTaxRates.some(r => r.rate_type === 'percent') && (
                <div className="text-sm text-muted-foreground">
                  Combined percentage rate: {selectedTaxRates.filter(r => r.rate_type === 'percent').reduce((sum, r) => sum + r.rate, 0).toFixed(2)}%
                </div>
              )}
            </TabsContent>

            <TabsContent value="reference" className="space-y-4 mt-4">
              {!formData.purchase_order_id && !formData.sales_order_id ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  Select a Purchase Order or Sales Order above to see reference items
                </p>
              ) : loadingReferenceItems ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : referenceItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  No line items found in the selected order
                </p>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Reference items from the selected {formData.reference_type === 'purchase_order' ? 'Purchase Order' : 'Sales Order'}. 
                    These have been automatically added to the Items tab.
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {referenceItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <span className="font-medium">{item.product?.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">{item.product?.product_id}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                            <TableCell className="text-right font-mono">${(item.unit_price || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">${(item.total_price || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Invoice Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes or special instructions for this invoice..."
                  rows={6}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
          <Button onClick={handleCreate} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Invoice
            <Kbd className="ml-2">⌘S</Kbd>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

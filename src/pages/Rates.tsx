import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Percent, Plus, Loader2, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

const Rates = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    rate: '',
    description: '',
    is_default: false,
    is_active: true,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId) {
      fetchTaxRates();
    }
  }, [companyId]);

  const fetchCompanyId = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user!.id)
      .single();

    if (profile?.company_id) {
      setCompanyId(profile.company_id);
    }
    setLoading(false);
  };

  const fetchTaxRates = async () => {
    const { data, error } = await supabase
      .from('tax_rates')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (error) {
      console.error('Error fetching tax rates:', error);
      toast.error('Failed to load tax rates');
      return;
    }

    setTaxRates(data || []);
  };

  const handleAddClick = () => {
    setEditingRate(null);
    setFormData({
      name: '',
      rate: '',
      description: '',
      is_default: false,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleEditClick = (rate: TaxRate) => {
    setEditingRate(rate);
    setFormData({
      name: rate.name,
      rate: rate.rate.toString(),
      description: rate.description || '',
      is_default: rate.is_default,
      is_active: rate.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    const rateValue = parseFloat(formData.rate);
    if (isNaN(rateValue) || rateValue < 0 || rateValue > 100) {
      toast.error('Please enter a valid rate between 0 and 100');
      return;
    }

    setIsSubmitting(true);

    try {
      // If setting as default, unset other defaults first
      if (formData.is_default) {
        await supabase
          .from('tax_rates')
          .update({ is_default: false })
          .eq('company_id', companyId)
          .eq('is_default', true);
      }

      if (editingRate) {
        // Update existing
        const { error } = await supabase
          .from('tax_rates')
          .update({
            name: formData.name.trim(),
            rate: rateValue,
            description: formData.description.trim() || null,
            is_default: formData.is_default,
            is_active: formData.is_active,
          })
          .eq('id', editingRate.id);

        if (error) throw error;
        toast.success('Tax rate updated');
      } else {
        // Create new
        const { error } = await supabase
          .from('tax_rates')
          .insert({
            company_id: companyId,
            name: formData.name.trim(),
            rate: rateValue,
            description: formData.description.trim() || null,
            is_default: formData.is_default,
            is_active: formData.is_active,
          });

        if (error) throw error;
        toast.success('Tax rate created');
      }

      setIsDialogOpen(false);
      fetchTaxRates();
    } catch (error: any) {
      console.error('Error saving tax rate:', error);
      toast.error(error.message || 'Failed to save tax rate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tax rate?')) return;

    const { error } = await supabase
      .from('tax_rates')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete tax rate');
      return;
    }

    toast.success('Tax rate deleted');
    fetchTaxRates();
  };

  const handleToggleActive = async (rate: TaxRate) => {
    const { error } = await supabase
      .from('tax_rates')
      .update({ is_active: !rate.is_active })
      .eq('id', rate.id);

    if (error) {
      toast.error('Failed to update tax rate');
      return;
    }

    fetchTaxRates();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-display font-bold text-foreground">Tax Rates</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAddClick} variant="default">
                <Plus className="w-4 h-4 mr-2" />
                Add Rate
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {taxRates.length === 0 ? (
          <div className="text-center py-12">
            <Percent className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No tax rates yet</h3>
            <p className="text-muted-foreground mb-4">
              Create tax rates to apply to purchase orders
            </p>
            <Button onClick={handleAddClick}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Tax Rate
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">
                      {rate.name}
                      {rate.is_default && (
                        <Badge variant="secondary" className="ml-2">Default</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{rate.rate}%</TableCell>
                    <TableCell className="text-muted-foreground">{rate.description || '-'}</TableCell>
                    <TableCell>
                      <Badge className={rate.is_active ? 'bg-green-500 text-white' : 'bg-slate-500 text-white'}>
                        {rate.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(rate)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleToggleActive(rate)}>
                              {rate.is_active ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(rate.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRate ? 'Edit Tax Rate' : 'Add Tax Rate'}</DialogTitle>
            <DialogDescription>
              {editingRate ? 'Update the tax rate details' : 'Create a new tax rate for purchase orders'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Tax, VAT, GST"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Rate (%) *</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                placeholder="e.g., 10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_default">Default Rate</Label>
                <p className="text-sm text-muted-foreground">Use as default for new orders</p>
              </div>
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active</Label>
                <p className="text-sm text-muted-foreground">Available for use in orders</p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingRate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Rates;
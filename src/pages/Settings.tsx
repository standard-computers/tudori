import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Kbd } from '@/components/ui/kbd';
import { ArrowLeft, Building2, Save, Loader2, Settings2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

interface Company {
  id: string;
  name: string;
  industry: string | null;
  size: string | null;
  website: string | null;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface DocumentIdConfig {
  id?: string;
  company_id: string;
  document_type: string;
  prefix: string;
  num_digits: number;
  starting_number: number;
}

const DOCUMENT_TYPES = [
  { value: 'purchase_order', label: 'Purchase Order', prefix_placeholder: 'PO-' },
  { value: 'requisition', label: 'Requisition', prefix_placeholder: 'REQ-' },
  { value: 'delivery', label: 'Delivery', prefix_placeholder: 'DEL-' },
  { value: 'vendor', label: 'Vendor', prefix_placeholder: '' },
  { value: 'customer', label: 'Customer', prefix_placeholder: '' },
  { value: 'product', label: 'Product', prefix_placeholder: '' },
  { value: 'location', label: 'Location', prefix_placeholder: '' },
];

type AppRole = Database['public']['Enums']['app_role'];

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [documentConfigs, setDocumentConfigs] = useState<DocumentIdConfig[]>([]);
  const [activeTab, setActiveTab] = useState('company');
  const [currentUserRole, setCurrentUserRole] = useState<AppRole | null>(null);

  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';

  // Ctrl+S to save based on active tab (only for admins)
  useSaveShortcut(() => {
    if (!isAdmin) return;
    if (activeTab === 'company' && company && !saving) {
      handleSaveCompany();
    } else if (activeTab === 'config' && !savingConfig) {
      handleSaveConfigs();
    }
  }, isAdmin);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    size: '',
    website: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: ''
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompany();
    }
  }, [user]);

  const fetchCompany = async () => {
    try {
      // First get user's company_id from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (profile?.company_id) {
        // Fetch user's role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user!.id)
          .eq('company_id', profile.company_id)
          .single();

        setCurrentUserRole(roleData?.role || null);

        const { data: companyData, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single();

        if (error) throw error;

        if (companyData) {
          setCompany(companyData);
          setFormData({
            name: companyData.name || '',
            industry: companyData.industry || '',
            size: companyData.size || '',
            website: companyData.website || '',
            phone: companyData.phone || '',
            address_line1: companyData.address_line1 || '',
            address_line2: companyData.address_line2 || '',
            city: companyData.city || '',
            state: companyData.state || '',
            postal_code: companyData.postal_code || '',
            country: companyData.country || ''
          });

          // Fetch document configs
          await fetchDocumentConfigs(profile.company_id);
        }
      }
    } catch (error) {
      console.error('Error fetching company:', error);
      toast.error('Failed to load company information');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentConfigs = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('document_id_config')
        .select('*')
        .eq('company_id', companyId);

      if (error) throw error;

      // Initialize configs for all document types
      const configs: DocumentIdConfig[] = DOCUMENT_TYPES.map(docType => {
        const existingConfig = data?.find(c => c.document_type === docType.value);
        return existingConfig || {
          company_id: companyId,
          document_type: docType.value,
          prefix: docType.prefix_placeholder,
          num_digits: 4,
          starting_number: 1
        };
      });

      setDocumentConfigs(configs);
    } catch (error) {
      console.error('Error fetching document configs:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleConfigChange = (
    docType: string,
    field: 'prefix' | 'num_digits' | 'starting_number',
    value: string | number
  ) => {
    setDocumentConfigs(prev =>
      prev.map(config =>
        config.document_type === docType
          ? { ...config, [field]: value }
          : config
      )
    );
  };

  const handleSaveCompany = async () => {
    if (!company) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: formData.name,
          industry: formData.industry || null,
          size: formData.size || null,
          website: formData.website || null,
          phone: formData.phone || null,
          address_line1: formData.address_line1,
          address_line2: formData.address_line2 || null,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code,
          country: formData.country
        })
        .eq('id', company.id);

      if (error) throw error;

      toast.success('Company information updated');
    } catch (error: any) {
      console.error('Error updating company:', error);
      toast.error(error.message || 'Failed to update company information');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfigs = async () => {
    if (!company) return;

    setSavingConfig(true);
    try {
      // Upsert all configs
      for (const config of documentConfigs) {
        if (config.id) {
          // Update existing
          const { error } = await supabase
            .from('document_id_config')
            .update({
              prefix: config.prefix,
              num_digits: config.num_digits,
              starting_number: config.starting_number
            })
            .eq('id', config.id);

          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase
            .from('document_id_config')
            .insert({
              company_id: company.id,
              document_type: config.document_type,
              prefix: config.prefix,
              num_digits: config.num_digits,
              starting_number: config.starting_number
            });

          if (error) throw error;
        }
      }

      // Refresh configs to get IDs
      await fetchDocumentConfigs(company.id);
      toast.success('Document ID configuration saved');
    } catch (error: any) {
      console.error('Error saving document configs:', error);
      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const getPreviewId = (config: DocumentIdConfig): string => {
    const paddedNumber = String(config.starting_number).padStart(config.num_digits, '0');
    return `${config.prefix}${paddedNumber}`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Access denied view for non-admins
  if (!isAdmin && !loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-500 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-display font-bold text-foreground">Settings</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Access Denied */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <ShieldAlert className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground max-w-md">
                  Only administrators and owners can view and edit company settings. 
                  Please contact your administrator if you need access.
                </p>
                <Button className="mt-6" onClick={() => navigate('/dashboard')}>
                  Return to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-500 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-display font-bold text-foreground">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="preferences" disabled>Preferences</TabsTrigger>
            <TabsTrigger value="billing" disabled>Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-6">
            {!company ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center py-8">
                    No company information found. Please complete your profile setup.
                  </p>
                  <div className="flex justify-center">
                    <Button onClick={() => navigate('/complete-profile')}>
                      Complete Setup
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Company Details Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Company Details</CardTitle>
                    <CardDescription>
                      Update your company's basic information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Company Name *</Label>
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Acme Inc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="industry">Industry</Label>
                        <Input
                          id="industry"
                          name="industry"
                          value={formData.industry}
                          onChange={handleInputChange}
                          placeholder="Technology"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="size">Company Size</Label>
                        <Input
                          id="size"
                          name="size"
                          value={formData.size}
                          onChange={handleInputChange}
                          placeholder="1-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          name="website"
                          value={formData.website}
                          onChange={handleInputChange}
                          placeholder="https://example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Address Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Address</CardTitle>
                    <CardDescription>
                      Your company's physical address
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address_line1">Address Line 1 *</Label>
                      <Input
                        id="address_line1"
                        name="address_line1"
                        value={formData.address_line1}
                        onChange={handleInputChange}
                        placeholder="123 Main St"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address_line2">Address Line 2</Label>
                      <Input
                        id="address_line2"
                        name="address_line2"
                        value={formData.address_line2}
                        onChange={handleInputChange}
                        placeholder="Suite 100"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          placeholder="San Francisco"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State *</Label>
                        <Input
                          id="state"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          placeholder="CA"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postal_code">Postal Code *</Label>
                        <Input
                          id="postal_code"
                          name="postal_code"
                          value={formData.postal_code}
                          onChange={handleInputChange}
                          placeholder="94102"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country *</Label>
                      <Input
                        id="country"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        placeholder="United States"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button onClick={handleSaveCompany} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                        <Kbd className="ml-2">⌘S</Kbd>
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Changing the prefix, number of digits, or starting number after documents have already been created may result in duplicate IDs or gaps in your numbering sequence. Proceed with caution.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle>Document ID Configuration</CardTitle>
                    <CardDescription>
                      Configure how document IDs are generated for each document type
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Number of Digits</TableHead>
                      <TableHead>Starting Number</TableHead>
                      <TableHead>Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentConfigs.map((config) => {
                      const docTypeInfo = DOCUMENT_TYPES.find(d => d.value === config.document_type);
                      return (
                        <TableRow key={config.document_type}>
                          <TableCell className="font-medium">
                            {docTypeInfo?.label || config.document_type}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={config.prefix}
                              onChange={(e) =>
                                handleConfigChange(config.document_type, 'prefix', e.target.value)
                              }
                              placeholder="e.g., PO-"
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={String(config.num_digits)}
                              onValueChange={(value) =>
                                handleConfigChange(config.document_type, 'num_digits', parseInt(value))
                              }
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="4">4</SelectItem>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="6">6</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={config.starting_number}
                              onChange={(e) =>
                                handleConfigChange(
                                  config.document_type,
                                  'starting_number',
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                              {getPreviewId(config)}
                            </code>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveConfigs} disabled={savingConfig}>
                {savingConfig ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                    <Kbd className="ml-2">⌘S</Kbd>
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>Coming soon</CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Billing</CardTitle>
                <CardDescription>Coming soon</CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;
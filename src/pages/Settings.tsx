import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Kbd } from '@/components/ui/kbd';
import { ArrowLeft, Building2, Save, Loader2, Settings2, AlertTriangle, ShieldAlert, Upload, X, FileText, ShoppingCart, Truck, Book, Users, Package, MapPin, UserCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  logo_url: string | null;
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
  { value: 'purchase_order', label: 'Purchase Order', prefix_placeholder: '', icon: ShoppingCart },
  { value: 'requisition', label: 'Requisition', prefix_placeholder: '', icon: FileText },
  { value: 'delivery', label: 'Delivery', prefix_placeholder: '', icon: Truck },
  { value: 'ledger', label: 'Ledger', prefix_placeholder: '', icon: Book },
  { value: 'vendor', label: 'Vendor', prefix_placeholder: '', icon: Users },
  { value: 'customer', label: 'Customer', prefix_placeholder: '', icon: UserCheck },
  { value: 'product', label: 'Product', prefix_placeholder: '', icon: Package },
  { value: 'location', label: 'Location', prefix_placeholder: '', icon: MapPin },
];

interface POAutomationSettings {
  auto_create_delivery_on_confirmed: boolean;
  auto_mark_delivery_shipped: boolean;
  auto_mark_delivery_delivered: boolean;
}

type AppRole = Database['public']['Enums']['app_role'];
type UserRoleEntry = { role: AppRole };

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [documentConfigs, setDocumentConfigs] = useState<DocumentIdConfig[]>([]);
  const [activeTab, setActiveTab] = useState('company');
  const [activeConfigTab, setActiveConfigTab] = useState('purchase_order');
  const [currentUserRoles, setCurrentUserRoles] = useState<AppRole[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [poSettings, setPOSettings] = useState<POAutomationSettings>({
    auto_create_delivery_on_confirmed: true,
    auto_mark_delivery_shipped: true,
    auto_mark_delivery_delivered: true,
  });
  const [savingPOSettings, setSavingPOSettings] = useState(false);

  // Set transaction based on active tab
  useEffect(() => {
    setTransaction(`set/${activeTab}`);
  }, [activeTab, setTransaction]);

  const isAdmin = currentUserRoles.includes('owner') || currentUserRoles.includes('admin');
  const isIT = currentUserRoles.includes('it');

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
        // Fetch user's roles (user can have multiple roles like owner + it)
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user!.id)
          .eq('company_id', profile.company_id);

        const roles = (roleData as UserRoleEntry[] | null)?.map(r => r.role) || [];
        setCurrentUserRoles(roles);

        const { data: companyData, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single();

        if (error) throw error;

        if (companyData) {
          setCompany(companyData);
          setLogoPreview(companyData.logo_url || null);
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

          // Fetch document configs and PO settings
          await fetchDocumentConfigs(profile.company_id);
          await fetchPOSettings(profile.company_id);
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

  const fetchPOSettings = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', companyId)
        .eq('setting_key', 'po_automation')
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value && typeof data.setting_value === 'object' && !Array.isArray(data.setting_value)) {
        const val = data.setting_value as Record<string, unknown>;
        setPOSettings({
          auto_create_delivery_on_confirmed: (val.auto_create_delivery_on_confirmed as boolean) ?? true,
          auto_mark_delivery_shipped: (val.auto_mark_delivery_shipped as boolean) ?? true,
          auto_mark_delivery_delivered: (val.auto_mark_delivery_delivered as boolean) ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching PO settings:', error);
    }
  };

  const handleSavePOSettings = async () => {
    if (!company) return;

    setSavingPOSettings(true);
    try {
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .eq('company_id', company.id)
        .eq('setting_key', 'po_automation')
        .maybeSingle();

      const settingValue = {
        auto_create_delivery_on_confirmed: poSettings.auto_create_delivery_on_confirmed,
        auto_mark_delivery_shipped: poSettings.auto_mark_delivery_shipped,
        auto_mark_delivery_delivered: poSettings.auto_mark_delivery_delivered,
      };

      if (existing) {
        await supabase
          .from('company_settings')
          .update({ setting_value: settingValue })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('company_settings')
          .insert([{
            company_id: company.id,
            setting_key: 'po_automation',
            setting_value: settingValue,
          }]);
      }

      toast.success('PO automation settings saved');
    } catch (error: any) {
      console.error('Error saving PO settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSavingPOSettings(false);
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Logo must be less than 5MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = async () => {
    if (!company) return;
    
    setUploadingLogo(true);
    try {
      // Delete from storage if exists
      if (company.logo_url) {
        const fileName = company.logo_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('company-logos').remove([`${company.id}/${fileName}`]);
        }
      }
      
      // Update company
      await supabase
        .from('companies')
        .update({ logo_url: null })
        .eq('id', company.id);
      
      setLogoFile(null);
      setLogoPreview(null);
      setCompany({ ...company, logo_url: null });
      toast.success('Logo removed');
    } catch (error) {
      toast.error('Failed to remove logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !company) return company?.logo_url || null;
    
    const fileExt = logoFile.name.split('.').pop();
    const fileName = `logo-${Date.now()}.${fileExt}`;
    const filePath = `${company.id}/${fileName}`;
    
    // Delete old logo if exists
    if (company.logo_url) {
      const oldFileName = company.logo_url.split('/').pop();
      if (oldFileName) {
        await supabase.storage.from('company-logos').remove([`${company.id}/${oldFileName}`]);
      }
    }
    
    const { error } = await supabase.storage
      .from('company-logos')
      .upload(filePath, logoFile);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('company-logos')
      .getPublicUrl(filePath);
    
    return publicUrl;
  };

  const handleSaveCompany = async () => {
    if (!company) return;
    
    setSaving(true);
    try {
      // Upload logo if changed
      let logoUrl = company.logo_url;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

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
          country: formData.country,
          logo_url: logoUrl
        })
        .eq('id', company.id);

      if (error) throw error;

      setCompany({ ...company, logo_url: logoUrl });
      setLogoFile(null);
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
                <Building2 className="w-7 h-7 text-slate-500" />
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
              <Building2 className="w-7 h-7 text-slate-500" />
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
                  <CardContent className="space-y-6">
                    {/* Logo Upload */}
                    <div className="space-y-2">
                      <Label>Company Logo</Label>
                      <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20 rounded-xl border-2 border-border">
                          {logoPreview ? (
                            <AvatarImage src={logoPreview} alt="Company logo" className="object-cover" />
                          ) : (
                            <AvatarFallback className="rounded-xl bg-primary text-primary-foreground text-2xl font-bold">
                              {formData.name ? formData.name[0].toUpperCase() : 'C'}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById('logo-upload')?.click()}
                              disabled={uploadingLogo}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              {logoPreview ? 'Change' : 'Upload'}
                            </Button>
                            {logoPreview && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleRemoveLogo}
                                disabled={uploadingLogo}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="w-4 h-4 mr-1" />
                                Remove
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            JPG, PNG, WebP or SVG. Max 5MB.
                          </p>
                        </div>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                      </div>
                    </div>

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
            {!isIT ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                      <ShieldAlert className="w-8 h-8 text-destructive" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">IT Access Required</h2>
                    <p className="text-muted-foreground max-w-md">
                      Only users with the IT role can modify document ID configuration and company settings.
                      Please contact your IT administrator if you need access.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    Changing the prefix, number of digits, or starting number after documents have already been created may result in duplicate IDs or gaps in your numbering sequence. Proceed with caution.
                  </AlertDescription>
                </Alert>

            <Tabs value={activeConfigTab} onValueChange={setActiveConfigTab}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                {DOCUMENT_TYPES.map((docType) => {
                  const Icon = docType.icon;
                  return (
                    <TabsTrigger key={docType.value} value={docType.value} className="flex items-center gap-1.5">
                      <Icon className="w-4 h-4" />
                      {docType.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {DOCUMENT_TYPES.map((docType) => {
                const config = documentConfigs.find(c => c.document_type === docType.value);
                const Icon = docType.icon;
                if (!config) return null;

                return (
                  <TabsContent key={docType.value} value={docType.value} className="space-y-6 mt-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle>{docType.label} ID Configuration</CardTitle>
                            <CardDescription>
                              Configure how {docType.label.toLowerCase()} IDs are generated
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <Label>Prefix</Label>
                            <Input
                              value={config.prefix}
                              onChange={(e) =>
                                handleConfigChange(config.document_type, 'prefix', e.target.value)
                              }
                              placeholder="e.g., PO-"
                            />
                            <p className="text-xs text-muted-foreground">Text that appears before the number</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Number of Digits</Label>
                            <Select
                              value={String(config.num_digits)}
                              onValueChange={(value) =>
                                handleConfigChange(config.document_type, 'num_digits', parseInt(value))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="4">4</SelectItem>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="6">6</SelectItem>
                                <SelectItem value="7">7</SelectItem>
                                <SelectItem value="8">8</SelectItem>
                                <SelectItem value="9">9</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">How many digits to pad to</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Starting Number</Label>
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
                            />
                            <p className="text-xs text-muted-foreground">First number in the sequence</p>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-muted rounded-lg">
                          <Label className="text-xs text-muted-foreground">Preview</Label>
                          <code className="block text-lg font-mono mt-1">
                            {getPreviewId(config)}
                          </code>
                        </div>

                        {/* PO-specific automation settings */}
                        {docType.value === 'purchase_order' && (
                          <div className="space-y-4 pt-4 border-t">
                            <div>
                              <h4 className="text-sm font-medium mb-1">Automation Settings</h4>
                              <p className="text-xs text-muted-foreground">Configure automatic actions when PO status changes</p>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                <div className="space-y-0.5">
                                  <Label className="font-medium">Auto-create delivery on Confirmed</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Automatically create a delivery record when a PO status is changed to "Confirmed"
                                  </p>
                                </div>
                                <Switch
                                  checked={poSettings.auto_create_delivery_on_confirmed}
                                  onCheckedChange={(checked) => 
                                    setPOSettings(prev => ({ ...prev, auto_create_delivery_on_confirmed: checked }))
                                  }
                                />
                              </div>

                              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                <div className="space-y-0.5">
                                  <Label className="font-medium">Sync delivery to Shipped</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Automatically mark associated delivery as "Shipped" when PO is marked as "Shipped"
                                  </p>
                                </div>
                                <Switch
                                  checked={poSettings.auto_mark_delivery_shipped}
                                  onCheckedChange={(checked) => 
                                    setPOSettings(prev => ({ ...prev, auto_mark_delivery_shipped: checked }))
                                  }
                                />
                              </div>

                              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                <div className="space-y-0.5">
                                  <Label className="font-medium">Sync delivery to Delivered</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Automatically mark associated delivery as "Delivered" when PO is marked as "Delivered"
                                  </p>
                                </div>
                                <Switch
                                  checked={poSettings.auto_mark_delivery_delivered}
                                  onCheckedChange={(checked) => 
                                    setPOSettings(prev => ({ ...prev, auto_mark_delivery_delivered: checked }))
                                  }
                                />
                              </div>
                            </div>

                            <div className="flex justify-end">
                              <Button 
                                onClick={handleSavePOSettings} 
                                disabled={savingPOSettings}
                                variant="outline"
                                size="sm"
                              >
                                {savingPOSettings ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Automation Settings
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>

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
                    Save ID Configuration
                    <Kbd className="ml-2">⌘S</Kbd>
                  </>
                )}
              </Button>
            </div>
              </>
            )}
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
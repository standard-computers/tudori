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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Kbd } from '@/components/ui/kbd';
import { ArrowLeft, Cog, Save, Loader2, AlertTriangle, ShieldAlert, FileText, ShoppingCart, Truck, Book, Users, Package, MapPin, UserCheck, Sliders, Receipt, CreditCard, Wallet, ClipboardList, PackageCheck, PackageMinus, FileSpreadsheet, Boxes } from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

interface DocumentIdConfig {
  id?: string;
  company_id: string;
  document_type: string;
  prefix: string;
  num_digits: number;
  starting_number: number;
}

const DOCUMENT_TYPES = [
  { value: 'purchase_order', label: 'Purchase Order', prefix_placeholder: 'PO-', icon: ShoppingCart },
  { value: 'sales_order', label: 'Sales Order', prefix_placeholder: 'SO-', icon: ClipboardList },
  { value: 'requisition', label: 'Requisition', prefix_placeholder: 'REQ-', icon: FileText },
  { value: 'delivery', label: 'Delivery', prefix_placeholder: 'DEL-', icon: Truck },
  { value: 'outbound_delivery', label: 'Outbound Delivery', prefix_placeholder: 'OD', icon: Truck },
  { value: 'goods_receipt', label: 'Goods Receipt', prefix_placeholder: 'GR-', icon: PackageCheck },
  { value: 'goods_issue', label: 'Goods Issue', prefix_placeholder: 'GI-', icon: PackageMinus },
  { value: 'packaging_unit', label: 'Packaging Unit', prefix_placeholder: 'PU-', icon: Boxes },
  { value: 'bill_of_materials', label: 'Bill of Materials', prefix_placeholder: 'BOM-', icon: ClipboardList },
  { value: 'invoice', label: 'Invoice', prefix_placeholder: 'INV-', icon: FileSpreadsheet },
  { value: 'credit_memo', label: 'Credit Memo', prefix_placeholder: 'CM-', icon: CreditCard },
  { value: 'debit_memo', label: 'Debit Memo', prefix_placeholder: 'DM-', icon: Wallet },
  { value: 'account', label: 'Account', prefix_placeholder: 'ACC-', icon: Receipt },
  { value: 'ledger', label: 'Ledger', prefix_placeholder: 'LED-', icon: Book },
  { value: 'vendor', label: 'Vendor', prefix_placeholder: 'VND-', icon: Users },
  { value: 'customer', label: 'Customer', prefix_placeholder: 'CUS-', icon: UserCheck },
  { value: 'employee', label: 'Employee', prefix_placeholder: 'EMP-', icon: UserCheck },
  { value: 'product', label: 'Product', prefix_placeholder: 'PRD-', icon: Package },
  { value: 'location', label: 'Location', prefix_placeholder: 'LOC-', icon: MapPin },
  { value: 'carrier', label: 'Carrier', prefix_placeholder: 'CAR-', icon: Truck },
  { value: 'route', label: 'Route', prefix_placeholder: 'RTE-', icon: Truck },
  { value: 'assignment', label: 'Assignment', prefix_placeholder: 'ASN-', icon: Users },
];

interface POAutomationSettings {
  auto_create_delivery_on_confirmed: boolean;
  auto_mark_delivery_shipped: boolean;
  auto_mark_delivery_delivered: boolean;
}

interface ProcessControlSettings {
  require_gr_on_delivery: boolean;
  require_delivery_receipt: boolean;
  track_bin_level_movements: boolean;
}

interface ImportExportSettings {
  [documentType: string]: {
    import_enabled: boolean;
    export_enabled: boolean;
  };
}

const DEFAULT_IMPORT_EXPORT_SETTINGS: ImportExportSettings = {
  purchase_order: { import_enabled: false, export_enabled: true },
  sales_order: { import_enabled: false, export_enabled: true },
  requisition: { import_enabled: false, export_enabled: true },
  delivery: { import_enabled: false, export_enabled: true },
  goods_receipt: { import_enabled: false, export_enabled: true },
  goods_issue: { import_enabled: false, export_enabled: true },
  invoice: { import_enabled: false, export_enabled: true },
  credit_memo: { import_enabled: false, export_enabled: true },
  debit_memo: { import_enabled: false, export_enabled: true },
  account: { import_enabled: false, export_enabled: true },
  ledger: { import_enabled: false, export_enabled: true },
  vendor: { import_enabled: false, export_enabled: true },
  customer: { import_enabled: false, export_enabled: true },
  product: { import_enabled: false, export_enabled: true },
  location: { import_enabled: false, export_enabled: true },
  tax_rate: { import_enabled: false, export_enabled: true },
};

type AppRole = Database['public']['Enums']['app_role'];
type UserRoleEntry = { role: AppRole };

const Configuration = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingControls, setSavingControls] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [documentConfigs, setDocumentConfigs] = useState<DocumentIdConfig[]>([]);
  const [activeTab, setActiveTab] = useState('ids');
  const [activeConfigTab, setActiveConfigTab] = useState('purchase_order');
  const [currentUserRoles, setCurrentUserRoles] = useState<AppRole[]>([]);
  const [poSettings, setPOSettings] = useState<POAutomationSettings>({
    auto_create_delivery_on_confirmed: true,
    auto_mark_delivery_shipped: true,
    auto_mark_delivery_delivered: true,
  });
  const [savingPOSettings, setSavingPOSettings] = useState(false);
  const [processControls, setProcessControls] = useState<ProcessControlSettings>({
    require_gr_on_delivery: true,
    require_delivery_receipt: true,
    track_bin_level_movements: true,
  });
const [importExportSettings, setImportExportSettings] = useState<ImportExportSettings>(DEFAULT_IMPORT_EXPORT_SETTINGS);

  useEffect(() => {
    setTransaction(`config/${activeTab}`);
  }, [activeTab, setTransaction]);

  const isIT = currentUserRoles.includes('it');

  useSaveShortcut(() => {
    if (!isIT) return;
    if (activeTab === 'ids' && !savingConfig) {
      handleSaveConfigs();
    } else if (activeTab === 'controls' && !savingControls) {
      handleSaveControls();
    }
  }, isIT);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (profile?.company_id) {
        setCompanyId(profile.company_id);

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user!.id)
          .eq('company_id', profile.company_id);

        const roles = (roleData as UserRoleEntry[] | null)?.map(r => r.role) || [];
        setCurrentUserRoles(roles);

        await Promise.all([
          fetchDocumentConfigs(profile.company_id),
          fetchPOSettings(profile.company_id),
          fetchProcessControls(profile.company_id),
          fetchImportExportSettings(profile.company_id),
        ]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load configuration');
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

  const fetchProcessControls = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', companyId)
        .eq('setting_key', 'process_controls')
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value && typeof data.setting_value === 'object' && !Array.isArray(data.setting_value)) {
        const val = data.setting_value as Record<string, unknown>;
        setProcessControls({
          require_gr_on_delivery: (val.require_gr_on_delivery as boolean) ?? true,
          require_delivery_receipt: (val.require_delivery_receipt as boolean) ?? true,
          track_bin_level_movements: (val.track_bin_level_movements as boolean) ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching process controls:', error);
    }
  };

  const fetchImportExportSettings = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', companyId)
        .eq('setting_key', 'import_export_settings')
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value && typeof data.setting_value === 'object' && !Array.isArray(data.setting_value)) {
        const val = data.setting_value as Record<string, unknown>;
        const merged = { ...DEFAULT_IMPORT_EXPORT_SETTINGS };
        Object.keys(val).forEach(key => {
          if (merged[key] && typeof val[key] === 'object') {
            const docSettings = val[key] as Record<string, unknown>;
            merged[key] = {
              import_enabled: typeof docSettings.import_enabled === 'boolean' ? docSettings.import_enabled : false,
              export_enabled: typeof docSettings.export_enabled === 'boolean' ? docSettings.export_enabled : true,
            };
          }
        });
        setImportExportSettings(merged);
      }
    } catch (error) {
      console.error('Error fetching import/export settings:', error);
    }
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

  const handleSavePOSettings = async () => {
    if (!companyId) return;

    setSavingPOSettings(true);
    try {
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .eq('company_id', companyId)
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
            company_id: companyId,
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

  const handleSaveConfigs = async () => {
    if (!companyId) return;

    setSavingConfig(true);
    try {
      // Save document ID configs
      for (const config of documentConfigs) {
        if (config.id) {
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
          const { error } = await supabase
            .from('document_id_config')
            .insert({
              company_id: companyId,
              document_type: config.document_type,
              prefix: config.prefix,
              num_digits: config.num_digits,
              starting_number: config.starting_number
            });

          if (error) throw error;
        }
      }

      // Save import/export settings
      const { data: existingImportExport } = await supabase
        .from('company_settings')
        .select('id')
        .eq('company_id', companyId)
        .eq('setting_key', 'import_export_settings')
        .maybeSingle();

      if (existingImportExport) {
        await supabase
          .from('company_settings')
          .update({ setting_value: importExportSettings })
          .eq('id', existingImportExport.id);
      } else {
        await supabase
          .from('company_settings')
          .insert([{
            company_id: companyId,
            setting_key: 'import_export_settings',
            setting_value: importExportSettings,
          }]);
      }

      await fetchDocumentConfigs(companyId);
      toast.success('Configuration saved');
    } catch (error: any) {
      console.error('Error saving configs:', error);
      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveControls = async () => {
    if (!companyId) return;

    setSavingControls(true);
    try {
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .eq('company_id', companyId)
        .eq('setting_key', 'process_controls')
        .maybeSingle();

      const settingValue = {
        require_gr_on_delivery: processControls.require_gr_on_delivery,
        require_delivery_receipt: processControls.require_delivery_receipt,
        track_bin_level_movements: processControls.track_bin_level_movements,
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
            company_id: companyId,
            setting_key: 'process_controls',
            setting_value: settingValue,
          }]);
      }

      toast.success('Process controls saved');
    } catch (error: any) {
      console.error('Error saving process controls:', error);
      toast.error(error.message || 'Failed to save controls');
    } finally {
      setSavingControls(false);
    }
  };

  const handleImportExportChange = (
    docType: string,
    field: 'import_enabled' | 'export_enabled',
    value: boolean
  ) => {
    setImportExportSettings(prev => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        [field]: value,
      },
    }));
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

  if (!isIT && !loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Cog className="w-7 h-7 text-muted-foreground" />
                <h1 className="text-xl font-display font-bold text-foreground">Configuration</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <ShieldAlert className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">IT Access Required</h2>
                <p className="text-muted-foreground max-w-md">
                  Only users with the IT role can access configuration settings.
                  Please contact your IT administrator if you need access.
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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Cog className="w-7 h-7 text-primary" />
                <h1 className="text-xl font-display font-bold text-foreground">Configuration</h1>
              </div>
            </div>
            {activeTab === 'ids' && (
              <Button onClick={handleSaveConfigs} disabled={savingConfig}>
                {savingConfig ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                    <Kbd className="ml-2">⌘S</Kbd>
                  </>
                )}
              </Button>
            )}
            {activeTab === 'controls' && (
              <Button onClick={handleSaveControls} disabled={savingControls}>
                {savingControls ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                    <Kbd className="ml-2">⌘S</Kbd>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="ids" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Document IDs
            </TabsTrigger>
            <TabsTrigger value="controls" className="flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Controls
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ids" className="space-y-6">
            <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Changing the prefix, number of digits, or starting number after documents have already been created may result in duplicate IDs or gaps in your numbering sequence. Proceed with caution.
              </AlertDescription>
            </Alert>

            <div className="flex gap-6">
              {/* Vertical Sidebar */}
              <div className="w-48 shrink-0">
                <nav className="flex flex-col gap-1">
                  {DOCUMENT_TYPES.map((docType) => {
                    const Icon = docType.icon;
                    const isActive = activeConfigTab === docType.value;
                    return (
                      <button
                        key={docType.value}
                        onClick={() => setActiveConfigTab(docType.value)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left ${
                          isActive 
                            ? 'bg-primary text-primary-foreground font-medium' 
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{docType.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Content Area */}
              <div className="flex-1 min-w-0">
                {DOCUMENT_TYPES.map((docType) => {
                  const config = documentConfigs.find(c => c.document_type === docType.value);
                  const Icon = docType.icon;
                  if (!config || activeConfigTab !== docType.value) return null;

                  return (
                    <Card key={docType.value}>
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

                        {/* Import/Export Settings */}
                        <div className="space-y-4 pt-4 border-t">
                          <div>
                            <h4 className="text-sm font-medium mb-1">Import / Export</h4>
                            <p className="text-xs text-muted-foreground">Enable import and export buttons (XLSX format) in the {docType.label} view</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                              <div className="space-y-0.5">
                                <Label className="font-medium">Enable Import</Label>
                                <p className="text-xs text-muted-foreground">
                                  Show import button in the header
                                </p>
                              </div>
                              <Switch
                                checked={importExportSettings[docType.value]?.import_enabled ?? false}
                                onCheckedChange={(checked) => 
                                  handleImportExportChange(docType.value, 'import_enabled', checked)
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                              <div className="space-y-0.5">
                                <Label className="font-medium">Enable Export</Label>
                                <p className="text-xs text-muted-foreground">
                                  Show export button in the header
                                </p>
                              </div>
                              <Switch
                                checked={importExportSettings[docType.value]?.export_enabled ?? true}
                                onCheckedChange={(checked) => 
                                  handleImportExportChange(docType.value, 'export_enabled', checked)
                                }
                              />
                            </div>
                          </div>
                        </div>

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
                  );
                })}
              </div>
            </div>

          </TabsContent>

          <TabsContent value="controls" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sliders className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Process Controls</CardTitle>
                    <CardDescription>
                      Configure the behavior of business process flows
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-1">
                      <Label className="font-medium text-base">Required Delivery Receipt</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, a delivery must have a receipt document before it can be marked as received or delivered.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        When disabled, deliveries can be marked as delivered without requiring a formal receipt.
                      </p>
                    </div>
                    <Switch
                      checked={processControls.require_delivery_receipt}
                      onCheckedChange={(checked) => 
                        setProcessControls(prev => ({ ...prev, require_delivery_receipt: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-1">
                      <Label className="font-medium text-base">Require Goods Receipt</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, receiving a delivery will automatically generate a Goods Receipt document that must be posted before inventory is updated.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        When disabled, receiving a delivery will directly post inventory without creating a Goods Receipt.
                      </p>
                    </div>
                    <Switch
                      checked={processControls.require_gr_on_delivery}
                      onCheckedChange={(checked) => 
                        setProcessControls(prev => ({ ...prev, require_gr_on_delivery: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-1">
                      <Label className="font-medium text-base">Track Bin Level Movements</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, bin-to-bin movements (transfers, moves) will be recorded in the Material Flow history.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        When disabled, only location-level receipts and issues will be tracked.
                      </p>
                    </div>
                    <Switch
                      checked={processControls.track_bin_level_movements}
                      onCheckedChange={(checked) => 
                        setProcessControls(prev => ({ ...prev, track_bin_level_movements: checked }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Configuration;

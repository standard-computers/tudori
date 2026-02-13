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
import { Kbd } from '@/components/ui/kbd';
import { ArrowLeft, Building2, Save, Loader2, ShieldAlert, Upload, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/lib/toast';
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

type AppRole = Database['public']['Enums']['app_role'];
type UserRoleEntry = { role: AppRole };

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState('company');
  const [currentUserRoles, setCurrentUserRoles] = useState<AppRole[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setTransaction(`set/${activeTab}`);
  }, [activeTab, setTransaction]);

  const isAdmin = currentUserRoles.includes('owner') || currentUserRoles.includes('admin');
  const isIT = currentUserRoles.includes('it');
  const hasSettingsAccess = isAdmin || isIT;

  useSaveShortcut(() => {
    if (!hasSettingsAccess) return;
    if (activeTab === 'company' && company && !saving) {
      handleSaveCompany();
    }
  }, hasSettingsAccess);
  
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (profile?.company_id) {
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
        }
      }
    } catch (error) {
      console.error('Error fetching company:', error);
      toast.error('Failed to load company information');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
      if (company.logo_url) {
        const fileName = company.logo_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('company-logos').remove([`${company.id}/${fileName}`]);
        }
      }
      
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!hasSettingsAccess && !loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Building2 className="w-7 h-7 text-muted-foreground" />
                <h1 className="text-xl font-display font-bold text-foreground">Settings</h1>
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
                <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground max-w-md">
                  Only administrators, owners, and IT users can view and edit company settings. 
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
      <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center h-16 gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Building2 className="w-7 h-7 text-primary" />
              <h1 className="text-xl font-display font-bold text-foreground">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="company">Company</TabsTrigger>
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
                <Card>
                  <CardHeader>
                    <CardTitle>Company Details</CardTitle>
                    <CardDescription>
                      Update your company's basic information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
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

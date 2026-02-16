import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, X } from 'lucide-react';
import { toast } from '@/lib/toast';

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

interface CompanyTabProps {
  companyId: string | null;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onSaveRef: React.MutableRefObject<(() => void) | null>;
}

const CompanyTab = ({ companyId, saving, setSaving, onSaveRef }: CompanyTabProps) => {
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
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
    if (companyId) {
      fetchCompany();
    } else {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    onSaveRef.current = handleSaveCompany;
  });

  const fetchCompany = async () => {
    try {
      const { data: companyData, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId!)
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
      await supabase.from('companies').update({ logo_url: null }).eq('id', company.id);
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
    const { error } = await supabase.storage.from('company-logos').upload(filePath, logoFile);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('company-logos').getPublicUrl(filePath);
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

  if (loading) {
    return <div className="animate-pulse text-muted-foreground text-center py-8">Loading...</div>;
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">
            No company information found. Please complete your profile setup.
          </p>
          <div className="flex justify-center">
            <Button onClick={() => navigate('/complete-profile')}>Complete Setup</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
          <CardDescription>Update your company's basic information</CardDescription>
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
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('logo-upload')?.click()} disabled={uploadingLogo}>
                    <Upload className="w-4 h-4 mr-2" />
                    {logoPreview ? 'Change' : 'Upload'}
                  </Button>
                  {logoPreview && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveLogo} disabled={uploadingLogo} className="text-destructive hover:text-destructive">
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP or SVG. Max 5MB.</p>
              </div>
              <input id="logo-upload" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={handleLogoChange} className="hidden" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="Acme Inc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" name="industry" value={formData.industry} onChange={handleInputChange} placeholder="Technology" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Company Size</Label>
              <Input id="size" name="size" value={formData.size} onChange={handleInputChange} placeholder="1-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" value={formData.website} onChange={handleInputChange} placeholder="https://example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+1 (555) 000-0000" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Your company's physical address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address_line1">Address Line 1 *</Label>
            <Input id="address_line1" name="address_line1" value={formData.address_line1} onChange={handleInputChange} placeholder="123 Main St" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_line2">Address Line 2</Label>
            <Input id="address_line2" name="address_line2" value={formData.address_line2} onChange={handleInputChange} placeholder="Suite 100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input id="city" name="city" value={formData.city} onChange={handleInputChange} placeholder="San Francisco" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input id="state" name="state" value={formData.state} onChange={handleInputChange} placeholder="CA" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal Code *</Label>
              <Input id="postal_code" name="postal_code" value={formData.postal_code} onChange={handleInputChange} placeholder="94102" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country *</Label>
            <Input id="country" name="country" value={formData.country} onChange={handleInputChange} placeholder="United States" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyTab;

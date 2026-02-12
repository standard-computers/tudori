import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTransaction } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { Building2, ArrowLeft, Loader2 } from 'lucide-react';
import { z } from 'zod';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

const companySchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  addressLine1: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  useTransaction('setup');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1 - Profile
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Step 2 - Company
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('United States');

  // Check if user already has a profile on mount
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    const checkExisting = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setHasExistingProfile(true);
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        if (data.company_id) {
          // Profile and company both exist — they don't need onboarding
          navigate('/dashboard');
          return;
        }
        // Has profile but no company — skip to step 2
        setStep(2);
      }
      setCheckingProfile(false);
    };
    checkExisting();
  }, [user, authLoading, navigate]);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = profileSchema.safeParse({ firstName, lastName });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = companySchema.safeParse({
      companyName,
      addressLine1,
      city,
      state,
      postalCode,
      country,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!user) {
      toast.error('No user session found');
      return;
    }

    setLoading(true);

    if (hasExistingProfile) {
      // User already has a profile but no company — create company and link it
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName,
          industry: industry || null,
          size: size || null,
          address_line1: addressLine1,
          address_line2: addressLine2 || null,
          city,
          state,
          postal_code: postalCode,
          country,
        })
        .select('id')
        .single();

      if (companyError || !companyData) {
        toast.error('Failed to create company: ' + (companyError?.message || 'Unknown error'));
        setLoading(false);
        return;
      }

      // Update profile with new company and name
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          company_id: companyData.id,
          first_name: firstName,
          last_name: lastName,
        })
        .eq('user_id', user.id);

      if (profileError) {
        toast.error('Failed to update profile: ' + profileError.message);
        setLoading(false);
        return;
      }

      // Assign owner + IT roles
      await supabase.from('user_roles').insert([
        { user_id: user.id, company_id: companyData.id, role: 'owner' as const },
        { user_id: user.id, company_id: companyData.id, role: 'it' as const },
      ]);

      toast.success('Company setup complete!');
      navigate('/dashboard');
      setLoading(false);
      return;
    }

    // No existing profile — use the RPC to create everything in one transaction
    const { error } = await supabase.rpc('create_company_and_profile', {
      p_company_name: companyName,
      p_industry: industry || null,
      p_size: size || null,
      p_address_line1: addressLine1,
      p_address_line2: addressLine2 || null,
      p_city: city,
      p_state: state,
      p_postal_code: postalCode,
      p_country: country,
      p_first_name: firstName,
      p_last_name: lastName,
    });

    if (error) {
      toast.error('Failed to complete setup: ' + error.message);
      setLoading(false);
      return;
    }

    toast.success('Profile setup complete!');
    navigate('/dashboard');
    setLoading(false);
  };

  if (authLoading || checkingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

      <div className="w-full max-w-md relative animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <span className="text-2xl font-display font-bold text-foreground">EnterpriseHub</span>
        </div>

        <Card className="glass-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">
              {step === 1 ? 'Your Details' : 'Company Details'}
            </CardTitle>
            <CardDescription>
              {step === 1
                ? 'Tell us a bit about yourself'
                : 'Set up your company profile'}
            </CardDescription>
            <div className="flex justify-center gap-2 mt-4">
              <div className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <form onSubmit={handleStep1} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={errors.firstName ? 'border-destructive' : ''}
                    />
                    {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={errors.lastName ? 'border-destructive' : ''}
                    />
                    {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Continue
                </Button>
              </form>
            ) : (
              <form onSubmit={handleStep2} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="Acme Inc."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className={errors.companyName ? 'border-destructive' : ''}
                  />
                  {errors.companyName && <p className="text-sm text-destructive">{errors.companyName}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="size">Company Size</Label>
                    <Select value={size} onValueChange={setSize}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10</SelectItem>
                        <SelectItem value="11-50">11-50</SelectItem>
                        <SelectItem value="51-200">51-200</SelectItem>
                        <SelectItem value="201-500">201-500</SelectItem>
                        <SelectItem value="500+">500+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address</Label>
                  <Input
                    id="addressLine1"
                    placeholder="123 Main Street"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className={errors.addressLine1 ? 'border-destructive' : ''}
                  />
                  {errors.addressLine1 && <p className="text-sm text-destructive">{errors.addressLine1}</p>}
                </div>
                <Input
                  placeholder="Suite, Unit, etc. (optional)"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="San Francisco"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={errors.city ? 'border-destructive' : ''}
                    />
                    {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      placeholder="CA"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className={errors.state ? 'border-destructive' : ''}
                    />
                    {errors.state && <p className="text-sm text-destructive">{errors.state}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      placeholder="94105"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className={errors.postalCode ? 'border-destructive' : ''}
                    />
                    {errors.postalCode && <p className="text-sm text-destructive">{errors.postalCode}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={errors.country ? 'border-destructive' : ''}
                    />
                    {errors.country && <p className="text-sm text-destructive">{errors.country}</p>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Complete Setup
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfile;

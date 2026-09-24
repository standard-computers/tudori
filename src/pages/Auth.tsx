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
import { Building2, ArrowRight, ArrowLeft, Loader2, Users, Briefcase } from 'lucide-react';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupStep1Schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

const signupStep2Schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  industry: z.string().optional(),
  size: z.string().optional(),
  addressLine1: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});

interface PendingInvitation {
  id: string;
  company_id: string;
  role: AppRole;
  company_name?: string;
}

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  useTransaction('auth');
  const [isLogin, setIsLogin] = useState(true);
  const [signupStep, setSignupStep] = useState(1); // 1 = user details, 1.5 = invitation choice, 2 = company details
  const [loading, setLoading] = useState(false);
  const [checkingInvitation, setCheckingInvitation] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingInvitation, setPendingInvitation] = useState<PendingInvitation | null>(null);

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signup step 1
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Signup step 2 - Company info
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('United States');

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Welcome back!');
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleSignupStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = signupStep1Schema.safeParse({ email, password, firstName, lastName });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // Check for pending invitation via edge function (rate-limited and secure)
    setCheckingInvitation(true);
    try {
      const response = await supabase.functions.invoke('check-invitation', {
        body: { email: email.toLowerCase() },
      });

      if (response.error) {
        console.error('Error checking invitation:', response.error);
        // If rate limited, show error and don't proceed
        if (response.error.message?.includes('429')) {
          toast.error('Too many requests. Please try again in a minute.');
          setCheckingInvitation(false);
          return;
        }
        // On other errors, proceed to company setup (fail open for UX)
        setPendingInvitation(null);
        setSignupStep(2);
        setCheckingInvitation(false);
        return;
      }

      const data = response.data;
      
      if (data?.hasInvitation && data?.invitation) {
        setPendingInvitation({
          id: data.invitation.id,
          company_id: data.invitation.company_id,
          role: data.invitation.role,
          company_name: data.invitation.company_name,
        });
        setSignupStep(1.5); // Go to invitation choice step
      } else {
        setPendingInvitation(null);
        setSignupStep(2); // Go directly to company setup
      }
    } catch (error) {
      console.error('Error checking invitation:', error);
      // On error, proceed to company setup
      setPendingInvitation(null);
      setSignupStep(2);
    }
    setCheckingInvitation(false);
  };

  const handleJoinExistingCompany = async () => {
    if (!pendingInvitation) return;

    setLoading(true);
    
    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (authError) {
      toast.error(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Create profile with invited company
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          company_id: pendingInvitation.company_id,
          first_name: firstName,
          last_name: lastName,
        });

      if (profileError) {
        toast.error('Failed to create profile: ' + profileError.message);
        setLoading(false);
        return;
      }

      // Assign the invited role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          company_id: pendingInvitation.company_id,
          role: pendingInvitation.role,
        });

      if (roleError) {
        toast.error('Failed to assign role: ' + roleError.message);
        setLoading(false);
        return;
      }

      // Mark the invitation as accepted
      await supabase
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', pendingInvitation.id);

      toast.success(`Welcome! You have joined ${pendingInvitation.company_name}.`);
      navigate('/dashboard');
    }
    
    setLoading(false);
  };

  const handleSetupNewCompany = async () => {
    if (pendingInvitation) {
      // Mark the invitation as declined by setting accepted_at to indicate it was processed
      // but the user chose not to join (we use a far future date to indicate decline)
      await supabase
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', pendingInvitation.id);
      
      setPendingInvitation(null);
    }
    setSignupStep(2);
  };

  const handleSignupStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = signupStep2Schema.safeParse({
      companyName,
      industry,
      size,
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

    setLoading(true);
    
    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (authError) {
      toast.error(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Without an active session (e.g. email confirmation required) we cannot
      // create the company yet — onboarding finishes on first sign-in.
      if (!authData.session) {
        toast.success('Account created! Confirm your email, then sign in to finish setup.');
        setIsLogin(true);
        setSignupStep(1);
        setLoading(false);
        return;
      }

      // Create company + profile + roles in one secure server-side transaction
      const { error: setupError } = await supabase.rpc('create_company_and_profile', {
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

      if (setupError) {
        toast.error('Failed to create company: ' + setupError.message);
        setLoading(false);
        return;
      }

      toast.success('Account created successfully!');
      navigate('/dashboard');
    }

    
    setLoading(false);
  };

  const getStepTitle = () => {
    if (isLogin) return 'Welcome Back';
    if (signupStep === 1) return 'Create Account';
    if (signupStep === 1.5) return 'Join or Create?';
    return 'Company Details';
  };

  const getStepDescription = () => {
    if (isLogin) return 'Sign in to access your dashboard';
    if (signupStep === 1) return 'Enter your details to get started';
    if (signupStep === 1.5) return 'You have a pending invitation';
    return 'Tell us about your company';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      
      <div className="w-full max-w-md relative animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <span className="text-2xl font-display font-bold text-foreground">Tudori</span>
        </div>

        <Card className="glass-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">
              {getStepTitle()}
            </CardTitle>
            <CardDescription>
              {getStepDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLogin ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Sign In
                </Button>
              </form>
            ) : signupStep === 1 ? (
              <form onSubmit={handleSignupStep1} className="space-y-4">
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
                <div className="space-y-2">
                  <Label htmlFor="signupEmail">Email</Label>
                  <Input
                    id="signupEmail"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupPassword">Password</Label>
                  <Input
                    id="signupPassword"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={checkingInvitation}>
                  {checkingInvitation ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            ) : signupStep === 1.5 ? (
              <div className="space-y-6">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">You've been invited to join</p>
                  <p className="font-semibold text-foreground">{pendingInvitation?.company_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    as {pendingInvitation?.role}
                  </p>
                </div>

                <div className="space-y-3">
                  <Button 
                    onClick={handleJoinExistingCompany} 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Users className="w-4 h-4 mr-2" />}
                    Join {pendingInvitation?.company_name}
                  </Button>
                  
                  <Button 
                    onClick={handleSetupNewCompany} 
                    variant="outline" 
                    className="w-full"
                    disabled={loading}
                  >
                    <Briefcase className="w-4 h-4 mr-2" />
                    Set Up My Own Company
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Choosing to set up your own company will decline the invitation.
                </p>

                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSignupStep(1);
                    setPendingInvitation(null);
                  }}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSignupStep2} className="space-y-4">
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
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setSignupStep(1)}
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-6 text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setSignupStep(1);
                  setErrors({});
                  setPendingInvitation(null);
                }}
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Building2, 
  LogOut, 
  Users, 
  Package, 
  BarChart3, 
  FileText, 
  Settings, 
  DollarSign,
  Calendar,
  Truck,
  ShoppingCart,
  Warehouse,
  ClipboardList,
  MessageSquare,
  UserCog
} from 'lucide-react';

interface Profile {
  first_name: string;
  last_name: string;
  company_id: string;
}

interface Company {
  name: string;
}

const apps = [
  { name: 'Sales', icon: DollarSign, color: 'bg-emerald-500', description: 'Manage orders & revenue', path: null },
  { name: 'Inventory', icon: Warehouse, color: 'bg-blue-500', description: 'Stock management', path: null },
  { name: 'Customers', icon: Users, color: 'bg-violet-500', description: 'CRM & contacts', path: null },
  { name: 'Products', icon: Package, color: 'bg-amber-500', description: 'Product catalog', path: null },
  { name: 'Analytics', icon: BarChart3, color: 'bg-pink-500', description: 'Reports & insights', path: null },
  { name: 'Invoices', icon: FileText, color: 'bg-cyan-500', description: 'Billing & payments', path: null },
  { name: 'Purchasing', icon: ShoppingCart, color: 'bg-orange-500', description: 'Vendor orders', path: null },
  { name: 'Shipping', icon: Truck, color: 'bg-teal-500', description: 'Logistics & delivery', path: null },
  { name: 'Calendar', icon: Calendar, color: 'bg-indigo-500', description: 'Events & scheduling', path: null },
  { name: 'Tasks', icon: ClipboardList, color: 'bg-rose-500', description: 'To-dos & projects', path: null },
  { name: 'Messages', icon: MessageSquare, color: 'bg-lime-500', description: 'Team communication', path: null },
  { name: 'Users', icon: UserCog, color: 'bg-purple-500', description: 'Team & access control', path: '/users' },
  { name: 'Settings', icon: Settings, color: 'bg-slate-500', description: 'Configuration', path: null },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('first_name, last_name, company_id')
      .eq('user_id', user!.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      
      if (profileData.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('name')
          .eq('id', profileData.company_id)
          .single();
        
        if (companyData) {
          setCompany(companyData);
        }
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const initials = profile 
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase() 
    : 'U';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <span className="text-lg font-display font-bold text-foreground">EnterpriseHub</span>
                {company && (
                  <p className="text-xs text-muted-foreground">{company.name}</p>
                )}
              </div>
            </div>

            {/* User menu */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground">
                  {profile ? `${profile.first_name} ${profile.last_name}` : 'User'}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Avatar className="h-10 w-10 border-2 border-accent/20">
                <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome section */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Good {getTimeOfDay()}, {profile?.first_name || 'there'}!
          </h1>
          <p className="text-muted-foreground mt-1">
            What would you like to work on today?
          </p>
        </div>

        {/* Apps grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {apps.map((app, index) => (
            <div
              key={app.name}
              className="app-tile animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => {
                if (app.path) {
                  navigate(app.path);
                }
              }}
            >
              <div className={`w-12 h-12 rounded-xl ${app.color} flex items-center justify-center mb-4`}>
                <app.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-1">{app.name}</h3>
              <p className="text-sm text-muted-foreground">{app.description}</p>
            </div>
          ))}
        </div>

        {/* Quick stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-display font-bold text-foreground mt-1">$0.00</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-success" />
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Orders</p>
                <p className="text-2xl font-display font-bold text-foreground mt-1">0</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-accent" />
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-display font-bold text-foreground mt-1">0</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export default Dashboard;

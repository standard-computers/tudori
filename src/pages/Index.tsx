import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTransaction } from '@/contexts/StatusBarContext';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Package,
  ShoppingCart,
  BarChart3,
  Users,
  Warehouse,
  FileText,
  Truck,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  Building2,
  Layers,
  Globe,
  Shield,
} from 'lucide-react';

const features = [
  { icon: Warehouse, title: 'Inventory & Warehouse', desc: 'Real-time stock tracking, bin management, cycle counts, and multi-location control.' },
  { icon: ShoppingCart, title: 'Procurement', desc: 'Requisitions, purchase orders, vendor management, and automated replenishment.' },
  { icon: FileText, title: 'Sales & Invoicing', desc: 'Sales orders, invoices, credit/debit memos, and full accounts receivable.' },
  { icon: Package, title: 'Production', desc: 'Bill of materials, production orders, step-by-step manufacturing, and output tracking.' },
  { icon: Truck, title: 'Logistics', desc: 'Inbound and outbound deliveries, carriers, routes, and shipment tracking.' },
  { icon: BarChart3, title: 'Analytics & Reporting', desc: 'Custom report builder, data explorer, and real-time business intelligence.' },
  { icon: Users, title: 'HR & Workforce', desc: 'Employees, teams, timesheets, time clock, and performance reviews.' },
  { icon: ClipboardList, title: 'Planning', desc: 'Safety stock monitoring, demand planning, and automated requisition generation.' },
];

const highlights = [
  'Multi-location warehouse management',
  'Full procurement-to-payment cycle',
  'Order-to-cash workflow',
  'Real-time inventory visibility',
  'Role-based access control',
  'Audit trail on every transaction',
  'Import/export via Excel',
  'Point of Sale terminal',
  'Internal messaging system',
  'Customizable document numbering',
];

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  useTransaction('init');

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary" />
            <span className="text-xl font-display font-bold text-foreground tracking-tight">Operand</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get Started <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-24 md:py-36 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.06)_0%,transparent_60%)]" />
        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Layers className="w-4 h-4" />
              Enterprise Resource Planning
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-foreground leading-[1.1] mb-6">
              Run your entire business
              <br />
              <span className="gradient-text">from one platform</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Operand unifies inventory, procurement, sales, production, logistics, finance, and workforce management into a single, powerful system — so nothing falls through the cracks.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" asChild className="text-base px-8 h-12">
                <Link to="/auth">
                  Start Free <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trusted by bar */}
      <section className="border-y border-border/50 bg-card/40 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-muted-foreground">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Globe className="w-4 h-4" /> Multi-location
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Shield className="w-4 h-4" /> Role-based security
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Layers className="w-4 h-4" /> 30+ integrated modules
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="w-4 h-4" /> Real-time analytics
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Everything you need. Nothing you don't.
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From the warehouse floor to the executive dashboard — every module works together seamlessly.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group p-6 rounded-xl bg-card border border-border/50 hover:border-accent/30 transition-all duration-300 hover:-translate-y-1"
                style={{ boxShadow: 'var(--shadow-md)' }}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-24 px-6 bg-card/40 border-y border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Built for real operations
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Every feature was designed with actual business workflows in mind.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 max-w-3xl mx-auto">
            {highlights.map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="flex items-center gap-3 py-2"
              >
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                <span className="text-foreground">{item}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Ready to streamline your operations?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
              Get started in minutes. No credit card required. No complexity upfront.
            </p>
            <Button size="lg" asChild className="text-base px-8 h-12">
              <Link to="/auth">
                Create your account <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="font-display font-semibold">Operand</span>
          </div>
          <span>© {new Date().getFullYear()} All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;

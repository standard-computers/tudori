import { 
  Building, 
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
  UserCog,
  MapPin,
  FileSpreadsheet,
  Percent,
  Gauge,
  BookOpen,
  CreditCard,
  Minus,
  Plus,
  LucideIcon
} from 'lucide-react';

export interface AppTile {
  name: string;
  icon: LucideIcon;
  color: string;
  description: string;
  path: string | null;
}

export const defaultApps: AppTile[] = [
  { name: 'Cockpit', icon: Gauge, color: 'text-orange-500', description: 'Location dashboard', path: '/cockpit' },
  { name: 'Sales Orders', icon: DollarSign, color: 'text-emerald-500', description: 'Customer orders', path: '/sales-orders' },
  { name: 'Inventory', icon: Warehouse, color: 'text-blue-500', description: 'Stock management', path: null },
  { name: 'Locations', icon: MapPin, color: 'text-green-500', description: 'Warehouses & stores', path: '/locations' },
  { name: 'Vendors', icon: Building, color: 'text-red-500', description: 'Suppliers & partners', path: '/vendors' },
  { name: 'Customers', icon: Users, color: 'text-violet-500', description: 'CRM & contacts', path: '/customers' },
  { name: 'Products', icon: Package, color: 'text-amber-500', description: 'Product catalog', path: '/products' },
  { name: 'Analytics', icon: BarChart3, color: 'text-pink-500', description: 'Reports & insights', path: null },
  { name: 'Invoices', icon: FileText, color: 'text-cyan-500', description: 'Billing & payments', path: '/invoices' },
  { name: 'Credit Memos', icon: Minus, color: 'text-green-500', description: 'Account credits', path: '/credit-memos' },
  { name: 'Debit Memos', icon: Plus, color: 'text-red-500', description: 'Account debits', path: '/debit-memos' },
  { name: 'Accounts', icon: CreditCard, color: 'text-indigo-500', description: 'Customer & vendor accounts', path: '/accounts' },
  { name: 'Ledgers', icon: BookOpen, color: 'text-stone-500', description: 'Financial ledgers', path: '/ledgers' },
  { name: 'Rates', icon: Percent, color: 'text-yellow-500', description: 'Tax rates', path: '/rates' },
  { name: 'Orders', icon: ShoppingCart, color: 'text-orange-500', description: 'Vendor orders', path: '/orders' },
  { name: 'Requisitions', icon: FileSpreadsheet, color: 'text-sky-500', description: 'Purchase requests', path: '/requisitions' },
  { name: 'Shipping', icon: Truck, color: 'text-teal-500', description: 'Logistics & delivery', path: '/deliveries' },
  { name: 'Calendar', icon: Calendar, color: 'text-indigo-500', description: 'Events & scheduling', path: null },
  { name: 'Tasks', icon: ClipboardList, color: 'text-rose-500', description: 'To-dos & projects', path: null },
  { name: 'Messages', icon: MessageSquare, color: 'text-lime-500', description: 'Team communication', path: null },
  { name: 'Users', icon: UserCog, color: 'text-purple-500', description: 'Team & access control', path: '/users' },
  { name: 'Settings', icon: Settings, color: 'text-slate-500', description: 'Configuration', path: '/settings' },
];

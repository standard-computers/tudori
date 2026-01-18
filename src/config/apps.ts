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
  { name: 'Sales', icon: DollarSign, color: 'bg-emerald-500', description: 'Manage orders & revenue', path: null },
  { name: 'Inventory', icon: Warehouse, color: 'bg-blue-500', description: 'Stock management', path: null },
  { name: 'Locations', icon: MapPin, color: 'bg-green-500', description: 'Warehouses & stores', path: '/locations' },
  { name: 'Vendors', icon: Building, color: 'bg-red-500', description: 'Suppliers & partners', path: '/vendors' },
  { name: 'Customers', icon: Users, color: 'bg-violet-500', description: 'CRM & contacts', path: '/customers' },
  { name: 'Products', icon: Package, color: 'bg-amber-500', description: 'Product catalog', path: '/products' },
  { name: 'Analytics', icon: BarChart3, color: 'bg-pink-500', description: 'Reports & insights', path: null },
  { name: 'Invoices', icon: FileText, color: 'bg-cyan-500', description: 'Billing & payments', path: null },
  { name: 'Rates', icon: Percent, color: 'bg-yellow-500', description: 'Tax rates', path: '/rates' },
  { name: 'Orders', icon: ShoppingCart, color: 'bg-orange-500', description: 'Vendor orders', path: '/orders' },
  { name: 'Requisitions', icon: FileSpreadsheet, color: 'bg-sky-500', description: 'Purchase requests', path: '/requisitions' },
  { name: 'Shipping', icon: Truck, color: 'bg-teal-500', description: 'Logistics & delivery', path: null },
  { name: 'Calendar', icon: Calendar, color: 'bg-indigo-500', description: 'Events & scheduling', path: null },
  { name: 'Tasks', icon: ClipboardList, color: 'bg-rose-500', description: 'To-dos & projects', path: null },
  { name: 'Messages', icon: MessageSquare, color: 'bg-lime-500', description: 'Team communication', path: null },
  { name: 'Users', icon: UserCog, color: 'bg-purple-500', description: 'Team & access control', path: '/users' },
  { name: 'Settings', icon: Settings, color: 'bg-slate-500', description: 'Configuration', path: '/settings' },
];

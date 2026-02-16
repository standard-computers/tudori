// Transaction codes mapped to app names for access control
// This is the single source of truth for transaction access

export interface TransactionCode {
  code: string;
  name: string;
  description: string;
  path: string | null;
}

export const TRANSACTION_CODES: TransactionCode[] = [
  { code: 'go', name: 'Go', description: 'Mobile work execution', path: '/go' },
  { code: 'pos', name: 'POS', description: 'Point of sale', path: '/pos' },
  { code: 'cockpit', name: 'Cockpit', description: 'Location dashboard', path: '/cockpit' },
  { code: 'planning', name: 'Planning', description: 'Demand planning', path: '/planning' },
  { code: 'sales_orders', name: 'Sales Orders', description: 'Customer orders', path: '/sales-orders' },
  { code: 'inventory', name: 'Inventory', description: 'Stock management', path: '/inventory' },
  { code: 'bill_of_materials', name: 'Bill of Materials', description: 'Product recipes', path: '/bill-of-materials' },
  { code: 'production', name: 'Production', description: 'Production orders', path: '/production' },
  { code: 'goods_receipts', name: 'Goods Receipts', description: 'Receive inventory', path: '/goods-receipts' },
  { code: 'goods_issues', name: 'Goods Issues', description: 'Issue inventory', path: '/goods-issues' },
  { code: 'locations', name: 'Locations', description: 'Warehouses & stores', path: '/locations' },
  { code: 'vendors', name: 'Vendors', description: 'Suppliers & partners', path: '/vendors' },
  { code: 'customers', name: 'Customers', description: 'CRM & contacts', path: '/customers' },
  { code: 'products', name: 'Products', description: 'Product catalog', path: '/products' },
  { code: 'analytics', name: 'Analytics', description: 'Reports & insights', path: '/analytics' },
  { code: 'invoices', name: 'Invoices', description: 'Billing & payments', path: '/invoices' },
  { code: 'credit_memos', name: 'Credit Memos', description: 'Account credits', path: '/credit-memos' },
  { code: 'debit_memos', name: 'Debit Memos', description: 'Account debits', path: '/debit-memos' },
  { code: 'accounts', name: 'Accounts', description: 'Customer & vendor accounts', path: '/accounts' },
  { code: 'ledgers', name: 'Ledgers', description: 'Financial ledgers', path: '/ledgers' },
  { code: 'rates', name: 'Rates', description: 'Tax rates', path: '/rates' },
  { code: 'orders', name: 'Orders', description: 'Vendor orders', path: '/orders' },
  { code: 'requisitions', name: 'Requisitions', description: 'Purchase requests', path: '/requisitions' },
  { code: 'deliveries', name: 'Deliveries', description: 'Logistics & delivery', path: '/deliveries' },
  { code: 'employees', name: 'Employees', description: 'Staff directory', path: '/employees' },
  { code: 'hr', name: 'HR', description: 'Human resources', path: '/hr' },
  { code: 'time_clock', name: 'Time Clock', description: 'Clock in/out', path: '/time-clock' },
  { code: 'teams', name: 'Teams', description: 'Team management', path: '/teams' },
  { code: 'calendar', name: 'Calendar', description: 'Events & scheduling', path: '/calendar' },
  { code: 'me', name: 'Me', description: 'My profile & time off', path: '/me' },
  { code: 'tasks', name: 'Tasks', description: 'To-dos & projects', path: '/tasks' },
  { code: 'messages', name: 'Messages', description: 'Team communication', path: '/messages' },
  { code: 'users', name: 'Users', description: 'Team & access control', path: '/users' },
  { code: 'configuration', name: 'Configuration', description: 'System & company settings', path: '/configuration' },
  { code: 'data_explorer', name: 'Data Explorer', description: 'Browse database tables', path: '/data-explorer' },
  { code: 'transportation', name: 'Transportation', description: 'Carriers & logistics', path: '/transportation' },
  { code: 'developers', name: 'Developers', description: 'API keys & webhooks', path: '/developers' },
];

// Map app names to transaction codes
export const APP_NAME_TO_CODE: Record<string, string> = TRANSACTION_CODES.reduce((acc, tc) => {
  acc[tc.name] = tc.code;
  return acc;
}, {} as Record<string, string>);

// Map paths to transaction codes
export const PATH_TO_CODE: Record<string, string> = TRANSACTION_CODES.reduce((acc, tc) => {
  if (tc.path) {
    acc[tc.path] = tc.code;
  }
  return acc;
}, {} as Record<string, string>);

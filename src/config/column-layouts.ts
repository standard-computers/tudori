import type { ColumnDefinition } from '@/hooks/use-column-visibility';

export const VENDOR_COLUMNS: ColumnDefinition[] = [
  { key: "vendor_id", label: "ID", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: true },
  { key: "type", label: "Type", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "contact_name", label: "Contact", defaultVisible: true },
  { key: "email", label: "Email", defaultVisible: true },
  { key: "phone", label: "Phone", defaultVisible: true },
  { key: "address_line1", label: "Address", defaultVisible: true },
  { key: "city", label: "City", defaultVisible: true },
  { key: "state", label: "State", defaultVisible: true },
  { key: "postal_code", label: "Postal Code", defaultVisible: true },
  { key: "country", label: "Country", defaultVisible: true },
  { key: "website", label: "Website", defaultVisible: true },
  { key: "payment_terms", label: "Payment Terms", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

export const SALES_ORDER_COLUMNS: ColumnDefinition[] = [
  { key: "so_number", label: "SO #", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "customer", label: "Customer", defaultVisible: true },
  { key: "location", label: "Ship From", defaultVisible: true },
  { key: "total_amount", label: "Total", defaultVisible: true },
  { key: "order_date", label: "Date", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

export const RATE_COLUMNS: ColumnDefinition[] = [
  { key: "rate_id", label: "Rate ID", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: true },
  { key: "type", label: "Type", defaultVisible: true },
  { key: "rate", label: "Rate/Amount", defaultVisible: true },
  { key: "description", label: "Description", defaultVisible: true },
  { key: "address_street", label: "Street", defaultVisible: false },
  { key: "address_city", label: "City", defaultVisible: false },
  { key: "address_county", label: "County", defaultVisible: false },
  { key: "address_state", label: "State", defaultVisible: false },
  { key: "address_postal_code", label: "Postal Code", defaultVisible: false },
  { key: "address_country", label: "Country", defaultVisible: false },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

export const DEBIT_MEMO_COLUMNS: ColumnDefinition[] = [
  { key: 'memo_number', label: 'Memo #', defaultVisible: true },
  { key: 'memo_date', label: 'Date', defaultVisible: true },
  { key: 'account', label: 'Account', defaultVisible: true },
  { key: 'invoice', label: 'Invoice', defaultVisible: true },
  { key: 'amount', label: 'Amount', defaultVisible: true },
  { key: 'ledger', label: 'Ledger', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

export const PRODUCT_COLUMNS: ColumnDefinition[] = [
  { key: "product_id", label: "ID", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: true },
  { key: "sku", label: "SKU", defaultVisible: true },
  { key: "upc", label: "UPC", defaultVisible: false },
  { key: "category", label: "Category", defaultVisible: true },
  { key: "vendor_id", label: "Vendor ID", defaultVisible: true },
  { key: "vendor", label: "Vendor", defaultVisible: true },
  { key: "vendor_part_number", label: "Vendor Part #", defaultVisible: false },
  { key: "price", label: "Price", defaultVisible: true },
  { key: "unit", label: "Unit", defaultVisible: true },
  { key: "width", label: "Width", defaultVisible: true },
  { key: "length", label: "Length", defaultVisible: true },
  { key: "height", label: "Height", defaultVisible: true },
  { key: "weight", label: "Weight", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "serialized", label: "Serialized", defaultVisible: false },
  { key: "is_batched", label: "Batched", defaultVisible: false },
  { key: "hazardous", label: "Hazardous", defaultVisible: false },
  { key: "keep_inventory", label: "Keep Inventory", defaultVisible: false },
  { key: "is_consumable", label: "Consumable", defaultVisible: false },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

export const PRODUCTION_ORDER_COLUMNS: ColumnDefinition[] = [
  { key: 'order_number', label: 'Order #', defaultVisible: true },
  { key: 'bom_id', label: 'BoM ID', defaultVisible: true },
  { key: 'bom_name', label: 'BoM', defaultVisible: true },
  { key: 'product_id', label: 'Output Product ID', defaultVisible: true },
  { key: 'product_name', label: 'Output Product', defaultVisible: true },
  { key: 'quantity', label: 'Quantity', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'duration', label: 'Duration', defaultVisible: true },
  { key: 'assigned_to', label: 'Assigned To', defaultVisible: true },
  { key: 'scheduled', label: 'Scheduled', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

export const ORDER_COLUMNS: ColumnDefinition[] = [
  { key: "select", label: "Select", alwaysVisible: true },
  { key: "po_number", label: "PO #", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "vendor_id", label: "Vendor ID", defaultVisible: true },
  { key: "vendor_name", label: "Vendor Name", defaultVisible: true },
  { key: "ship_to_id", label: "Ship To ID", defaultVisible: true },
  { key: "ship_to_name", label: "Ship To Name", defaultVisible: true },
  { key: "bill_to_id", label: "Bill To ID", defaultVisible: true },
  { key: "bill_to_name", label: "Bill To Name", defaultVisible: true },
  { key: "item_count", label: "Items", defaultVisible: true },
  { key: "total_amount", label: "Total", defaultVisible: true },
  { key: "created_by", label: "Created By", defaultVisible: true },
  { key: "date", label: "Date", defaultVisible: true },
  { key: "time", label: "Time", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

export const ACCOUNT_COLUMNS: ColumnDefinition[] = [
  { key: 'account_id', label: 'ID', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'parent_account', label: 'Parent Account', defaultVisible: true },
  { key: 'linked_to', label: 'Linked To', defaultVisible: true },
  { key: 'location_id', label: 'Location', defaultVisible: true },
  { key: 'ledger_id_display', label: 'Ledger ID', defaultVisible: true },
  { key: 'ledger_name_display', label: 'Ledger', defaultVisible: true },
  { key: 'balance', label: 'Balance', defaultVisible: true },
  { key: 'outstanding_invoices', label: 'Outstanding Invoices', defaultVisible: true },
  { key: 'is_active', label: 'Active', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

export const ACCOUNT_TRANSACTION_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'Record ID', defaultVisible: false },
  { key: 'invoice_id', label: 'Invoice ID', defaultVisible: false },
  { key: 'date', label: 'Date', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'reference', label: 'Reference', defaultVisible: true },
  { key: 'description', label: 'Description', defaultVisible: true },
  { key: 'amount', label: 'Amount', defaultVisible: true },
];

export const ACCOUNT_INVOICE_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'Record ID', defaultVisible: false },
  { key: 'invoice_number', label: 'Invoice #', defaultVisible: true },
  { key: 'account_id', label: 'Account ID', defaultVisible: false },
  { key: 'invoice_date', label: 'Date', defaultVisible: true },
  { key: 'purchase_order_id', label: 'Purchase Order ID', defaultVisible: false },
  { key: 'sales_order_id', label: 'Sales Order ID', defaultVisible: false },
  { key: 'reference', label: 'Reference', defaultVisible: true },
  { key: 'pay_to', label: 'Pay To', defaultVisible: true },
  { key: 'pay_to_id', label: 'Pay To ID', defaultVisible: false },
  { key: 'location', label: 'Location', defaultVisible: true },
  { key: 'location_id', label: 'Location ID', defaultVisible: true },
  { key: 'amount', label: 'Amount', defaultVisible: true },
  { key: 'ledger', label: 'Ledger', defaultVisible: true },
  { key: 'ledger_id', label: 'Ledger ID', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'due_date', label: 'Due Date', defaultVisible: true },
  { key: 'notes', label: 'Notes', defaultVisible: false },
  { key: 'created_at', label: 'Created', defaultVisible: false },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

export const ACCOUNT_PAYMENT_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'Record ID', defaultVisible: false },
  { key: 'payment_number', label: 'Payment #', defaultVisible: true },
  { key: 'account_id', label: 'Account ID', defaultVisible: false },
  { key: 'payment_date', label: 'Date', defaultVisible: true },
  { key: 'invoice', label: 'Invoice', defaultVisible: true },
  { key: 'invoice_id', label: 'Invoice ID', defaultVisible: false },
  { key: 'amount', label: 'Amount', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'processed_by', label: 'Processed By', defaultVisible: false },
  { key: 'notes', label: 'Notes', defaultVisible: false },
  { key: 'created_at', label: 'Created', defaultVisible: false },
];

export const BOM_COLUMNS: ColumnDefinition[] = [
  { key: 'bom_id', label: 'BoM ID', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'product', label: 'Output Product', defaultVisible: true },
  { key: 'output_quantity', label: 'Output Qty', defaultVisible: true },
  { key: 'steps_count', label: 'Steps', defaultVisible: true },
  { key: 'total_duration', label: 'Duration', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

export const GOODS_ISSUE_COLUMNS: ColumnDefinition[] = [
  { key: 'issue_number', label: 'Issue #', defaultVisible: true },
  { key: 'issue_date', label: 'Date', defaultVisible: true },
  { key: 'location', label: 'Location', defaultVisible: true },
  { key: 'customer', label: 'Customer', defaultVisible: true },
  { key: 'sales_order', label: 'SO', defaultVisible: true },
  { key: 'outbound_delivery', label: 'Outbound Del.', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'items', label: 'Items', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

export const CUSTOMER_COLUMNS: ColumnDefinition[] = [
  { key: 'customer_id', label: 'ID', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'contact_name', label: 'Contact', defaultVisible: true },
  { key: 'email', label: 'Email', defaultVisible: true },
  { key: 'phone', label: 'Phone', defaultVisible: true },
  { key: 'address_line1', label: 'Address', defaultVisible: true },
  { key: 'city', label: 'City', defaultVisible: true },
  { key: 'state', label: 'State', defaultVisible: true },
  { key: 'postal_code', label: 'Postal Code', defaultVisible: true },
  { key: 'country', label: 'Country', defaultVisible: true },
  { key: 'website', label: 'Website', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

export const GOODS_RECEIPT_COLUMNS: ColumnDefinition[] = [
  { key: 'receipt_number', label: 'Receipt #', defaultVisible: true },
  { key: 'delivery', label: 'Delivery', defaultVisible: true },
  { key: 'receipt_date', label: 'Date', defaultVisible: true },
  { key: 'location', label: 'Location', defaultVisible: true },
  { key: 'vendor', label: 'Vendor', defaultVisible: true },
  { key: 'purchase_order', label: 'PO', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'items', label: 'Items', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

export const CREDIT_MEMO_COLUMNS: ColumnDefinition[] = [
  { key: "memo_number", label: "Memo #", defaultVisible: true },
  { key: "memo_date", label: "Date", defaultVisible: true },
  { key: "account", label: "Account", defaultVisible: true },
  { key: "invoice", label: "Invoice", defaultVisible: true },
  { key: "amount", label: "Amount", defaultVisible: true },
  { key: "ledger", label: "Ledger", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

export const ASSET_COLUMNS: ColumnDefinition[] = [
  { key: "asset_tag", label: "Tag", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: true },
  { key: "location", label: "Location", defaultVisible: true },
  { key: "employee", label: "Assigned To", defaultVisible: true },
  { key: "procurement_value", label: "Procurement Value", defaultVisible: true },
  { key: "procurement_date", label: "Procurement Date", defaultVisible: true },
  { key: "depreciation_rate", label: "Depr. %", defaultVisible: true },
  { key: "book_value", label: "Book Value", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

export const INVENTORY_COLUMNS: ColumnDefinition[] = [
  { key: 'product_id', label: 'Product ID', defaultVisible: true },
  { key: 'product_name', label: 'Product Name', defaultVisible: true },
  { key: 'sku', label: 'SKU', defaultVisible: true },
  { key: 'category', label: 'Category', defaultVisible: true },
  { key: 'area', label: 'Area', defaultVisible: true },
  { key: 'bin', label: 'Bin', defaultVisible: true },
  { key: 'quantity', label: 'Quantity', defaultVisible: true },
  { key: 'unit', label: 'Unit', defaultVisible: true },
  { key: 'min', label: 'Min', defaultVisible: true },
  { key: 'max', label: 'Max', defaultVisible: true },
];

export const LOCATION_COLUMNS: ColumnDefinition[] = [
  { key: "location_id", label: "ID", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: true },
  { key: "type", label: "Type", defaultVisible: true },
  { key: "address_line1", label: "Address", defaultVisible: true },
  { key: "city", label: "City", defaultVisible: true },
  { key: "state", label: "State", defaultVisible: true },
  { key: "postal_code", label: "Postal Code", defaultVisible: true },
  { key: "country", label: "Country", defaultVisible: true },
  { key: "user_count", label: "Users", defaultVisible: true },
  { key: "payment_terms", label: "Payment Terms", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "is_internal_vendor", label: "Internal Vendor", defaultVisible: true },
  { key: "is_pos_enabled", label: "POS", defaultVisible: true },
  { key: "is_production_enabled", label: "Production", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

export const EMPLOYEE_COLUMNS: ColumnDefinition[] = [
  { key: "employee_id", label: "ID", defaultVisible: true },
  { key: "first_name", label: "First Name", defaultVisible: true },
  { key: "last_name", label: "Last Name", defaultVisible: true },
  { key: "email", label: "Email", defaultVisible: true },
  { key: "department", label: "Team", defaultVisible: true },
  { key: "job_title", label: "Job Title", defaultVisible: true },
  { key: "user_id", label: "User ID", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

export interface LayoutRegistryEntry { storageKey: string; label: string; columns: ColumnDefinition[] }

export const LAYOUT_REGISTRY: LayoutRegistryEntry[] = [
  { storageKey: 'accounts', label: 'Accounts', columns: ACCOUNT_COLUMNS },
  { storageKey: 'account_transactions', label: 'Account View — Transactions', columns: ACCOUNT_TRANSACTION_COLUMNS },
  { storageKey: 'account_invoices', label: 'Account View — Invoices', columns: ACCOUNT_INVOICE_COLUMNS },
  { storageKey: 'account_payments', label: 'Account View — Payments', columns: ACCOUNT_PAYMENT_COLUMNS },
  { storageKey: 'assets', label: 'Assets', columns: ASSET_COLUMNS },
  { storageKey: 'bom', label: 'Bill of Materials', columns: BOM_COLUMNS },
  { storageKey: 'credit_memos', label: 'Credit Memos', columns: CREDIT_MEMO_COLUMNS },
  { storageKey: 'customers', label: 'Customers', columns: CUSTOMER_COLUMNS },
  { storageKey: 'debit_memos', label: 'Debit Memos', columns: DEBIT_MEMO_COLUMNS },
  { storageKey: 'employees', label: 'Employees', columns: EMPLOYEE_COLUMNS },
  { storageKey: 'goods_issues', label: 'Goods Issues', columns: GOODS_ISSUE_COLUMNS },
  { storageKey: 'goods_receipts', label: 'Goods Receipts', columns: GOODS_RECEIPT_COLUMNS },
  { storageKey: 'inventory', label: 'Inventory', columns: INVENTORY_COLUMNS },
  { storageKey: 'locations', label: 'Locations', columns: LOCATION_COLUMNS },
  { storageKey: 'production_orders', label: 'Production Orders', columns: PRODUCTION_ORDER_COLUMNS },
  { storageKey: 'products', label: 'Products', columns: PRODUCT_COLUMNS },
  { storageKey: 'orders', label: 'Purchase Orders', columns: ORDER_COLUMNS },
  { storageKey: 'rates', label: 'Rates', columns: RATE_COLUMNS },
  { storageKey: 'sales_orders', label: 'Sales Orders', columns: SALES_ORDER_COLUMNS },
  { storageKey: 'vendors', label: 'Vendors', columns: VENDOR_COLUMNS },
];

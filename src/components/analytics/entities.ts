import { EntityConfig } from "./types";

export const entities: EntityConfig[] = [
  {
    name: "Products",
    table: "products",
    primaryKey: "id",
    fields: [
      { key: "product_id", label: "Product ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "description", label: "Description", type: "string" },
      { key: "category", label: "Category", type: "string" },
      { key: "sku", label: "SKU", type: "string" },
      { key: "upc", label: "UPC", type: "string" },
      { key: "price", label: "Price", type: "number" },
      { key: "cost", label: "Cost", type: "number" },
      { key: "is_active", label: "Active", type: "boolean" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [],
  },
  {
    name: "Inventory",
    table: "inventory",
    primaryKey: "id",
    fields: [
      { key: "id", label: "ID", type: "string" },
      { key: "product_id", label: "Product ID", type: "string" },
      { key: "location_id", label: "Location ID", type: "string" },
      { key: "bin_id", label: "Bin ID", type: "string" },
      { key: "quantity", label: "Quantity", type: "number" },
      { key: "min_quantity", label: "Min Quantity", type: "number" },
      { key: "max_quantity", label: "Max Quantity", type: "number" },
      { key: "updated_at", label: "Updated At", type: "date" },
    ],
    relationships: [
      { targetEntity: "Products", foreignKey: "product_id", targetKey: "id", label: "Product" },
      { targetEntity: "Locations", foreignKey: "location_id", targetKey: "id", label: "Location" },
    ],
  },
  {
    name: "Product Safety Stock",
    table: "product_safety_stock",
    primaryKey: "id",
    fields: [
      { key: "id", label: "ID", type: "string" },
      { key: "product_id", label: "Product ID", type: "string" },
      { key: "location_id", label: "Location ID", type: "string" },
      { key: "safety_stock_quantity", label: "Safety Stock Qty", type: "number" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [
      { targetEntity: "Products", foreignKey: "product_id", targetKey: "id", label: "Product" },
      { targetEntity: "Locations", foreignKey: "location_id", targetKey: "id", label: "Location" },
    ],
  },
  {
    name: "Purchase Orders",
    table: "purchase_orders",
    primaryKey: "id",
    fields: [
      { key: "po_number", label: "PO Number", type: "string" },
      { key: "vendor_id", label: "Vendor ID", type: "string" },
      { key: "location_id", label: "Location ID", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "total_amount", label: "Total Amount", type: "number" },
      { key: "order_date", label: "Order Date", type: "date" },
      { key: "expected_date", label: "Expected Date", type: "date" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [
      { targetEntity: "Vendors", foreignKey: "vendor_id", targetKey: "id", label: "Vendor" },
      { targetEntity: "Locations", foreignKey: "location_id", targetKey: "id", label: "Location" },
    ],
  },
  {
    name: "Sales Orders",
    table: "sales_orders",
    primaryKey: "id",
    fields: [
      { key: "so_number", label: "SO Number", type: "string" },
      { key: "customer_id", label: "Customer ID", type: "string" },
      { key: "location_id", label: "Location ID", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "total_amount", label: "Total Amount", type: "number" },
      { key: "order_date", label: "Order Date", type: "date" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [
      { targetEntity: "Customers", foreignKey: "customer_id", targetKey: "id", label: "Customer" },
      { targetEntity: "Locations", foreignKey: "location_id", targetKey: "id", label: "Location" },
    ],
  },
  {
    name: "Vendors",
    table: "vendors",
    primaryKey: "id",
    fields: [
      { key: "vendor_id", label: "Vendor ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "contact_name", label: "Contact", type: "string" },
      { key: "email", label: "Email", type: "string" },
      { key: "phone", label: "Phone", type: "string" },
      { key: "city", label: "City", type: "string" },
      { key: "state", label: "State", type: "string" },
      { key: "is_active", label: "Active", type: "boolean" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [],
  },
  {
    name: "Customers",
    table: "customers",
    primaryKey: "id",
    fields: [
      { key: "customer_id", label: "Customer ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "contact_name", label: "Contact", type: "string" },
      { key: "email", label: "Email", type: "string" },
      { key: "phone", label: "Phone", type: "string" },
      { key: "city", label: "City", type: "string" },
      { key: "state", label: "State", type: "string" },
      { key: "type", label: "Type", type: "string" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [],
  },
  {
    name: "Requisitions",
    table: "requisitions",
    primaryKey: "id",
    fields: [
      { key: "requisition_id", label: "Requisition ID", type: "string" },
      { key: "vendor_id", label: "Vendor ID", type: "string" },
      { key: "location_id", label: "Location ID", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "total_amount", label: "Total Amount", type: "number" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [
      { targetEntity: "Vendors", foreignKey: "vendor_id", targetKey: "id", label: "Vendor" },
      { targetEntity: "Locations", foreignKey: "location_id", targetKey: "id", label: "Location" },
    ],
  },
  {
    name: "Employees",
    table: "employees",
    primaryKey: "id",
    fields: [
      { key: "employee_id", label: "Employee ID", type: "string" },
      { key: "first_name", label: "First Name", type: "string" },
      { key: "last_name", label: "Last Name", type: "string" },
      { key: "email", label: "Email", type: "string" },
      { key: "department", label: "Department", type: "string" },
      { key: "job_title", label: "Job Title", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "hire_date", label: "Hire Date", type: "date" },
    ],
    relationships: [],
  },
  {
    name: "Locations",
    table: "locations",
    primaryKey: "id",
    fields: [
      { key: "location_id", label: "Location ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "type", label: "Type", type: "string" },
      { key: "city", label: "City", type: "string" },
      { key: "state", label: "State", type: "string" },
      { key: "country", label: "Country", type: "string" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [],
  },
  {
    name: "Invoices",
    table: "invoices",
    primaryKey: "id",
    fields: [
      { key: "invoice_number", label: "Invoice #", type: "string" },
      { key: "account_id", label: "Account ID", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "invoice_date", label: "Invoice Date", type: "date" },
      { key: "due_date", label: "Due Date", type: "date" },
    ],
    relationships: [
      { targetEntity: "Accounts", foreignKey: "account_id", targetKey: "id", label: "Account" },
      { targetEntity: "Purchase Orders", foreignKey: "purchase_order_id", targetKey: "id", label: "Purchase Order" },
      { targetEntity: "Sales Orders", foreignKey: "sales_order_id", targetKey: "id", label: "Sales Order" },
    ],
  },
  {
    name: "Accounts",
    table: "accounts",
    primaryKey: "id",
    fields: [
      { key: "account_id", label: "Account ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "type", label: "Type", type: "string" },
      { key: "description", label: "Description", type: "string" },
      { key: "is_active", label: "Active", type: "boolean" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [
      { targetEntity: "Customers", foreignKey: "customer_id", targetKey: "id", label: "Customer" },
      { targetEntity: "Vendors", foreignKey: "vendor_id", targetKey: "id", label: "Vendor" },
      { targetEntity: "Locations", foreignKey: "location_id", targetKey: "id", label: "Location" },
    ],
  },
  {
    name: "Deliveries",
    table: "deliveries",
    primaryKey: "id",
    fields: [
      { key: "delivery_id", label: "Delivery ID", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "carrier", label: "Carrier", type: "string" },
      { key: "tracking_number", label: "Tracking #", type: "string" },
      { key: "expected_date", label: "Expected Date", type: "date" },
      { key: "delivered_date", label: "Delivered Date", type: "date" },
      { key: "is_fulfilled", label: "Fulfilled", type: "boolean" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [
      { targetEntity: "Vendors", foreignKey: "vendor_id", targetKey: "id", label: "Vendor" },
      { targetEntity: "Locations", foreignKey: "location_id", targetKey: "id", label: "Location" },
      { targetEntity: "Purchase Orders", foreignKey: "purchase_order_id", targetKey: "id", label: "Purchase Order" },
    ],
  },
  {
    name: "Goods Receipts",
    table: "goods_receipts",
    primaryKey: "id",
    fields: [
      { key: "receipt_number", label: "Receipt #", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "receipt_date", label: "Receipt Date", type: "date" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [
      { targetEntity: "Vendors", foreignKey: "vendor_id", targetKey: "id", label: "Vendor" },
      { targetEntity: "Locations", foreignKey: "location_id", targetKey: "id", label: "Location" },
      { targetEntity: "Purchase Orders", foreignKey: "purchase_order_id", targetKey: "id", label: "Purchase Order" },
      { targetEntity: "Deliveries", foreignKey: "delivery_id", targetKey: "id", label: "Delivery" },
    ],
  },
  {
    name: "Goods Issues",
    table: "goods_issues",
    primaryKey: "id",
    fields: [
      { key: "issue_number", label: "Issue #", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "issue_date", label: "Issue Date", type: "date" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
    relationships: [
      { targetEntity: "Customers", foreignKey: "customer_id", targetKey: "id", label: "Customer" },
      { targetEntity: "Locations", foreignKey: "location_id", targetKey: "id", label: "Location" },
      { targetEntity: "Sales Orders", foreignKey: "sales_order_id", targetKey: "id", label: "Sales Order" },
    ],
  },
];

/**
 * Find a join path between two entities.
 * Returns the chain of relationships needed to connect them.
 */
export function findJoinPath(
  fromEntity: string,
  toEntity: string,
  visited: Set<string> = new Set()
): EntityConfig["relationships"][0][] | null {
  if (fromEntity === toEntity) return [];
  
  visited.add(fromEntity);
  const entity = entities.find(e => e.name === fromEntity);
  if (!entity) return null;

  // Direct relationship
  const direct = entity.relationships.find(r => r.targetEntity === toEntity);
  if (direct) return [direct];

  // Check reverse relationships (other entities pointing to this one)
  for (const other of entities) {
    if (visited.has(other.name)) continue;
    const reverseRel = other.relationships.find(r => r.targetEntity === fromEntity);
    if (reverseRel && other.name === toEntity) {
      return [{ ...reverseRel, targetEntity: fromEntity, foreignKey: reverseRel.foreignKey, targetKey: reverseRel.targetKey, label: reverseRel.label }];
    }
  }

  // BFS through relationships
  for (const rel of entity.relationships) {
    if (visited.has(rel.targetEntity)) continue;
    const path = findJoinPath(rel.targetEntity, toEntity, new Set(visited));
    if (path) return [rel, ...path];
  }

  return null;
}

/**
 * Check if an entity can be reached from any of the existing entities in the report.
 */
export function canReachEntity(existingEntities: string[], newEntity: string): boolean {
  if (existingEntities.length === 0) return true;
  if (existingEntities.includes(newEntity)) return true;
  
  for (const existing of existingEntities) {
    if (findJoinPath(existing, newEntity)) return true;
    if (findJoinPath(newEntity, existing)) return true;
  }
  return false;
}

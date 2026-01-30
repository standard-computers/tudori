export interface EntityField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
}

export interface EntityConfig {
  name: string;
  table: string;
  fields: EntityField[];
}

export interface FieldFilter {
  fieldKey: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is_null" | "not_null";
  value: string;
}

export interface ReportField {
  id: string;
  entityName: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: EntityField["type"];
  filter?: FieldFilter;
}

export interface SavedReport {
  id: string;
  name: string;
  entity: string;
  fields: ReportField[];
  createdAt: string;
}

export interface ReportTab {
  id: string;
  name: string;
  isNew: boolean;
  entity: string;
  fields: ReportField[];
  results: Record<string, unknown>[];
}

export interface EntityField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
}

export interface EntityRelationship {
  /** The entity this relationship points to */
  targetEntity: string;
  /** The FK column on this entity */
  foreignKey: string;
  /** The PK column on the target entity (defaults to table's PK) */
  targetKey: string;
  /** Human-readable label */
  label: string;
}

export interface EntityConfig {
  name: string;
  table: string;
  primaryKey: string;
  fields: EntityField[];
  relationships: EntityRelationship[];
}

export type AggregateFunction = "none" | "count" | "sum" | "avg" | "min" | "max" | "count_distinct";

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
  aggregate?: AggregateFunction;
}

export interface CalculatedColumn {
  id: string;
  name: string;
  expression: string; // e.g. "price - cost" or "quantity * price"
  resultType: EntityField["type"];
}

export interface SavedReport {
  id: string;
  name: string;
  entities: string[]; // multiple entities now
  fields: ReportField[];
  calculatedColumns: CalculatedColumn[];
  createdAt: string;
}

export interface ReportTab {
  id: string;
  name: string;
  isNew: boolean;
  entities: string[]; // multiple entities
  fields: ReportField[];
  calculatedColumns: CalculatedColumn[];
  results: Record<string, unknown>[];
}

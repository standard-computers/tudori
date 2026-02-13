import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportFieldPayload {
  entityName: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  aggregate?: string;
  filter?: {
    operator: string;
    value: string;
  };
}

interface CalculatedColumnPayload {
  name: string;
  expression: string;
}

interface EntityDef {
  name: string;
  table: string;
  primaryKey: string;
  relationships: {
    targetEntity: string;
    foreignKey: string;
    targetKey: string;
  }[];
}

interface QueryRequest {
  fields: ReportFieldPayload[];
  calculatedColumns: CalculatedColumnPayload[];
  entities: EntityDef[];
  limit: number;
  companyId: string;
}

// Whitelist of allowed tables to prevent SQL injection
const ALLOWED_TABLES = new Set([
  "products", "inventory", "product_safety_stock", "purchase_orders",
  "sales_orders", "vendors", "customers", "requisitions", "employees",
  "locations", "invoices", "accounts", "deliveries", "goods_receipts",
  "goods_issues",
]);

// Whitelist of allowed column name patterns
const COLUMN_PATTERN = /^[a-z_][a-z0-9_]*$/;

const ALLOWED_AGGREGATES = new Set(["count", "sum", "avg", "min", "max", "count_distinct"]);

function sanitizeIdentifier(id: string): string {
  if (!COLUMN_PATTERN.test(id)) {
    throw new Error(`Invalid identifier: ${id}`);
  }
  return `"${id}"`;
}

function sanitizeTableName(table: string): string {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table not allowed: ${table}`);
  }
  return `"${table}"`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify company access
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    const body: QueryRequest = await req.json();

    if (!profile || profile.company_id !== body.companyId) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build SQL query
    const { fields, calculatedColumns, entities, limit, companyId } = body;
    
    if (!fields || fields.length === 0) {
      return new Response(JSON.stringify({ error: "No fields specified" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which tables are involved
    const usedEntityNames = new Set(fields.map(f => f.entityName));
    const usedEntities = entities.filter(e => usedEntityNames.has(e.name));

    if (usedEntities.length === 0) {
      return new Response(JSON.stringify({ error: "No valid entities" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine primary (base) entity - first one that has company_id, or the first one
    const baseEntity = usedEntities[0];
    const otherEntities = usedEntities.slice(1);

    // Check if we have aggregations
    const hasAggregates = fields.some(f => f.aggregate && f.aggregate !== "none");

    // Build SELECT columns
    const selectParts: string[] = [];
    const groupByParts: string[] = [];

    for (const field of fields) {
      const entity = entities.find(e => e.name === field.entityName);
      if (!entity) continue;

      const tableAlias = sanitizeTableName(entity.table);
      const col = sanitizeIdentifier(field.fieldKey);
      const qualifiedCol = `${tableAlias}.${col}`;
      const alias = `"${entity.table}__${field.fieldKey}"`;

      if (field.aggregate && field.aggregate !== "none") {
        if (!ALLOWED_AGGREGATES.has(field.aggregate)) {
          throw new Error(`Invalid aggregate: ${field.aggregate}`);
        }
        if (field.aggregate === "count_distinct") {
          selectParts.push(`COUNT(DISTINCT ${qualifiedCol}) AS ${alias}`);
        } else {
          selectParts.push(`${field.aggregate.toUpperCase()}(${qualifiedCol}) AS ${alias}`);
        }
      } else {
        selectParts.push(`${qualifiedCol} AS ${alias}`);
        if (hasAggregates) {
          groupByParts.push(qualifiedCol);
        }
      }
    }

    // Add calculated columns
    for (const calc of (calculatedColumns || [])) {
      // Basic expression validation - only allow column refs, operators, numbers
      const safeExpr = calc.expression.replace(
        /([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/gi,
        (_, table, col) => `${sanitizeTableName(table)}.${sanitizeIdentifier(col)}`
      );
      selectParts.push(`(${safeExpr}) AS "${calc.name}"`);
    }

    // Build FROM + JOINs
    let fromClause = `FROM ${sanitizeTableName(baseEntity.table)}`;
    const joinedTables = new Set([baseEntity.table]);

    // Build joins for other entities
    for (const otherEntity of otherEntities) {
      if (joinedTables.has(otherEntity.table)) continue;

      // Find relationship path
      let joined = false;

      // Check if base entity has a relationship to other
      for (const rel of baseEntity.relationships) {
        const targetEnt = entities.find(e => e.name === rel.targetEntity);
        if (targetEnt && targetEnt.table === otherEntity.table) {
          fromClause += ` LEFT JOIN ${sanitizeTableName(otherEntity.table)} ON ${sanitizeTableName(baseEntity.table)}.${sanitizeIdentifier(rel.foreignKey)} = ${sanitizeTableName(otherEntity.table)}.${sanitizeIdentifier(rel.targetKey)}`;
          joinedTables.add(otherEntity.table);
          joined = true;
          break;
        }
      }

      // Check reverse - other entity has relationship to base
      if (!joined) {
        for (const rel of otherEntity.relationships) {
          const targetEnt = entities.find(e => e.name === rel.targetEntity);
          if (targetEnt && targetEnt.table === baseEntity.table) {
            fromClause += ` LEFT JOIN ${sanitizeTableName(otherEntity.table)} ON ${sanitizeTableName(otherEntity.table)}.${sanitizeIdentifier(rel.foreignKey)} = ${sanitizeTableName(baseEntity.table)}.${sanitizeIdentifier(rel.targetKey)}`;
            joinedTables.add(otherEntity.table);
            joined = true;
            break;
          }
        }
      }

      // Try through already-joined tables
      if (!joined) {
        for (const joinedTable of joinedTables) {
          const joinedEntity = entities.find(e => e.table === joinedTable);
          if (!joinedEntity) continue;

          for (const rel of joinedEntity.relationships) {
            const targetEnt = entities.find(e => e.name === rel.targetEntity);
            if (targetEnt && targetEnt.table === otherEntity.table) {
              fromClause += ` LEFT JOIN ${sanitizeTableName(otherEntity.table)} ON ${sanitizeTableName(joinedTable)}.${sanitizeIdentifier(rel.foreignKey)} = ${sanitizeTableName(otherEntity.table)}.${sanitizeIdentifier(rel.targetKey)}`;
              joinedTables.add(otherEntity.table);
              joined = true;
              break;
            }
          }
          if (joined) break;

          // Check reverse
          for (const rel of otherEntity.relationships) {
            const targetEnt = entities.find(e => e.name === rel.targetEntity);
            if (targetEnt && targetEnt.table === joinedTable) {
              fromClause += ` LEFT JOIN ${sanitizeTableName(otherEntity.table)} ON ${sanitizeTableName(otherEntity.table)}.${sanitizeIdentifier(rel.foreignKey)} = ${sanitizeTableName(joinedTable)}.${sanitizeIdentifier(rel.targetKey)}`;
              joinedTables.add(otherEntity.table);
              joined = true;
              break;
            }
          }
          if (joined) break;
        }
      }

      if (!joined) {
        return new Response(
          JSON.stringify({ error: `Cannot join ${otherEntity.name} - no relationship found` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build WHERE clause
    const whereParts: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Always filter by company_id on base table (cast to uuid since params are passed as text)
    whereParts.push(`${sanitizeTableName(baseEntity.table)}."company_id" = $${paramIndex}::uuid`);
    params.push(companyId);
    paramIndex++;

    // Apply field filters
    for (const field of fields) {
      if (!field.filter) continue;
      const entity = entities.find(e => e.name === field.entityName);
      if (!entity) continue;

      const qualifiedCol = `${sanitizeTableName(entity.table)}.${sanitizeIdentifier(field.fieldKey)}`;
      const { operator, value } = field.filter;
      // Cast to uuid if the field looks like a UUID column
      const castSuffix = field.fieldKey.endsWith("_id") || field.fieldKey === "id" ? "::uuid" : "";

      switch (operator) {
        case "eq":
          whereParts.push(`${qualifiedCol} = $${paramIndex}${castSuffix}`);
          params.push(value);
          paramIndex++;
          break;
        case "neq":
          whereParts.push(`${qualifiedCol} != $${paramIndex}${castSuffix}`);
          params.push(value);
          paramIndex++;
          break;
        case "gt":
          whereParts.push(`${qualifiedCol} > $${paramIndex}`);
          params.push(value);
          paramIndex++;
          break;
        case "gte":
          whereParts.push(`${qualifiedCol} >= $${paramIndex}`);
          params.push(value);
          paramIndex++;
          break;
        case "lt":
          whereParts.push(`${qualifiedCol} < $${paramIndex}`);
          params.push(value);
          paramIndex++;
          break;
        case "lte":
          whereParts.push(`${qualifiedCol} <= $${paramIndex}`);
          params.push(value);
          paramIndex++;
          break;
        case "like":
          whereParts.push(`${qualifiedCol} LIKE $${paramIndex}`);
          params.push(`%${value}%`);
          paramIndex++;
          break;
        case "ilike":
          whereParts.push(`${qualifiedCol} ILIKE $${paramIndex}`);
          params.push(`%${value}%`);
          paramIndex++;
          break;
        case "is_null":
          whereParts.push(`${qualifiedCol} IS NULL`);
          break;
        case "not_null":
          whereParts.push(`${qualifiedCol} IS NOT NULL`);
          break;
      }
    }

    // Assemble query
    let sql = `SELECT ${selectParts.join(", ")} ${fromClause}`;
    if (whereParts.length > 0) {
      sql += ` WHERE ${whereParts.join(" AND ")}`;
    }
    if (hasAggregates && groupByParts.length > 0) {
      sql += ` GROUP BY ${groupByParts.join(", ")}`;
    }
    sql += ` LIMIT ${Math.min(Math.max(parseInt(String(limit)) || 100, 1), 1000)}`;

    console.log("Executing SQL:", sql);
    console.log("Params:", params);

    // Execute query using service role
    const { data, error } = await supabase.rpc("execute_analytics_query", {
      query_text: sql,
      query_params: params,
    });

    if (error) {
      console.error("Query execution error:", error);
      // Fall back to direct query if RPC doesn't exist yet
      // Use raw SQL via PostgREST
      const pgResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/execute_analytics_query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ query_text: sql, query_params: params }),
        }
      );

      if (!pgResponse.ok) {
        // If RPC doesn't exist, return helpful error
        return new Response(
          JSON.stringify({ 
            error: "Analytics query function not ready. Please run the database migration first.",
            sql_preview: sql,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pgData = await pgResponse.json();
      return new Response(JSON.stringify({ data: pgData, sql_preview: sql }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data, sql_preview: sql }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { prompt, entitiesSchema } = await req.json();

    if (!prompt || !entitiesSchema) {
      return new Response(JSON.stringify({ error: "Missing prompt or entitiesSchema" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a report builder assistant for an ERP analytics platform. Given a user's natural language description of a report they want, you must return a JSON object that configures the report.

Available entities and their fields:
${JSON.stringify(entitiesSchema, null, 2)}

You MUST return a JSON object with this exact structure:
{
  "name": "Report Name",
  "entities": ["EntityName1", "EntityName2"],
  "fields": [
    {
      "entityName": "EntityName",
      "fieldKey": "field_key",
      "fieldLabel": "Field Label",
      "fieldType": "string|number|boolean|date",
      "aggregate": "none|count|sum|avg|min|max|count_distinct",
      "filter": { "operator": "eq|neq|gt|gte|lt|lte|like|ilike|is_null|not_null", "value": "filter_value" }
    }
  ]
}

Rules:
- Only use entity names and field keys that exist in the schema above.
- "entities" should list ALL unique entity names referenced by the fields.
- Each field's entityName, fieldKey, fieldLabel, and fieldType must match exactly what's in the schema.
- Use aggregates when the user asks for totals, counts, averages, etc.
- Use filters when the user specifies conditions (e.g. "active vendors", "orders after 2024").
- The "filter" property on a field is optional. Only include it if the user specifies filtering criteria for that field.
- The "aggregate" property defaults to "none" for non-aggregated fields.
- Give the report a clear, concise name based on the user's request.
- Ensure entities used together are connected via relationships in the schema.
- Return ONLY the JSON object, no markdown, no explanation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    // Strip markdown code fences if present
    content = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    // Parse and validate
    let reportConfig;
    try {
      reportConfig = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "AI returned invalid JSON. Please try rephrasing your request." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ report: reportConfig }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("build-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

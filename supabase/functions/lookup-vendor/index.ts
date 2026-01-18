import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName } = await req.json();
    
    if (!companyName || companyName.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "Company name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Looking up company:", companyName);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `You are a business information lookup assistant. Given a company name, provide accurate contact information. Only return information you are confident about. For fields you're unsure about, return null. Always verify the company exists before providing details.`
          },
          {
            role: "user",
            content: `Look up business contact information for: "${companyName}". Find their official website, main phone number, headquarters address, and any general contact email if publicly available.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_company_info",
              description: "Provide the company's contact information",
              parameters: {
                type: "object",
                properties: {
                  found: { 
                    type: "boolean", 
                    description: "Whether the company was found and verified" 
                  },
                  website: { 
                    type: "string", 
                    description: "Company website URL (null if unknown)" 
                  },
                  phone: { 
                    type: "string", 
                    description: "Main phone number (null if unknown)" 
                  },
                  email: { 
                    type: "string", 
                    description: "General contact email (null if unknown)" 
                  },
                  address_line1: { 
                    type: "string", 
                    description: "Street address (null if unknown)" 
                  },
                  city: { 
                    type: "string", 
                    description: "City (null if unknown)" 
                  },
                  state: { 
                    type: "string", 
                    description: "State/Province (null if unknown)" 
                  },
                  postal_code: { 
                    type: "string", 
                    description: "Postal/ZIP code (null if unknown)" 
                  },
                  country: { 
                    type: "string", 
                    description: "Country (null if unknown)" 
                  }
                },
                required: ["found"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_company_info" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI lookup failed");
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "provide_company_info") {
      return new Response(
        JSON.stringify({ error: "Could not find company information" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyInfo = JSON.parse(toolCall.function.arguments);
    console.log("Parsed company info:", companyInfo);

    if (!companyInfo.found) {
      return new Response(
        JSON.stringify({ error: "Company not found or could not be verified" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(companyInfo),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Lookup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

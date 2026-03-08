import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportData {
  totalAssets: number;
  activeAssets: number;
  borrowedAssets: number;
  damagedAssets: number;
  lostAssets: number;
  totalValue: number;
  utilizationRate: number;
  maintenanceCost: number;
  totalRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  totalMaintenance: number;
  completedMaintenance: number;
  period: { from: string; to: string };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const data: ReportData = await req.json();

    if (!LOVABLE_API_KEY) {
      console.log('No LOVABLE_API_KEY found, falling back to client-side template');
      // Return empty so the client code knows to fallback to template
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `You are an asset management analyst. Analyze the following data and provide insights:

Period: ${new Date(data.period.from).toLocaleDateString()} to ${new Date(data.period.to).toLocaleDateString()}

Asset Statistics:
- Total Assets: ${data.totalAssets}
- Active: ${data.activeAssets}
- Borrowed: ${data.borrowedAssets}
- Damaged: ${data.damagedAssets}
- Lost: ${data.lostAssets}
- Total Value: $${data.totalValue.toLocaleString()}
- Utilization Rate: ${data.utilizationRate}%

Operations:
- Total Borrow Requests: ${data.totalRequests}
- Approved: ${data.approvedRequests}
- Rejected: ${data.rejectedRequests}
- Maintenance Tasks: ${data.totalMaintenance}
- Completed: ${data.completedMaintenance}
- Maintenance Cost: $${data.maintenanceCost.toLocaleString()}

Provide:
1. A concise executive summary (2-3 sentences)
2. 3-4 key findings
3. 3-4 actionable recommendations
4. Brief trend analysis (2-3 sentences)

Format as JSON with keys: executive_summary, key_findings (array), recommendations (array), trends`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert asset management analyst. Provide clear, actionable insights in JSON format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error('AI API request failed');
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const insights = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(insights), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return empty to fallback to template
    return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  } catch (error) {
    console.error('AI insights generation failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate insights' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

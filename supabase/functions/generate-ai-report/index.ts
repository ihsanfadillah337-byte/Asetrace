import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_GATEWAY_ID = 'ESP32_ADMIN';

interface ReportRequest {
  dateRange: {
    from: string;
    to: string;
  };
}

interface GhostAsset {
  id: string;
  name: string;
  status: string;
  detected_location: string;
  detected_by: string;
  last_seen: string;
}

interface HoardingAsset {
  id: string;
  name: string;
  borrower: string;
  room: string;
  stagnant_hours: number;
  last_movement: string;
}

// Helper: Create notification for admins/operators
async function createNotificationForAdmins(
  supabase: any,
  type: string,
  title: string,
  message: string,
  entityType: string | null = null,
  entityId: string | null = null
) {
  try {
    const { data: adminUsers, error: usersError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'operator']);

    if (usersError || !adminUsers?.length) {
      console.log('No admin/operator users found for notification');
      return;
    }

    const notifications = adminUsers.map((user: any) => ({
      user_id: user.user_id,
      type,
      title,
      message,
      related_entity_type: entityType,
      related_entity_id: entityId,
      read_status: false,
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error creating notifications:', insertError);
    } else {
      console.log(`Created ${notifications.length} notifications for type: ${type}`);
    }
  } catch (err) {
    console.error('Error in createNotificationForAdmins:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dateRange }: ReportRequest = await req.json();
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);

    console.log(`Generating comprehensive report for period: ${fromDate.toISOString()} to ${toDate.toISOString()}`);

    // ========== SECTION A: TRANSACTIONAL DATA (Legacy) ==========
    
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*');
    
    if (assetsError) throw new Error(`Assets query failed: ${assetsError.message}`);

    const { data: borrowRequests, error: borrowError } = await supabase
      .from('borrow_requests')
      .select('*, students(full_name)')
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString());

    if (borrowError) throw new Error(`Borrow requests query failed: ${borrowError.message}`);

    const { data: maintenanceRecords, error: maintenanceError } = await supabase
      .from('maintenance_history')
      .select('*')
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString());

    if (maintenanceError) throw new Error(`Maintenance query failed: ${maintenanceError.message}`);

    const transactionalData = {
      totalAssets: assets?.length || 0,
      activeAssets: assets?.filter(a => a.status === 'active').length || 0,
      borrowedAssets: assets?.filter(a => a.status === 'borrowed').length || 0,
      damagedAssets: assets?.filter(a => a.status === 'damaged').length || 0,
      lostAssets: assets?.filter(a => a.status === 'lost').length || 0,
      idleAssets: assets?.filter(a => a.status === 'idle').length || 0,
      maintenanceAssets: assets?.filter(a => a.status === 'maintenance').length || 0,
      totalValue: assets?.reduce((sum, a) => sum + (a.value || 0), 0) || 0,
      
      totalRequests: borrowRequests?.length || 0,
      approvedRequests: borrowRequests?.filter(r => r.status === 'Approved').length || 0,
      rejectedRequests: borrowRequests?.filter(r => r.status === 'Rejected').length || 0,
      pendingRequests: borrowRequests?.filter(r => r.status === 'Pending').length || 0,
      returnedRequests: borrowRequests?.filter(r => r.status === 'Returned').length || 0,
      
      totalMaintenance: maintenanceRecords?.length || 0,
      completedMaintenance: maintenanceRecords?.filter(m => m.status === 'completed').length || 0,
      scheduledMaintenance: maintenanceRecords?.filter(m => m.status === 'scheduled').length || 0,
      inProgressMaintenance: maintenanceRecords?.filter(m => m.status === 'in_progress').length || 0,
      maintenanceCost: maintenanceRecords?.reduce((sum, m) => sum + (m.cost || 0), 0) || 0,
    };

    console.log('Transactional data calculated:', transactionalData);

    // ========== SECTION B: DIGITAL TWIN DATA (New Spatial Intelligence) ==========

    const { data: assetLocations, error: locationsError } = await supabase
      .from('asset_locations')
      .select(`
        *,
        rooms:room_id (room_name, room_code)
      `);

    if (locationsError) console.error('Locations query error:', locationsError.message);

    const { data: gateways, error: gatewaysError } = await supabase
      .from('ble_gateways')
      .select('*, rooms:room_id (room_name, room_code)');

    if (gatewaysError) console.error('Gateways query error:', gatewaysError.message);

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: movementHistory, error: movementError } = await supabase
      .from('asset_movement_history')
      .select('*')
      .gte('moved_at', fortyEightHoursAgo);

    if (movementError) console.error('Movement history error:', movementError.message);

    // 1. Ghost Asset Detection
    const ghostAssets: GhostAsset[] = [];
    
    const activeAvailableAssets = assets?.filter(a => a.status === 'active' && a.ble_tag_mac) || [];
    
    for (const asset of activeAvailableAssets) {
      const location = assetLocations?.find(loc => loc.asset_id === asset.id);
      
      if (location && location.receiver_id !== ADMIN_GATEWAY_ID) {
        const detectedRoom = location.rooms as any;
        ghostAssets.push({
          id: asset.id,
          name: asset.name,
          status: asset.status,
          detected_location: detectedRoom?.room_name || 'Unknown Room',
          detected_by: location.receiver_id,
          last_seen: location.updated_at,
        });
      }
    }

    console.log(`Ghost assets detected: ${ghostAssets.length}`);

    // Create notifications for ghost assets
    if (ghostAssets.length > 0) {
      await createNotificationForAdmins(
        supabase,
        'ghost_asset',
        'Security Alert: Ghost Assets Detected',
        `${ghostAssets.length} asset(s) marked as Available but detected outside Admin Room: ${ghostAssets.map(g => g.name).join(', ')}`,
        'asset',
        ghostAssets[0].id
      );
    }

    // 2. Visibility Score
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const bleTaggedAssets = assets?.filter(a => a.ble_tag_mac) || [];
    const recentlyDetectedAssets = assetLocations?.filter(loc => {
      const updatedAt = new Date(loc.updated_at);
      return updatedAt >= twentyFourHoursAgo;
    }) || [];
    
    const visibilityScore = bleTaggedAssets.length > 0 
      ? Math.round((recentlyDetectedAssets.length / bleTaggedAssets.length) * 100) 
      : 0;

    console.log(`Visibility score: ${visibilityScore}%`);

    // Create notification for low visibility
    if (visibilityScore < 50 && bleTaggedAssets.length > 0) {
      await createNotificationForAdmins(
        supabase,
        'visibility_warning',
        'Visibility Alert: Low Tracking Coverage',
        `Only ${visibilityScore}% of BLE-tagged assets detected in the last 24 hours. Check gateway status.`,
        null,
        null
      );
    }

    // 3. Hoarding Analysis
    const hoardingAssets: HoardingAsset[] = [];
    
    const borrowedAssets = assets?.filter(a => a.status === 'borrowed' && a.ble_tag_mac) || [];
    
    for (const asset of borrowedAssets) {
      const location = assetLocations?.find(loc => loc.asset_id === asset.id);
      const movements = movementHistory?.filter(m => m.asset_id === asset.id) || [];
      
      if (location) {
        const lastMovement = movements.length > 0 
          ? new Date(Math.max(...movements.map(m => new Date(m.moved_at).getTime())))
          : new Date(location.updated_at);
        
        const stagnantHours = (Date.now() - lastMovement.getTime()) / (1000 * 60 * 60);
        
        if (stagnantHours >= 48 || movements.length === 0) {
          const detectedRoom = location.rooms as any;
          
          const activeBorrow = borrowRequests?.find(
            r => r.asset_id === asset.id && r.status === 'Approved'
          );
          
          hoardingAssets.push({
            id: asset.id,
            name: asset.name,
            borrower: (activeBorrow?.students as any)?.full_name || asset.last_user || 'Unknown',
            room: detectedRoom?.room_name || 'Unknown Room',
            stagnant_hours: Math.round(stagnantHours),
            last_movement: lastMovement.toISOString(),
          });
        }
      }
    }

    console.log(`Hoarding assets detected: ${hoardingAssets.length}`);

    // Gateway status summary
    const now = new Date();
    const onlineGateways = gateways?.filter(g => {
      const lastSeen = new Date(g.last_seen);
      return (now.getTime() - lastSeen.getTime()) < 30000;
    }).length || 0;
    const totalGateways = gateways?.length || 0;

    const digitalTwinData = {
      ghostAssets,
      ghostAssetCount: ghostAssets.length,
      visibilityScore,
      hoardingAssets,
      hoardingAssetCount: hoardingAssets.length,
      bleTaggedAssetCount: bleTaggedAssets.length,
      detectedAssetCount: recentlyDetectedAssets.length,
      onlineGateways,
      totalGateways,
      adminGatewayActive: gateways?.some(g => g.receiver_id === ADMIN_GATEWAY_ID && 
        (now.getTime() - new Date(g.last_seen).getTime()) < 30000) || false,
    };

    console.log('Digital Twin data calculated:', {
      ghostAssetCount: digitalTwinData.ghostAssetCount,
      visibilityScore: digitalTwinData.visibilityScore,
      hoardingAssetCount: digitalTwinData.hoardingAssetCount,
    });

    // ========== SECTION C: AI NARRATIVE GENERATION ==========
    
    const combinedPrompt = `You are a Senior Asset Auditor at a university/institution. Analyze this comprehensive asset management data and generate a professional audit report.

=== ADMINISTRATIVE DATA (TRANSACTIONAL) ===
Period: ${fromDate.toLocaleDateString()} to ${toDate.toLocaleDateString()}

Asset Portfolio:
- Total Assets: ${transactionalData.totalAssets}
- Active/Available: ${transactionalData.activeAssets}
- Currently Borrowed: ${transactionalData.borrowedAssets}
- Under Maintenance: ${transactionalData.maintenanceAssets}
- Damaged: ${transactionalData.damagedAssets}
- Lost: ${transactionalData.lostAssets}
- Idle: ${transactionalData.idleAssets}
- Total Portfolio Value: Rp ${transactionalData.totalValue.toLocaleString('id-ID')}

Borrow Operations:
- Total Requests: ${transactionalData.totalRequests}
- Approved: ${transactionalData.approvedRequests}
- Rejected: ${transactionalData.rejectedRequests}
- Pending: ${transactionalData.pendingRequests}
- Returned: ${transactionalData.returnedRequests}
- Approval Rate: ${transactionalData.totalRequests > 0 ? ((transactionalData.approvedRequests / transactionalData.totalRequests) * 100).toFixed(1) : 0}%

Maintenance:
- Total Tasks: ${transactionalData.totalMaintenance}
- Completed: ${transactionalData.completedMaintenance}
- In Progress: ${transactionalData.inProgressMaintenance}
- Scheduled: ${transactionalData.scheduledMaintenance}
- Total Cost: Rp ${transactionalData.maintenanceCost.toLocaleString('id-ID')}

=== DIGITAL TWIN DATA (SPATIAL INTELLIGENCE) ===

IoT Infrastructure:
- Online Gateways: ${digitalTwinData.onlineGateways}/${digitalTwinData.totalGateways}
- Admin Room Gateway (ESP32_ADMIN): ${digitalTwinData.adminGatewayActive ? 'ONLINE' : 'OFFLINE'}
- BLE-Tagged Assets: ${digitalTwinData.bleTaggedAssetCount}

Visibility Score: ${digitalTwinData.visibilityScore}%
(${digitalTwinData.detectedAssetCount} of ${digitalTwinData.bleTaggedAssetCount} tagged assets detected in last 24h)

COMPLIANCE VIOLATIONS:
Ghost Assets Detected: ${digitalTwinData.ghostAssetCount}
${ghostAssets.length > 0 ? `
Ghost Asset List (Assets marked 'Available' but detected outside Admin Room):
${ghostAssets.map(g => `- ${g.name}: Detected at ${g.detected_location} by ${g.detected_by} at ${new Date(g.last_seen).toLocaleString()}`).join('\n')}

Implication: These assets should be in the Admin/Warehouse but are physically located elsewhere. This indicates either:
1. Admin forgot to properly process the return
2. Asset was returned to wrong location
3. Potential unauthorized movement
` : 'No Ghost Assets detected - All available assets properly accounted for in Admin Room or untracked.'}

Hoarding Analysis: ${digitalTwinData.hoardingAssetCount} assets
${hoardingAssets.length > 0 ? `
Stagnant Borrowed Assets (No movement for 48+ hours):
${hoardingAssets.map(h => `- ${h.name}: Borrowed by ${h.borrower}, stagnant at ${h.room} for ${h.stagnant_hours} hours`).join('\n')}
` : 'No hoarding behavior detected - All borrowed assets showing normal movement patterns.'}

=== REQUIRED OUTPUT FORMAT ===
Generate a JSON response with exactly this structure:
{
  "executive_summary": "2-3 sentence overview highlighting both administrative health and physical compliance status. If ghost assets exist, this MUST be prominently mentioned as a critical finding.",
  
  "financial_ops": {
    "portfolio_value": "formatted value with currency",
    "utilization_rate": "percentage with context",
    "maintenance_efficiency": "assessment of maintenance operations",
    "borrow_performance": "assessment of borrow request handling"
  },
  
  "spatial_intelligence": {
    "visibility_assessment": "analysis of IoT tracking coverage",
    "ghost_asset_analysis": "detailed analysis if ghost assets exist, or confirmation of compliance if none",
    "hoarding_analysis": "assessment of asset stagnation patterns",
    "infrastructure_health": "gateway network status assessment"
  },
  
  "strategic_recommendations": [
    "Specific, actionable recommendation 1 (mention specific rooms/assets if applicable)",
    "Specific, actionable recommendation 2",
    "Specific, actionable recommendation 3",
    "Specific, actionable recommendation 4"
  ],
  
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "risk_factors": ["list of specific risk factors identified"]
}`;

    console.log('Calling Lovable AI for narrative generation...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a Senior Asset Auditor generating professional compliance reports. Always output valid JSON only, no markdown formatting.'
          },
          {
            role: 'user',
            content: combinedPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error('AI narrative generation failed');
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices[0]?.message?.content || '';
    
    console.log('AI response received, parsing...');

    let aiInsights;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiInsights = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      aiInsights = {
        executive_summary: `Report generated for ${transactionalData.totalAssets} assets. ${digitalTwinData.ghostAssetCount > 0 ? `WARNING: ${digitalTwinData.ghostAssetCount} Ghost Assets detected requiring immediate attention.` : 'All assets are properly accounted for.'}`,
        financial_ops: {
          portfolio_value: `Rp ${transactionalData.totalValue.toLocaleString('id-ID')}`,
          utilization_rate: `${transactionalData.borrowedAssets} assets currently in use`,
          maintenance_efficiency: `${transactionalData.completedMaintenance}/${transactionalData.totalMaintenance} tasks completed`,
          borrow_performance: `${transactionalData.approvedRequests}/${transactionalData.totalRequests} requests approved`
        },
        spatial_intelligence: {
          visibility_assessment: `${digitalTwinData.visibilityScore}% tracking visibility`,
          ghost_asset_analysis: digitalTwinData.ghostAssetCount > 0 ? 'Compliance violations detected' : 'No violations',
          hoarding_analysis: digitalTwinData.hoardingAssetCount > 0 ? 'Stagnation patterns detected' : 'Normal patterns',
          infrastructure_health: `${digitalTwinData.onlineGateways}/${digitalTwinData.totalGateways} gateways online`
        },
        strategic_recommendations: [
          digitalTwinData.ghostAssetCount > 0 ? 'Immediate inspection of ghost asset locations required' : 'Maintain current compliance procedures',
          'Continue monitoring asset visibility metrics',
          'Review hoarding patterns for borrowed assets',
          'Ensure gateway infrastructure remains operational'
        ],
        risk_level: digitalTwinData.ghostAssetCount > 0 ? 'HIGH' : 'LOW',
        risk_factors: digitalTwinData.ghostAssetCount > 0 ? ['Ghost assets detected'] : []
      };
    }

    const comprehensiveReport = {
      generated_at: new Date().toISOString(),
      period: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      transactional_data: transactionalData,
      digital_twin_data: digitalTwinData,
      ai_insights: aiInsights,
    };

    console.log('Comprehensive report generated successfully');

    return new Response(JSON.stringify(comprehensiveReport), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Report generation error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

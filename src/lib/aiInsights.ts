/**
 * AI-powered insights generator for asset management reports
 * Uses Supabase Edge Function to generate narrative insights securely
 */
import { supabase } from '@/integrations/supabase/client';

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
  period: { from: Date; to: Date };
}

export async function generateAIInsights(data: ReportData): Promise<{
  executive_summary: string;
  key_findings: string[];
  recommendations: string[];
  trends: string;
}> {
  try {
    const { data: result, error } = await supabase.functions.invoke('generate-ai-insights', {
      body: data
    });

    if (error) {
      console.error('Error invoking generate-ai-insights edge function:', error);
      throw error;
    }
    
    // Check if the edge function returned the fallback template
    if (result && result.executive_summary) {
      return result;
    }

    return generateTemplateInsights(data);
  } catch (error) {
    console.error('AI insights generation failed:', error);
    return generateTemplateInsights(data);
  }
}

function generateTemplateInsights(data: ReportData): {
  executive_summary: string;
  key_findings: string[];
  recommendations: string[];
  trends: string;
} {
  const utilizationLevel = data.utilizationRate > 70 ? 'high' : data.utilizationRate > 40 ? 'moderate' : 'low';
  const assetHealth = ((data.activeAssets / data.totalAssets) * 100).toFixed(1);
  const approvalRate = ((data.approvedRequests / Math.max(data.totalRequests, 1)) * 100).toFixed(1);
  const maintenanceCompletion = ((data.completedMaintenance / Math.max(data.totalMaintenance, 1)) * 100).toFixed(1);

  return {
    executive_summary: `During the reporting period, the asset management system maintained ${data.totalAssets} assets with a ${utilizationLevel} utilization rate of ${data.utilizationRate}%. The total asset value stands at $${data.totalValue.toLocaleString()}, with ${assetHealth}% of assets in active condition. Maintenance operations cost $${data.maintenanceCost.toLocaleString()} with a ${maintenanceCompletion}% completion rate.`,
    
    key_findings: [
      `Asset Health: ${data.activeAssets} out of ${data.totalAssets} assets (${assetHealth}%) are currently active and operational`,
      `Utilization: ${data.borrowedAssets} assets are currently borrowed, representing a ${utilizationLevel} demand level`,
      `Request Approval Rate: ${approvalRate}% of borrow requests were approved (${data.approvedRequests}/${data.totalRequests})`,
      `Maintenance: ${data.completedMaintenance} out of ${data.totalMaintenance} maintenance tasks completed (${maintenanceCompletion}%)`,
    ].filter(Boolean),
    
    recommendations: [
      data.damagedAssets > 0 ? `Priority Action: Address ${data.damagedAssets} damaged assets to improve overall asset health` : 'Maintain current asset condition through regular inspections',
      data.lostAssets > 0 ? `Investigate ${data.lostAssets} lost assets and implement stricter tracking procedures` : 'Continue current asset tracking protocols',
      data.utilizationRate < 50 ? 'Consider redistributing underutilized assets or adjusting inventory levels' : 'Monitor high utilization to prevent asset shortage',
      data.maintenanceCost > data.totalValue * 0.1 ? 'Review maintenance costs as they exceed 10% of total asset value' : 'Optimize maintenance scheduling to reduce costs further',
    ].filter(Boolean),
    
    trends: `The asset portfolio shows ${utilizationLevel} demand with ${data.borrowedAssets} active borrows. Maintenance operations are ${maintenanceCompletion}% complete, indicating ${Number(maintenanceCompletion) > 80 ? 'efficient' : 'room for improvement in'} maintenance management. The ${approvalRate}% approval rate suggests ${Number(approvalRate) > 70 ? 'healthy' : 'restrictive'} asset access policies.`,
  };
}

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  MapPin, 
  Clock, 
  Loader2,
  Shield,
  TrendingUp,
  AlertCircle,
  Wifi,
  WifiOff,
  Ghost,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from '@/hooks/use-toast';

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

interface ComprehensiveReport {
  generated_at: string;
  period: {
    from: string;
    to: string;
  };
  transactional_data: {
    totalAssets: number;
    activeAssets: number;
    borrowedAssets: number;
    damagedAssets: number;
    lostAssets: number;
    idleAssets: number;
    maintenanceAssets: number;
    totalValue: number;
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    pendingRequests: number;
    returnedRequests: number;
    totalMaintenance: number;
    completedMaintenance: number;
    scheduledMaintenance: number;
    inProgressMaintenance: number;
    maintenanceCost: number;
  };
  digital_twin_data: {
    ghostAssets: GhostAsset[];
    ghostAssetCount: number;
    visibilityScore: number;
    hoardingAssets: HoardingAsset[];
    hoardingAssetCount: number;
    bleTaggedAssetCount: number;
    detectedAssetCount: number;
    onlineGateways: number;
    totalGateways: number;
    adminGatewayActive: boolean;
  };
  ai_insights: {
    executive_summary: string;
    financial_ops: {
      portfolio_value: string;
      utilization_rate: string;
      maintenance_efficiency: string;
      borrow_performance: string;
    };
    spatial_intelligence: {
      visibility_assessment: string;
      ghost_asset_analysis: string;
      hoarding_analysis: string;
      infrastructure_health: string;
    };
    strategic_recommendations: string[];
    risk_level: string;
    risk_factors: string[];
  };
}

interface AIReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ComprehensiveReport | null;
  loading: boolean;
}

export function AIReportDialog({ open, onOpenChange, report, loading }: AIReportDialogProps) {
  
  const getRiskColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-600 text-white';
      case 'HIGH': return 'bg-red-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-black';
      case 'LOW': return 'bg-green-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const downloadPDF = () => {
    if (!report) return;
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      // Cover Page with modern design
      doc.setFillColor(15, 23, 42); // Dark slate
      doc.rect(0, 0, pageWidth, 70, 'F');
      
      // Accent stripe
      doc.setFillColor(59, 130, 246); // Blue accent
      doc.rect(0, 65, pageWidth, 5, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('ASETRACE', pageWidth / 2, 30, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Comprehensive Intelligence Report', pageWidth / 2, 42, { align: 'center' });
      doc.setFontSize(10);
      doc.text('Digital Twin Asset Tracking System', pageWidth / 2, 52, { align: 'center' });

      // Report info
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      yPos = 85;
      doc.text(`Report Period: ${format(new Date(report.period.from), 'dd MMM yyyy')} - ${format(new Date(report.period.to), 'dd MMM yyyy')}`, 14, yPos);
      doc.text(`Generated: ${format(new Date(report.generated_at), 'dd MMM yyyy HH:mm')}`, 14, yPos + 6);
      
      // Risk Level Badge
      const riskLevel = report.ai_insights.risk_level || 'UNKNOWN';
      const riskColors: Record<string, [number, number, number]> = {
        'CRITICAL': [220, 38, 38],
        'HIGH': [239, 68, 68],
        'MEDIUM': [234, 179, 8],
        'LOW': [34, 197, 94],
      };
      const riskColor = riskColors[riskLevel] || [156, 163, 175];
      doc.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
      doc.roundedRect(pageWidth - 60, yPos - 5, 45, 15, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(`RISK: ${riskLevel}`, pageWidth - 37.5, yPos + 4, { align: 'center' });

      yPos = 105;

      // Section 1: Executive Summary
      doc.setFillColor(240, 245, 255);
      doc.roundedRect(10, yPos, pageWidth - 20, 45, 3, 3, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('EXECUTIVE SUMMARY', 15, yPos + 10);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const summaryLines = doc.splitTextToSize(report.ai_insights.executive_summary, pageWidth - 35);
      doc.text(summaryLines, 15, yPos + 20);

      yPos += 55;

      // Section 2: Financial & Operations
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('FINANCIAL & OPERATIONS', 14, yPos);
      yPos += 5;

      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value', 'Analysis']],
        body: [
          ['Portfolio Value', `Rp ${report.transactional_data.totalValue.toLocaleString('id-ID')}`, report.ai_insights.financial_ops.portfolio_value || '-'],
          ['Utilization', `${report.transactional_data.borrowedAssets}/${report.transactional_data.totalAssets} assets`, report.ai_insights.financial_ops.utilization_rate || '-'],
          ['Maintenance', `${report.transactional_data.completedMaintenance}/${report.transactional_data.totalMaintenance} tasks`, report.ai_insights.financial_ops.maintenance_efficiency || '-'],
          ['Borrow Operations', `${report.transactional_data.approvedRequests}/${report.transactional_data.totalRequests} approved`, report.ai_insights.financial_ops.borrow_performance || '-'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 45 }, 2: { cellWidth: 'auto' } }
      });

      // New page for Spatial Intelligence
      doc.addPage();
      yPos = 20;

      // Section 3: Spatial Intelligence (Digital Twin)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('SPATIAL INTELLIGENCE (DIGITAL TWIN)', 14, yPos);
      yPos += 10;

      // Visibility & Infrastructure
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(10, yPos, (pageWidth - 25) / 2, 30, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 163, 74);
      doc.text('Visibility Score', 15, yPos + 8);
      doc.setFontSize(20);
      doc.text(`${report.digital_twin_data.visibilityScore}%`, 15, yPos + 22);

      doc.setFillColor(240, 249, 255);
      doc.roundedRect(10 + (pageWidth - 25) / 2 + 5, yPos, (pageWidth - 25) / 2, 30, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('Gateway Status', 10 + (pageWidth - 25) / 2 + 10, yPos + 8);
      doc.setFontSize(20);
      doc.text(`${report.digital_twin_data.onlineGateways}/${report.digital_twin_data.totalGateways}`, 10 + (pageWidth - 25) / 2 + 10, yPos + 22);

      yPos += 40;

      // Ghost Assets Section
      if (report.digital_twin_data.ghostAssetCount > 0) {
        doc.setFillColor(254, 242, 242);
        doc.roundedRect(10, yPos, pageWidth - 20, 10 + (report.digital_twin_data.ghostAssets.length * 6), 2, 2, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
        doc.text(`[!] GHOST ASSETS DETECTED: ${report.digital_twin_data.ghostAssetCount}`, 15, yPos + 7);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        report.digital_twin_data.ghostAssets.forEach((ghost, idx) => {
          doc.text(`- ${ghost.name}: Detected at ${ghost.detected_location} (should be in Admin Room)`, 18, yPos + 14 + (idx * 6));
        });
        yPos += 15 + (report.digital_twin_data.ghostAssets.length * 6);
      } else {
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(10, yPos, pageWidth - 20, 15, 2, 2, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text('[OK] No Ghost Assets - All available assets properly accounted for', 15, yPos + 10);
        yPos += 20;
      }

      // Hoarding Analysis
      if (report.digital_twin_data.hoardingAssetCount > 0) {
        yPos += 5;
        doc.setFillColor(254, 249, 195);
        doc.roundedRect(10, yPos, pageWidth - 20, 10 + (report.digital_twin_data.hoardingAssets.length * 6), 2, 2, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(161, 98, 7);
        doc.text(`[!] HOARDING DETECTED: ${report.digital_twin_data.hoardingAssetCount} stagnant assets`, 15, yPos + 7);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        report.digital_twin_data.hoardingAssets.slice(0, 5).forEach((asset, idx) => {
          doc.text(`- ${asset.name}: ${asset.room} (${asset.stagnant_hours}h stagnant, borrower: ${asset.borrower})`, 18, yPos + 14 + (idx * 6));
        });
        yPos += 15 + (Math.min(report.digital_twin_data.hoardingAssets.length, 5) * 6);
      }

      yPos += 10;

      // Section 4: Strategic Recommendations
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('STRATEGIC RECOMMENDATIONS', 14, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      report.ai_insights.strategic_recommendations.forEach((rec, idx) => {
        const bullet = `${idx + 1}.`;
        const lines = doc.splitTextToSize(rec, pageWidth - 40);
        doc.setFont('helvetica', 'bold');
        doc.text(bullet, 14, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(lines, 22, yPos);
        yPos += lines.length * 5 + 3;
      });

      // Footer on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Asetrace Intelligence Report | Page ${i} of ${pageCount} | Confidential`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      }

      doc.save(`Asetrace_Intelligence_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);

      toast({
        title: 'PDF Downloaded',
        description: 'Comprehensive intelligence report saved successfully',
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to generate PDF report',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">Asetrace Intelligence Report</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Comprehensive Digital Twin & Administrative Analysis
              </p>
            </div>
            {report && (
              <Badge className={getRiskColor(report.ai_insights.risk_level)}>
                Risk: {report.ai_insights.risk_level}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 pt-4 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Generating Intelligence Report...</p>
                <p className="text-sm text-muted-foreground mt-1">Analyzing transactional & spatial data</p>
              </div>
            ) : report ? (
              <>
                {/* Period Info */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Period: {format(new Date(report.period.from), 'dd MMM yyyy')} - {format(new Date(report.period.to), 'dd MMM yyyy')}
                  </span>
                  <span>Generated: {format(new Date(report.generated_at), 'dd MMM yyyy HH:mm')}</span>
                </div>

                {/* Section 1: Executive Summary */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="w-5 h-5 text-primary" />
                      Executive Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{report.ai_insights.executive_summary}</p>
                    
                    {report.ai_insights.risk_factors && report.ai_insights.risk_factors.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {report.ai_insights.risk_factors.map((factor, idx) => (
                          <Badge key={idx} variant="outline" className="border-destructive/50 text-destructive">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Section 2: Financial & Operations */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      Financial & Operations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">Rp {(report.transactional_data.totalValue / 1000000).toFixed(1)}M</p>
                        <p className="text-xs text-muted-foreground">Portfolio Value</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{report.transactional_data.totalAssets}</p>
                        <p className="text-xs text-muted-foreground">Total Assets</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{report.transactional_data.approvedRequests}/{report.transactional_data.totalRequests}</p>
                        <p className="text-xs text-muted-foreground">Borrow Approval</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">Rp {(report.transactional_data.maintenanceCost / 1000).toFixed(0)}K</p>
                        <p className="text-xs text-muted-foreground">Maintenance Cost</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p><strong>Utilization:</strong> {report.ai_insights.financial_ops.utilization_rate}</p>
                      <p><strong>Maintenance:</strong> {report.ai_insights.financial_ops.maintenance_efficiency}</p>
                      <p><strong>Borrow Performance:</strong> {report.ai_insights.financial_ops.borrow_performance}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 3: Spatial Intelligence */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MapPin className="w-5 h-5 text-emerald-500" />
                      Spatial Intelligence (Digital Twin)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <Eye className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{report.digital_twin_data.visibilityScore}%</p>
                        <p className="text-xs text-muted-foreground">Visibility Score</p>
                      </div>
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        {report.digital_twin_data.adminGatewayActive ? (
                          <Wifi className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                        ) : (
                          <WifiOff className="w-6 h-6 mx-auto mb-1 text-red-600" />
                        )}
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{report.digital_twin_data.onlineGateways}/{report.digital_twin_data.totalGateways}</p>
                        <p className="text-xs text-muted-foreground">Gateways Online</p>
                      </div>
                      <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                        <Package className="w-6 h-6 mx-auto mb-1 text-purple-600" />
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{report.digital_twin_data.detectedAssetCount}/{report.digital_twin_data.bleTaggedAssetCount}</p>
                        <p className="text-xs text-muted-foreground">Assets Tracked</p>
                      </div>
                    </div>

                    {/* Ghost Assets Alert */}
                    {report.digital_twin_data.ghostAssetCount > 0 ? (
                      <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Ghost className="w-5 h-5 text-red-600" />
                          <h4 className="font-semibold text-red-700 dark:text-red-400">
                            Ghost Assets Detected: {report.digital_twin_data.ghostAssetCount}
                          </h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Assets marked as 'Available' but detected outside Admin Room - potential compliance violation
                        </p>
                        <div className="space-y-2">
                          {report.digital_twin_data.ghostAssets.map((ghost) => (
                            <div key={ghost.id} className="flex items-center justify-between p-2 bg-white/50 dark:bg-black/20 rounded text-sm">
                              <span className="font-medium">{ghost.name}</span>
                              <span className="text-muted-foreground">
                                Detected at {ghost.detected_location} by {ghost.detected_by}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <span className="font-medium text-green-700 dark:text-green-400">
                            No Ghost Assets - All available assets properly accounted for
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Hoarding Analysis */}
                    {report.digital_twin_data.hoardingAssetCount > 0 && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-5 h-5 text-yellow-600" />
                          <h4 className="font-semibold text-yellow-700 dark:text-yellow-400">
                            Hoarding Pattern Detected: {report.digital_twin_data.hoardingAssetCount} assets
                          </h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Borrowed assets showing no movement for 48+ hours
                        </p>
                        <div className="space-y-2">
                          {report.digital_twin_data.hoardingAssets.slice(0, 3).map((asset) => (
                            <div key={asset.id} className="flex items-center justify-between p-2 bg-white/50 dark:bg-black/20 rounded text-sm">
                              <span className="font-medium">{asset.name}</span>
                              <span className="text-muted-foreground">
                                {asset.room} ({asset.stagnant_hours}h stagnant) - {asset.borrower}
                              </span>
                            </div>
                          ))}
                          {report.digital_twin_data.hoardingAssets.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{report.digital_twin_data.hoardingAssets.length - 3} more assets...
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-sm space-y-1">
                      <p><strong>Visibility Assessment:</strong> {report.ai_insights.spatial_intelligence.visibility_assessment}</p>
                      <p><strong>Infrastructure Health:</strong> {report.ai_insights.spatial_intelligence.infrastructure_health}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 4: Strategic Recommendations */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      Strategic Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {report.ai_insights.strategic_recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                            {idx + 1}
                          </span>
                          <p className="text-sm">{rec}</p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        {report && !loading && (
          <div className="border-t p-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={downloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

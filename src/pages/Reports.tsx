import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Download, 
  FileSpreadsheet, 
  Printer,
  Calendar as CalendarIcon,
  TrendingUp,
  Package,
  Wrench,
  Users,
  Activity,
  Filter,
  Loader2,
  BarChart3,
  TrendingDown,
  ArrowLeft,
  Sparkles,
  Brain
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAssets } from '@/hooks/useAssets';
import { useBorrowRequests } from '@/hooks/useBorrowRequests';
import { useMaintenanceHistory } from '@/hooks/useMaintenanceHistory';
import { useAssetUsage } from '@/hooks/useAssetUsage';
import { useStudents } from '@/hooks/useStudents';
import { useAnalytics } from '@/hooks/useAnalytics';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { generateAIInsights } from '@/lib/aiInsights';
import { AIReportDialog } from '@/components/reports/AIReportDialog';
import { supabase } from '@/integrations/supabase/client';

export default function Reports() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [reportType, setReportType] = useState<'summary' | 'detailed'>('summary');
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'data' | 'insights'>('data');
  const [assetType, setAssetType] = useState<string>('all');
  const [department, setDepartment] = useState<string>('all');
  const [aiReportOpen, setAiReportOpen] = useState(false);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);

  const { assets, loading: assetsLoading } = useAssets();
  const { requests, isLoading: requestsLoading } = useBorrowRequests();
  const { records: maintenance, loading: maintenanceLoading } = useMaintenanceHistory();
  const { logs: usageLogs, loading: usageLoading } = useAssetUsage();
  const { students, isLoading: studentsLoading } = useStudents();

  const loading = assetsLoading || requestsLoading || maintenanceLoading || usageLoading || studentsLoading;

  // Analytics data
  const {
    statusDistribution,
    usageTrends,
    maintenanceCosts,
    summaryMetrics,
    departmentUtilization,
  } = useAnalytics(dateRange.from, dateRange.to);

  // Filter data by date range
  const filteredData = useMemo(() => {
    const fromTime = dateRange.from.getTime();
    const toTime = dateRange.to.getTime();

    return {
      assets: assets,
      requests: requests.filter(r => {
        const date = new Date(r.created_at).getTime();
        return date >= fromTime && date <= toTime;
      }),
      maintenance: maintenance.filter(m => {
        const date = new Date(m.created_at).getTime();
        return date >= fromTime && date <= toTime;
      }),
      usage: usageLogs.filter(u => {
        const date = new Date(u.started_at).getTime();
        return date >= fromTime && date <= toTime;
      }),
      students: students
    };
  }, [assets, requests, maintenance, usageLogs, students, dateRange]);

  // Calculate statistics
  const statistics = useMemo(() => {
    return {
      totalAssets: filteredData.assets.length,
      activeAssets: filteredData.assets.filter(a => a.status === 'active').length,
      borrowedAssets: filteredData.assets.filter(a => a.status === 'borrowed').length,
      damagedAssets: filteredData.assets.filter(a => a.status === 'damaged').length,
      lostAssets: filteredData.assets.filter(a => a.status === 'lost').length,
      totalValue: filteredData.assets.reduce((sum, a) => sum + (a.value || 0), 0),
      
      totalRequests: filteredData.requests.length,
      approvedRequests: filteredData.requests.filter(r => r.status === 'Approved').length,
      rejectedRequests: filteredData.requests.filter(r => r.status === 'Rejected').length,
      pendingRequests: filteredData.requests.filter(r => r.status === 'Pending').length,
      returnedRequests: filteredData.requests.filter(r => r.status === 'Returned').length,
      
      totalMaintenance: filteredData.maintenance.length,
      scheduledMaintenance: filteredData.maintenance.filter(m => m.status === 'scheduled').length,
      completedMaintenance: filteredData.maintenance.filter(m => m.status === 'completed').length,
      inProgressMaintenance: filteredData.maintenance.filter(m => m.status === 'in_progress').length,
      maintenanceCost: filteredData.maintenance.reduce((sum, m) => sum + (m.cost || 0), 0),
      
      totalUsage: filteredData.usage.length,
      totalUsageHours: filteredData.usage.reduce((sum, u) => sum + (u.duration_hours || 0), 0),
      activeUsers: filteredData.students.length,
      
      categoryCounts: filteredData.assets.reduce((acc, asset) => {
        acc[asset.category] = (acc[asset.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }, [filteredData]);

  const setQuickDateRange = (range: string) => {
    const now = new Date();
    switch (range) {
      case 'today':
        setDateRange({ from: now, to: now });
        break;
      case 'thisWeek':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        setDateRange({ from: startOfWeek, to: now });
        break;
      case 'thisMonth':
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        break;
      case 'thisYear':
        setDateRange({ from: startOfYear(now), to: endOfYear(now) });
        break;
    }
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = [
        ['ASSET MANAGEMENT SYSTEM - SUMMARY REPORT'],
        ['Report Period:', `${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`],
        ['Generated:', format(new Date(), 'dd MMM yyyy HH:mm')],
        [],
        ['ASSET STATISTICS'],
        ['Total Assets', statistics.totalAssets],
        ['Active Assets', statistics.activeAssets],
        ['Borrowed Assets', statistics.borrowedAssets],
        ['Damaged Assets', statistics.damagedAssets],
        ['Lost Assets', statistics.lostAssets],
        ['Total Asset Value', `Rp ${statistics.totalValue.toLocaleString('id-ID')}`],
        [],
        ['BORROW REQUEST STATISTICS'],
        ['Total Requests', statistics.totalRequests],
        ['Approved', statistics.approvedRequests],
        ['Rejected', statistics.rejectedRequests],
        ['Pending', statistics.pendingRequests],
        ['Returned', statistics.returnedRequests],
        [],
        ['MAINTENANCE STATISTICS'],
        ['Total Maintenance', statistics.totalMaintenance],
        ['Scheduled', statistics.scheduledMaintenance],
        ['In Progress', statistics.inProgressMaintenance],
        ['Completed', statistics.completedMaintenance],
        ['Total Cost', `Rp ${statistics.maintenanceCost.toLocaleString('id-ID')}`],
        [],
        ['USAGE STATISTICS'],
        ['Total Usage Records', statistics.totalUsage],
        ['Total Usage Hours', statistics.totalUsageHours.toFixed(2)],
        ['Active Users', statistics.activeUsers]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Assets Sheet
      const assetsData = filteredData.assets.map(a => ({
        'Asset ID': a.id,
        'Name': a.name,
        'Category': a.category,
        'Type': a.type,
        'Status': a.status,
        'Condition': a.condition,
        'Value (Rp)': a.value || 0,
        'Location': `${a.room} - ${a.floor}`,
        'Last User': a.last_user || '-',
        'Last Maintenance': a.last_maintenance ? format(new Date(a.last_maintenance), 'dd MMM yyyy') : '-'
      }));
      const wsAssets = XLSX.utils.json_to_sheet(assetsData);
      XLSX.utils.book_append_sheet(wb, wsAssets, 'Assets');

      // Borrow Requests Sheet
      const requestsData = filteredData.requests.map(r => ({
        'Request ID': r.id,
        'Asset': r.assets?.name || '-',
        'Student': r.students?.full_name || '-',
        'NIM': r.students?.nim || '-',
        'Borrow Date': format(new Date(r.tanggal_pinjam), 'dd MMM yyyy'),
        'Return Date': format(new Date(r.tanggal_kembali), 'dd MMM yyyy'),
        'Status': r.status,
        'Reason': r.alasan,
        'Created': format(new Date(r.created_at), 'dd MMM yyyy HH:mm')
      }));
      const wsRequests = XLSX.utils.json_to_sheet(requestsData);
      XLSX.utils.book_append_sheet(wb, wsRequests, 'Borrow Requests');

      // Maintenance Sheet
      const maintenanceData = filteredData.maintenance.map(m => ({
        'Maintenance ID': m.id,
        'Asset ID': m.asset_id,
        'Type': m.maintenance_type,
        'Description': m.description || '-',
        'Technician': m.technician_name,
        'Status': m.status,
        'Scheduled Date': m.scheduled_date ? format(new Date(m.scheduled_date), 'dd MMM yyyy') : '-',
        'Completed Date': m.completed_date ? format(new Date(m.completed_date), 'dd MMM yyyy') : '-',
        'Cost (Rp)': m.cost || 0,
        'Notes': m.notes || '-'
      }));
      const wsMaintenance = XLSX.utils.json_to_sheet(maintenanceData);
      XLSX.utils.book_append_sheet(wb, wsMaintenance, 'Maintenance');

      // Usage Logs Sheet
      const usageData = filteredData.usage.map(u => ({
        'Log ID': u.id,
        'Asset ID': u.asset_id,
        'User': u.user_name || '-',
        'Started At': format(new Date(u.started_at), 'dd MMM yyyy HH:mm'),
        'Ended At': u.ended_at ? format(new Date(u.ended_at), 'dd MMM yyyy HH:mm') : 'Ongoing',
        'Duration (hours)': u.duration_hours?.toFixed(2) || '-',
        'Location': u.location || '-',
        'Notes': u.notes || '-'
      }));
      const wsUsage = XLSX.utils.json_to_sheet(usageData);
      XLSX.utils.book_append_sheet(wb, wsUsage, 'Usage Logs');

      // Save file
      XLSX.writeFile(wb, `Asset_Report_${format(dateRange.from, 'yyyyMMdd')}_${format(dateRange.to, 'yyyyMMdd')}.xlsx`);

      toast({
        title: 'Export Successful',
        description: 'Report exported to Excel successfully'
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export report to Excel',
        variant: 'destructive'
      });
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setExporting(true);

      // Generate AI insights
      const insights = await generateAIInsights({
        totalAssets: statistics.totalAssets,
        activeAssets: statistics.activeAssets,
        borrowedAssets: statistics.borrowedAssets,
        damagedAssets: statistics.damagedAssets,
        lostAssets: statistics.lostAssets,
        totalValue: statistics.totalValue,
        utilizationRate: Number(summaryMetrics.utilizationRate),
        maintenanceCost: statistics.maintenanceCost,
        totalRequests: statistics.totalRequests,
        approvedRequests: statistics.approvedRequests,
        rejectedRequests: statistics.rejectedRequests,
        totalMaintenance: statistics.totalMaintenance,
        completedMaintenance: statistics.completedMaintenance,
        period: dateRange,
      });

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;
      
      // Cover Page
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, pageWidth, 60, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('ASSET MANAGEMENT', pageWidth / 2, 30, { align: 'center' });
      doc.setFontSize(18);
      doc.text('Comprehensive Report', pageWidth / 2, 42, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      yPos = 75;
      doc.text(`Report Period: ${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`, pageWidth / 2, yPos, { align: 'center' });
      doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, pageWidth / 2, yPos + 7, { align: 'center' });

      // AI Executive Summary
      yPos = 95;
      doc.setFillColor(240, 240, 255);
      doc.rect(10, yPos, pageWidth - 20, 70, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('Executive Summary', 15, yPos + 10);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const summaryLines = doc.splitTextToSize(insights.executive_summary, pageWidth - 30);
      doc.text(summaryLines, 15, yPos + 20);

      yPos += 80;

      // Key Metrics Overview
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Key Performance Indicators', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value', 'Status']],
        body: [
          ['Total Assets', statistics.totalAssets.toString(), 'Good'],
          ['Asset Value', `$${statistics.totalValue.toLocaleString()}`, '-'],
          ['Utilization Rate', `${summaryMetrics.utilizationRate}%`, Number(summaryMetrics.utilizationRate) > 70 ? 'High' : Number(summaryMetrics.utilizationRate) > 40 ? 'Medium' : 'Low'],
          ['Active Assets', `${statistics.activeAssets} (${((statistics.activeAssets/statistics.totalAssets)*100).toFixed(1)}%)`, 'Active'],
          ['Maintenance Cost', `$${statistics.maintenanceCost.toLocaleString()}`, '-'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 10 },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 60 },
          2: { cellWidth: 30, halign: 'center' }
        }
      });

      // New Page for Insights
      doc.addPage();
      yPos = 20;

      // Key Findings
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('Key Findings', 14, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      insights.key_findings.forEach((finding, idx) => {
        const lines = doc.splitTextToSize(`${idx + 1}. ${finding}`, pageWidth - 30);
        doc.text(lines, 14, yPos);
        yPos += lines.length * 6 + 3;
      });

      yPos += 5;

      // Recommendations
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('Recommendations', 14, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      insights.recommendations.forEach((rec, idx) => {
        const lines = doc.splitTextToSize(`${idx + 1}. ${rec}`, pageWidth - 30);
        doc.text(lines, 14, yPos);
        yPos += lines.length * 6 + 3;
      });

      yPos += 5;

      // Trend Analysis
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('Trend Analysis', 14, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const trendLines = doc.splitTextToSize(insights.trends, pageWidth - 30);
      doc.text(trendLines, 14, yPos);

      // New Page for Visual Analytics
      doc.addPage();
      yPos = 20;

      // Draw Pie Chart for Asset Status Distribution
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Asset Status Distribution', 14, yPos);
      yPos += 10;

      const centerX = 60;
      const centerY = yPos + 40;
      const radius = 35;
      
      const statusData = [
        { label: 'Active', value: statistics.activeAssets, color: [34, 197, 94] },
        { label: 'Borrowed', value: statistics.borrowedAssets, color: [59, 130, 246] },
        { label: 'Damaged', value: statistics.damagedAssets, color: [239, 68, 68] },
        { label: 'Lost', value: statistics.lostAssets, color: [156, 163, 175] },
      ];

      const total = statusData.reduce((sum, d) => sum + d.value, 0);
      let startAngle = 0;

      statusData.forEach((item) => {
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        // Draw pie slice
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        
        // Create pie slice path
        const steps = 50;
        doc.moveTo(centerX, centerY);
        for (let i = 0; i <= steps; i++) {
          const angle = startAngle + (sliceAngle * i) / steps;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          if (i === 0) {
            doc.moveTo(x, y);
          } else {
            doc.lineTo(x, y);
          }
        }
        doc.lineTo(centerX, centerY);
        doc.fill();

        startAngle = endAngle;
      });

      // Draw legend
      let legendY = yPos + 10;
      const legendX = 110;
      statusData.forEach((item, idx) => {
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.rect(legendX, legendY, 5, 5, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(`${item.label}: ${item.value} (${((item.value/total)*100).toFixed(1)}%)`, legendX + 8, legendY + 4);
        legendY += 8;
      });

      yPos += 90;

      // Draw Bar Chart for Borrow Requests by Status
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Borrow Request Statistics', 14, yPos);
      yPos += 10;

      const barData = [
        { label: 'Pending', value: statistics.pendingRequests, color: [251, 191, 36] },
        { label: 'Approved', value: statistics.approvedRequests, color: [34, 197, 94] },
        { label: 'Rejected', value: statistics.rejectedRequests, color: [239, 68, 68] },
        { label: 'Returned', value: statistics.returnedRequests, color: [59, 130, 246] },
      ];

      const maxValue = Math.max(...barData.map(d => d.value));
      const chartWidth = 160;
      const chartHeight = 60;
      const barWidth = 30;
      const spacing = 10;
      const chartX = 20;
      const chartY = yPos;

      // Draw axes
      doc.setDrawColor(0, 0, 0);
      doc.line(chartX, chartY, chartX, chartY + chartHeight); // Y-axis
      doc.line(chartX, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight); // X-axis

      // Draw bars
      barData.forEach((item, idx) => {
        const barHeight = maxValue > 0 ? (item.value / maxValue) * chartHeight : 0;
        const x = chartX + spacing + idx * (barWidth + spacing);
        const y = chartY + chartHeight - barHeight;

        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.rect(x, y, barWidth, barHeight, 'F');

        // Label
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(item.label, x + barWidth / 2, chartY + chartHeight + 5, { align: 'center' });
        
        // Value
        if (item.value > 0) {
          doc.text(item.value.toString(), x + barWidth / 2, y - 2, { align: 'center' });
        }
      });

      yPos += chartHeight + 20;

      // New Page for Detailed Statistics
      doc.addPage();
      yPos = 20;

      // Asset Statistics
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ASSET STATISTICS', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: [
          ['Total Assets', statistics.totalAssets],
          ['Active Assets', statistics.activeAssets],
          ['Borrowed Assets', statistics.borrowedAssets],
          ['Damaged Assets', statistics.damagedAssets],
          ['Lost Assets', statistics.lostAssets],
          ['Total Value', `$${statistics.totalValue.toLocaleString()}`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Borrow Statistics
      doc.setFont('helvetica', 'bold');
      doc.text('BORROW REQUEST STATISTICS', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: [
          ['Total Requests', statistics.totalRequests],
          ['Approved', statistics.approvedRequests],
          ['Rejected', statistics.rejectedRequests],
          ['Pending', statistics.pendingRequests],
          ['Returned', statistics.returnedRequests]
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Maintenance Statistics
      doc.setFont('helvetica', 'bold');
      doc.text('MAINTENANCE STATISTICS', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: [
          ['Total Maintenance', statistics.totalMaintenance],
          ['Scheduled', statistics.scheduledMaintenance],
          ['In Progress', statistics.inProgressMaintenance],
          ['Completed', statistics.completedMaintenance],
          ['Total Cost', `$${statistics.maintenanceCost.toLocaleString()}`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });

      // Footer on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Asset Management System | Page ${i} of ${pageCount} | Confidential`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // Save PDF
      doc.save(`Asset_Report_AI_${format(dateRange.from, 'yyyyMMdd')}_${format(dateRange.to, 'yyyyMMdd')}.pdf`);

      toast({
        title: 'Export Successful',
        description: 'AI-powered report exported to PDF successfully',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export report to PDF',
        variant: 'destructive'
      });
    } finally {
      setExporting(false);
    }
  };

  const printReport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dashboard-bg to-muted/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 print:hidden">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate(-1)}
                className="hover:bg-muted/50"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
                <p className="text-sm text-muted-foreground">Comprehensive asset management insights and reports</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={printReport} disabled={exporting}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Excel
              </Button>
              <Button variant="default" size="sm" onClick={exportToPDF} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                PDF Report
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={async () => {
                  setAiReportOpen(true);
                  setAiReportLoading(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('generate-ai-report', {
                      body: { dateRange: { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() } }
                    });
                    if (error) throw error;
                    setAiReport(data);
                  } catch (err) {
                    console.error('AI Report error:', err);
                    toast({ title: 'Failed to generate report', variant: 'destructive' });
                  } finally {
                    setAiReportLoading(false);
                  }
                }} 
                disabled={aiReportLoading}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {aiReportLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Brain className="w-4 h-4 mr-2" />
                )}
                AI Intelligence
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {/* Global Filters */}
        <Card className="p-6 print:hidden">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.to, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Quick Select</label>
              <Select onValueChange={setQuickDateRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="thisWeek">This Week</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Asset Type</label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="computing">Computing</SelectItem>
                  <SelectItem value="furniture">Furniture</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="vehicles">Vehicles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Department</label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="it">IT</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Print Header */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-2xl font-bold">ASSET MANAGEMENT SYSTEM</h1>
          <h2 className="text-xl mt-2">Reports & Analytics</h2>
          <p className="text-sm mt-2">
            Period: {format(dateRange.from, 'dd MMM yyyy')} - {format(dateRange.to, 'dd MMM yyyy')}
          </p>
          <p className="text-sm">Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="data" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="data" className="text-base">
              <FileText className="w-4 h-4 mr-2" />
              Data View
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-base">
              <BarChart3 className="w-4 h-4 mr-2" />
              Insights View
            </TabsTrigger>
          </TabsList>

          {/* Data View Tab */}
          <TabsContent value="data" className="space-y-6">
            {/* Statistics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Assets</p>
                    <p className="text-2xl font-bold">{statistics.totalAssets}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Rp {statistics.totalValue.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-success/10 rounded-lg">
                    <Activity className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Borrow Requests</p>
                    <p className="text-2xl font-bold">{statistics.totalRequests}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="default" className="text-xs">
                        {statistics.approvedRequests} Approved
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-warning/10 rounded-lg">
                    <Wrench className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Maintenance</p>
                    <p className="text-2xl font-bold">{statistics.totalMaintenance}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Rp {statistics.maintenanceCost.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <Users className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-bold">{statistics.activeUsers}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {statistics.totalUsage} usage records
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Detailed Report Sub-tabs */}
            <Tabs defaultValue="assets" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="assets">Assets</TabsTrigger>
                <TabsTrigger value="requests">Requests</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="usage">Usage</TabsTrigger>
                <TabsTrigger value="students">Students</TabsTrigger>
              </TabsList>

              <TabsContent value="assets" className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Asset Status Breakdown</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-3xl font-bold text-success">{statistics.activeAssets}</p>
                      <p className="text-sm text-muted-foreground mt-1">Active</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-3xl font-bold text-primary">{statistics.borrowedAssets}</p>
                      <p className="text-sm text-muted-foreground mt-1">Borrowed</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-3xl font-bold text-warning">{statistics.damagedAssets}</p>
                      <p className="text-sm text-muted-foreground mt-1">Damaged</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-3xl font-bold text-destructive">{statistics.lostAssets}</p>
                      <p className="text-sm text-muted-foreground mt-1">Lost</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-3xl font-bold">{statistics.totalAssets}</p>
                      <p className="text-sm text-muted-foreground mt-1">Total</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Category Distribution</h3>
                  <div className="space-y-3">
                    {Object.entries(statistics.categoryCounts).map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{category}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${(count / statistics.totalAssets) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-12 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="requests" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="p-4 text-center">
                    <p className="text-3xl font-bold text-warning">{statistics.pendingRequests}</p>
                    <p className="text-sm text-muted-foreground mt-1">Pending</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-3xl font-bold text-success">{statistics.approvedRequests}</p>
                    <p className="text-sm text-muted-foreground mt-1">Approved</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-3xl font-bold text-destructive">{statistics.rejectedRequests}</p>
                    <p className="text-sm text-muted-foreground mt-1">Rejected</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{statistics.returnedRequests}</p>
                    <p className="text-sm text-muted-foreground mt-1">Returned</p>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="maintenance" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4 text-center">
                    <p className="text-3xl font-bold text-warning">{statistics.scheduledMaintenance}</p>
                    <p className="text-sm text-muted-foreground mt-1">Scheduled</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{statistics.inProgressMaintenance}</p>
                    <p className="text-sm text-muted-foreground mt-1">In Progress</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-3xl font-bold text-success">{statistics.completedMaintenance}</p>
                    <p className="text-sm text-muted-foreground mt-1">Completed</p>
                  </Card>
                </div>
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Cost Analysis</h3>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-primary">
                      Rp {statistics.maintenanceCost.toLocaleString('id-ID')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">Total Maintenance Cost</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Average: Rp {statistics.totalMaintenance > 0 
                        ? (statistics.maintenanceCost / statistics.totalMaintenance).toLocaleString('id-ID')
                        : 0} per maintenance
                    </p>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="usage" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-6 text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 text-primary" />
                    <p className="text-4xl font-bold">{statistics.totalUsage}</p>
                    <p className="text-sm text-muted-foreground mt-2">Total Usage Records</p>
                  </Card>
                  <Card className="p-6 text-center">
                    <Activity className="w-12 h-12 mx-auto mb-3 text-success" />
                    <p className="text-4xl font-bold">{statistics.totalUsageHours.toFixed(0)}</p>
                    <p className="text-sm text-muted-foreground mt-2">Total Usage Hours</p>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="students" className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Student Statistics</h3>
                  <div className="text-center">
                    <Users className="w-16 h-16 mx-auto mb-4 text-primary" />
                    <p className="text-5xl font-bold">{statistics.activeUsers}</p>
                    <p className="text-sm text-muted-foreground mt-2">Registered Students</p>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Insights View Tab */}
          <TabsContent value="insights" className="space-y-6">
            {/* Top Summary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Assets</p>
                    <p className="text-2xl font-bold text-foreground">{summaryMetrics.activeAssets.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-success/10 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-success" />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Utilization Rate</p>
                    <p className="text-2xl font-bold text-foreground">{summaryMetrics.utilizationRate}%</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Maintenance Cost</p>
                    <p className="text-2xl font-bold text-foreground">
                      ${(summaryMetrics.maintenanceCost / 1000).toFixed(1)}K
                    </p>
                  </div>
                  <div className="p-3 bg-warning/10 rounded-lg">
                    <TrendingDown className="w-6 h-6 text-warning" />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Asset Value</p>
                    <p className="text-2xl font-bold text-foreground">
                      ${(summaryMetrics.totalValue / 1000000).toFixed(2)}M
                    </p>
                  </div>
                  <div className="p-3 bg-success/10 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-success" />
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-12 gap-6">
              {/* Asset Usage Trends - Line Chart */}
              <div className="col-span-12 lg:col-span-8">
                <Card className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle>Asset Usage Trends Over Time</CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={usageTrends}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" className="fill-muted-foreground" />
                        <YAxis className="fill-muted-foreground" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="active" stroke="hsl(var(--success))" strokeWidth={2} name="Active" />
                        <Line type="monotone" dataKey="idle" stroke="hsl(var(--warning))" strokeWidth={2} name="Idle" />
                        <Line type="monotone" dataKey="maintenance" stroke="hsl(var(--primary))" strokeWidth={2} name="Maintenance" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Asset Status Distribution - Pie Chart */}
              <div className="col-span-12 lg:col-span-4">
                <Card className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle>Asset Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusDistribution.filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(Number(percent) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {statusDistribution.filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Maintenance Costs - Bar Chart */}
              <div className="col-span-12 lg:col-span-8">
                <Card className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle>Monthly Maintenance Costs</CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={maintenanceCosts}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" className="fill-muted-foreground" />
                        <YAxis className="fill-muted-foreground" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                          formatter={(value, name) => [
                            name === 'cost' ? `$${value.toLocaleString()}` : value,
                            name === 'cost' ? 'Cost' : 'Maintenance Count'
                          ]}
                        />
                        <Legend />
                        <Bar dataKey="cost" fill="hsl(var(--primary))" name="Cost ($)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Department Utilization */}
              <div className="col-span-12 lg:col-span-4">
                <Card className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle>Utilization by Department</CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <div className="space-y-4">
                      {departmentUtilization.length > 0 ? departmentUtilization.map((dept) => (
                        <div key={dept.department} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{dept.department}</span>
                            <Badge variant="outline" className="text-xs">
                              {dept.utilization}%
                            </Badge>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${dept.utilization}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-muted-foreground">{dept.assets} assets</p>
                        </div>
                      )) : (
                        <div className="text-center py-8">
                          <p className="text-sm text-muted-foreground">No department data available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AIReportDialog 
        open={aiReportOpen} 
        onOpenChange={setAiReportOpen} 
        report={aiReport} 
        loading={aiReportLoading} 
      />
    </div>
  );
}

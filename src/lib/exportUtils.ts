import * as XLSX from 'xlsx';
import { format } from 'date-fns';

/**
 * Export data to Excel file
 * @param data Array of objects to export
 * @param filename Base filename (without extension)
 * @param sheetName Name of the Excel sheet
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  sheetName: string = 'Sheet1'
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Create workbook and add the worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Generate filename with timestamp
  const timestamp = format(new Date(), 'yyyy-MM-dd');
  const fullFilename = `${filename}_${timestamp}.xlsx`;
  
  // Write file and trigger download
  XLSX.writeFile(workbook, fullFilename);
}

/**
 * Export asset inventory data
 */
export function exportAssetInventory(
  assets: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    room: string;
    floor: string;
    condition: string;
    value: number | null;
    last_user: string | null;
    ble_tag_mac: string | null;
  }>
): void {
  const exportData = assets.map(asset => ({
    'Asset ID': asset.id.slice(0, 8).toUpperCase(),
    'Asset Name': asset.name,
    'Category': asset.category.charAt(0).toUpperCase() + asset.category.slice(1),
    'Status': asset.status.charAt(0).toUpperCase() + asset.status.slice(1),
    'Location': `${asset.room} - ${asset.floor}`,
    'Condition': asset.condition,
    'Value (IDR)': asset.value || 0,
    'Last User': asset.last_user || '-',
    'BLE Tag': asset.ble_tag_mac || 'Not Assigned',
  }));

  exportToExcel(exportData, 'Asetrace_Inventory', 'Assets');
}

/**
 * Export weekly usage data
 */
export function exportWeeklyUsage(
  usageData: Array<{
    day: string;
    usage: number;
    hours: number;
    sessions: number;
  }>,
  borrowData: Array<{
    student: string;
    asset: string;
    borrowDate: string;
    returnDate: string;
    status: string;
  }>
): void {
  // Create workbook with multiple sheets
  const workbook = XLSX.utils.book_new();
  
  // Usage statistics sheet
  const usageSheet = XLSX.utils.json_to_sheet(usageData.map(d => ({
    'Day': d.day,
    'Usage (%)': d.usage,
    'Total Hours': d.hours.toFixed(2),
    'Sessions': d.sessions,
  })));
  XLSX.utils.book_append_sheet(workbook, usageSheet, 'Daily Usage');
  
  // Borrow activities sheet
  if (borrowData.length > 0) {
    const borrowSheet = XLSX.utils.json_to_sheet(borrowData.map(b => ({
      'Student': b.student,
      'Asset': b.asset,
      'Borrow Date': b.borrowDate,
      'Return Date': b.returnDate,
      'Status': b.status,
    })));
    XLSX.utils.book_append_sheet(workbook, borrowSheet, 'Borrow Activities');
  }
  
  // Generate filename and download
  const timestamp = format(new Date(), 'yyyy-MM-dd');
  XLSX.writeFile(workbook, `Asetrace_Weekly_Usage_${timestamp}.xlsx`);
}

/**
 * Export audit log data
 */
export function exportAuditLog(
  logs: Array<{
    created_at: string;
    user_name: string;
    user_role: string;
    action: string;
    details: any;
  }>
): void {
  const exportData = logs.map(log => ({
    'Date & Time': format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
    'User': log.user_name,
    'Role': log.user_role.charAt(0).toUpperCase() + log.user_role.slice(1),
    'Action': log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    'Details': log.details ? JSON.stringify(log.details) : '-',
  }));

  exportToExcel(exportData, 'Asetrace_Audit_Log', 'Audit Log');
}

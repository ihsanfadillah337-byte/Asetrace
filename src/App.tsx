import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Notifications from "./pages/Notifications";
import Reports from "./pages/Reports";
import WeeklyUsage from "./pages/WeeklyUsage";
import MaintenanceStatus from "./pages/MaintenanceStatus";
import AssetInventory from "./pages/AssetInventory";
import AssetDetail from "./pages/AssetDetail";
import UserManagement from "./pages/UserManagement";
import AuditLog from "./pages/AuditLog";
import AdminDashboard from "./pages/AdminDashboard";
import OperatorDashboard from "./pages/OperatorDashboard";
import UserDashboard from "./pages/UserDashboard";
import BorrowRequest from "./pages/BorrowRequest";
import BorrowHistory from "./pages/BorrowHistory";
import BorrowManagement from "./pages/BorrowManagement";
import BLEConfiguration from "./pages/BLEConfiguration";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />
            
            {/* Redirect root to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* Protected routes with role-based dashboards */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/operator" element={<ProtectedRoute allowedRoles={['operator']}><OperatorDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/user" element={<ProtectedRoute allowedRoles={['user']}><UserDashboard /></ProtectedRoute>} />
              
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>} />
              <Route path="/weekly-usage" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><WeeklyUsage /></ProtectedRoute>} />
              <Route path="/maintenance" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><MaintenanceStatus /></ProtectedRoute>} />
              <Route path="/inventory" element={<AssetInventory />} />
              <Route path="/asset/:assetId" element={<AssetDetail />} />
              <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
              <Route path="/audit-log" element={<ProtectedRoute allowedRoles={['admin']}><AuditLog /></ProtectedRoute>} />
              <Route path="/request" element={<ProtectedRoute allowedRoles={['user']}><BorrowRequest /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute allowedRoles={['user']}><BorrowHistory /></ProtectedRoute>} />
              <Route path="/borrow-management" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><BorrowManagement /></ProtectedRoute>} />
              <Route path="/ble-config" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><BLEConfiguration /></ProtectedRoute>} />
            </Route>
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

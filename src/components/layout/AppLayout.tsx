import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { SmartInsightDrawer } from "@/components/dashboard/SmartInsightDrawer";

export function AppLayout() {
  // Global realtime subscription - auto-refreshes all pages when data changes
  useRealtimeSubscription();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background blueprint-grid">
        <AppSidebar />
        <main className="flex-1">
          <header className="border-b border-border/50 glass-panel sticky top-0 z-10 shadow-card">
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="hover:bg-primary/10 transition-smooth" />
                <motion.div
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="p-1.5 bg-primary/10 rounded-lg glow-effect">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Asetrace</h1>
                    <p className="text-sm text-muted-foreground font-medium">Neo Blueprint Management</p>
                  </div>
                </motion.div>
              </div>
              <NotificationBell />
            </div>
          </header>
          <div className="p-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Outlet />
            </motion.div>
          </div>
        </main>
        
        {/* Global Smart Insight Drawer */}
        <SmartInsightDrawer />
      </div>
    </SidebarProvider>
  );
}

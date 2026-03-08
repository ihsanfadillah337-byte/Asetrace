import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  Bell, 
  TrendingUp, 
  Wrench, 
  Package,
  BarChart3,
  LogOut,
  Users,
  FileText,
  Clock,
  Home,
  Bluetooth
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const getMenuItems = (role: 'admin' | 'operator' | 'user' | null) => {
  const dashboardUrl = role 
    ? `/dashboard/${role}` 
    : '/dashboard/user';
  
  const baseItems = [
    { title: "Dashboard", url: dashboardUrl, icon: Home },
    { title: "Inventory", url: "/inventory", icon: Package },
  ];

  const userItems = [
    { title: "Request Asset", url: "/request", icon: Package },
    { title: "Borrow History", url: "/history", icon: Clock },
  ];

  const operatorItems = [
    { title: "Maintenance", url: "/maintenance", icon: Wrench },
    { title: "Weekly Usage", url: "/weekly-usage", icon: BarChart3 },
    { title: "Notifications", url: "/notifications", icon: Bell },
    { title: "Borrow Requests", url: "/borrow-management", icon: FileText },
    { title: "BLE Configuration", url: "/ble-config", icon: Bluetooth },
  ];

  const adminOnlyItems = [
    { title: "Reports & Analytics", url: "/reports", icon: FileText },
  ];

  if (role === 'admin') {
    return [...baseItems, ...operatorItems, ...adminOnlyItems];
  } else if (role === 'operator') {
    return [...baseItems, ...operatorItems];
  } else {
    return [...baseItems, ...userItems];
  }
};

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const { role, hasPermission, signOut } = useAuth();
  const menuItems = getMenuItems(role);

  return (
    <Sidebar collapsible="icon" className="border-r-2 border-border/30 glass-panel">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-foreground font-semibold mb-2">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive }) =>
                          isActive
                            ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary shadow-glow"
                            : "hover:bg-accent/10 hover:text-accent transition-smooth"
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </motion.div>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t-2 border-border/30 pt-4">
        <SidebarMenu>
          {hasPermission(['admin']) && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => navigate("/users")}
                  className="hover:bg-accent/10 hover:text-accent transition-smooth"
                >
                  <Users className="h-4 w-4" />
                  {!collapsed && <span>Users</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => navigate("/audit-log")}
                  className="hover:bg-accent/10 hover:text-accent transition-smooth"
                >
                  <FileText className="h-4 w-4" />
                  {!collapsed && <span>Audit Log</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <Separator className="my-2" />
            </>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => { signOut(); navigate("/login"); }}
              className="hover:bg-destructive/10 hover:text-destructive transition-smooth"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

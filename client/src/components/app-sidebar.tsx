import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  FileText,
  Lightbulb,
  BarChart3,
  LogOut,
  Building2,
  Users,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthUser, clearAuthUser, getUserRole } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const authUser = getAuthUser();
  const role = getUserRole();

  const { data: notificationCounts } = useQuery<{ newTasks: number; highPriorityTasks: number }>({
    queryKey: ["/api/staff/notifications/counts"],
    refetchInterval: 10000, // Refresh every 10 seconds
    enabled: role === "Staff", // Only fetch for staff users
  });

  const handleLogout = () => {
    clearAuthUser();
    setLocation("/login");
  };

  // Admin/Agency menu items
  const agencyMenuItems = [
    {
      title: "Dashboard",
      url: "/agency",
      icon: LayoutDashboard,
      notificationKey: null,
    },
    {
      title: "Clients",
      url: "/agency/clients",
      icon: Building2,
      notificationKey: null,
    },
    {
      title: "Tasks & Projects",
      url: "/agency/tasks",
      icon: FolderKanban,
      notificationKey: null,
    },
    {
      title: "Messages",
      url: "/agency/messages",
      icon: MessageSquare,
      notificationKey: null,
    },
    {
      title: "Strategic Initiatives",
      url: "/agency/recommendations",
      icon: Lightbulb,
      notificationKey: null,
    },
    {
      title: "Staff",
      url: "/agency/staff",
      icon: Users,
      notificationKey: null,
    },
    {
      title: "Invoices",
      url: "/agency/invoices",
      icon: FileText,
      notificationKey: null,
    },
  ];

  // Staff menu items
  const staffMenuItems = [
    {
      title: "My Tasks",
      url: "/staff",
      icon: CheckSquare,
      notificationKey: "newTasks" as const,
    },
  ];

  const menuItems = role === "Admin" ? agencyMenuItems : staffMenuItems;

  if (!authUser) return null;

  const initials = authUser.profile.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sidebar-primary rounded-md flex items-center justify-center">
            <Building2 className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">{role === "Staff" ? "Staff Portal" : "Agency Portal"}</h2>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const count = item.notificationKey && notificationCounts 
                  ? notificationCounts[item.notificationKey] 
                  : 0;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`link-${item.title.toLowerCase().replace(" ", "-")}`}
                    >
                      <a href={item.url} onClick={(e) => {
                        e.preventDefault();
                        setLocation(item.url);
                      }}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {count > 0 && (
                          <Badge 
                            variant="default" 
                            className="ml-auto h-5 min-w-5 px-1 text-xs"
                            data-testid={`notification-badge-${item.notificationKey}`}
                          >
                            {count}
                          </Badge>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {authUser.profile.fullName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {authUser.email}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

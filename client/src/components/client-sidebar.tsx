import { Home, FolderKanban, Lightbulb, CreditCard, BarChart3, User, HelpCircle, LogOut, Building2 } from "lucide-react";
import { useLocation, Link } from "wouter";
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
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { getAuthUser, clearAuthUser } from "@/lib/auth";

const menuItems = [
  {
    title: "Dashboard",
    url: "/client",
    icon: Home,
    notificationKey: null,
  },
  {
    title: "Projects",
    url: "/client/projects",
    icon: FolderKanban,
    notificationKey: null,
  },
  {
    title: "Recommendations",
    url: "/client/recommendations",
    icon: Lightbulb,
    notificationKey: "newRecommendations" as const,
  },
  {
    title: "Billing",
    url: "/client/billing",
    icon: CreditCard,
    notificationKey: null,
  },
  {
    title: "Reports",
    url: "/client/reports",
    icon: BarChart3,
    notificationKey: null,
  },
  {
    title: "Profile",
    url: "/client/profile",
    icon: User,
    notificationKey: null,
  },
  {
    title: "Support",
    url: "/client/support",
    icon: HelpCircle,
    notificationKey: "unreadMessages" as const,
  },
];

export function ClientSidebar() {
  const [location, setLocation] = useLocation();
  const authUser = getAuthUser();

  const { data: notificationCounts } = useQuery<{ unreadMessages: number; newRecommendations: number }>({
    queryKey: ["/api/client/notifications/counts"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const handleLogout = () => {
    clearAuthUser();
    setLocation("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Client Portal</span>
            <span className="text-xs text-muted-foreground">{authUser?.profile.fullName}</span>
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
                      tooltip={item.title}
                      data-testid={`nav-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.url}>
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
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} tooltip="Logout" data-testid="nav-logout">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

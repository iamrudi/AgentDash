import { Home, MessageSquare, FolderKanban, Lightbulb, Building2, Users, LogOut, Shield } from "lucide-react";
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
    url: "/agency",
    icon: Home,
    notificationKey: null,
  },
  {
    title: "Client Messages",
    url: "/agency/messages",
    icon: MessageSquare,
    notificationKey: "unreadMessages" as const,
  },
  {
    title: "Tasks & Projects",
    url: "/agency/tasks",
    icon: FolderKanban,
    notificationKey: null,
  },
  {
    title: "AI Recommendations",
    url: "/agency/recommendations",
    icon: Lightbulb,
    notificationKey: "unviewedResponses" as const,
  },
  {
    title: "Clients",
    url: "/agency/clients",
    icon: Building2,
    notificationKey: null,
  },
  {
    title: "Staff",
    url: "/agency/staff",
    icon: Users,
    notificationKey: null,
  },
];

export function AgencySidebar() {
  const [location, setLocation] = useLocation();
  const authUser = getAuthUser();

  const { data: notificationCounts } = useQuery<{ unreadMessages: number; unviewedResponses: number }>({
    queryKey: ["/api/agency/notifications/counts"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const handleLogout = () => {
    clearAuthUser();
    setLocation("/login");
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Agency Portal</span>
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
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
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
                <SidebarMenuButton onClick={handleLogout} data-testid="nav-logout">
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

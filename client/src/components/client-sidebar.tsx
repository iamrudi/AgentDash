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
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { getAuthUser, clearAuthUser } from "@/lib/auth";

interface BrandingSettings {
  agencyLogo: string | null;
  clientLogo: string | null;
  staffLogo: string | null;
}

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
  const { setOpenMobile, isMobile } = useSidebar();

  const { data: notificationCounts } = useQuery<{ unreadMessages: number; newRecommendations: number }>({
    queryKey: ["/api/client/notifications/counts"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: branding } = useQuery<BrandingSettings>({
    queryKey: ['/api/agency/settings/branding'],
    staleTime: 5 * 60 * 1000,
  });

  const handleLogout = () => {
    clearAuthUser();
    setLocation("/login");
  };

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center">
            {branding?.clientLogo ? (
              <div className="h-8 w-auto max-w-[120px] flex items-center group-data-[collapsible=icon]:max-w-[32px]">
                <img 
                  src={branding.clientLogo} 
                  alt="Client Portal Logo" 
                  className="h-full w-auto object-contain"
                  data-testid="img-client-logo"
                />
              </div>
            ) : (
              <span className="font-bold text-lg group-data-[collapsible=icon]:text-base">
                <span className="text-primary">mm</span>
                <span className="group-data-[collapsible=icon]:hidden">agency</span>
              </span>
            )}
          </div>
          <Badge variant="outline" className="w-fit text-xs px-2 py-0 group-data-[collapsible=icon]:hidden">Client / Stakeholder</Badge>
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
                      <Link href={item.url} onClick={handleNavClick}>
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

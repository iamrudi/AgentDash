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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    description: "Overview of your account status and key metrics",
  },
  {
    title: "Projects",
    url: "/client/projects",
    icon: FolderKanban,
    notificationKey: null,
    description: "View active projects and track progress",
  },
  {
    title: "Recommendations",
    url: "/client/recommendations",
    icon: Lightbulb,
    notificationKey: "newRecommendations" as const,
    description: "Review strategic initiatives proposed by your agency",
  },
  {
    title: "Billing",
    url: "/client/billing",
    icon: CreditCard,
    notificationKey: null,
    description: "View invoices and manage payment details",
  },
  {
    title: "Reports",
    url: "/client/reports",
    icon: BarChart3,
    notificationKey: null,
    description: "Access analytics and performance reports",
  },
  {
    title: "Profile",
    url: "/client/profile",
    icon: User,
    notificationKey: null,
    description: "Update your account information and preferences",
  },
  {
    title: "Support",
    url: "/client/support",
    icon: HelpCircle,
    notificationKey: "unreadMessages" as const,
    description: "Chat with your account manager for assistance",
  },
];

export function ClientSidebar() {
  const [location, setLocation] = useLocation();
  const authUser = getAuthUser();
  const { setOpenMobile, isMobile, open } = useSidebar();

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
        <div className="flex flex-col gap-3">
          {branding?.clientLogo ? (
            <div className="h-10 w-auto max-w-[120px] flex items-center group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:max-w-[32px] group-data-[collapsible=icon]:justify-center">
              <img 
                src={branding.clientLogo} 
                alt="Client Portal Logo" 
                className="h-full w-auto object-contain"
                data-testid="img-client-logo"
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
              <Building2 className="h-5 w-5 text-primary group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4" />
            </div>
          )}
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
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
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url}
                          tooltip={!open ? item.title : undefined}
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
                      </TooltipTrigger>
                      {open && item.description && (
                        <TooltipContent 
                          side="right" 
                          align="center"
                          className="max-w-[200px] text-xs"
                        >
                          {item.description}
                        </TooltipContent>
                      )}
                    </Tooltip>
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

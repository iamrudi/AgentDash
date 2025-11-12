import { Home, FolderKanban, Lightbulb, CreditCard, BarChart3, User, HelpCircle, LogOut, Building2, Briefcase, BarChart2, Building, Users, DollarSign, FileText } from "lucide-react";
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
import type { Client } from "@shared/schema";

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

const crmMenuItems = [
  {
    title: "Dashboard",
    url: "/client/crm/dashboard",
    icon: BarChart2,
  },
  {
    title: "Companies",
    url: "/client/crm/companies",
    icon: Building,
  },
  {
    title: "Contacts",
    url: "/client/crm/contacts",
    icon: Users,
  },
  {
    title: "Deals",
    url: "/client/crm/deals",
    icon: DollarSign,
  },
  {
    title: "Forms",
    url: "/client/crm/forms",
    icon: FileText,
  },
];

export function ClientSidebar() {
  const [location, setLocation] = useLocation();
  const authUser = getAuthUser();
  const { setOpenMobile, isMobile } = useSidebar();

  // Fetch client data to check if CRM is enabled
  const { data: clientData } = useQuery<Client>({
    queryKey: [`/api/agency/clients/${authUser?.clientId}`],
    enabled: !!authUser?.clientId,
    refetchOnWindowFocus: true, // Refetch when window gains focus to catch admin changes
  });

  const { data: notificationCounts } = useQuery<{ unreadMessages: number; newRecommendations: number }>({
    queryKey: ["/api/client/notifications/counts"],
    refetchInterval: 10000, // Refresh every 10 seconds
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
            <span className="font-bold text-lg group-data-[collapsible=icon]:text-base">
              <span className="text-primary">mm</span>
              <span className="group-data-[collapsible=icon]:hidden">agency</span>
            </span>
          </div>
          <Badge variant="outline" className="w-fit text-xs px-2 py-0 group-data-[collapsible=icon]:hidden">
            Client Portal
          </Badge>
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
        
        {/* CRM Group - Only shown when CRM is enabled for this client */}
        {clientData?.crmEnabled === "true" && (
          <SidebarGroup>
            <SidebarGroupLabel>CRM</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {crmMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      tooltip={item.title}
                      data-testid={`nav-crm-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.url} onClick={handleNavClick}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        
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

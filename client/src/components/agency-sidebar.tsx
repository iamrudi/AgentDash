import {
  Home,
  MessageSquare,
  FolderKanban,
  Lightbulb,
  Building2,
  Users,
  LogOut,
  Shield,
  Link2,
  UserCog,
  FileText,
  BarChartHorizontal,
  Trash2,
  Zap,
  Target,
  Settings,
  Sparkles,
} from "lucide-react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { getAuthUser, clearAuthUser } from "@/lib/auth";

const menuGroups = [
  {
    title: "Core",
    icon: Zap,
    items: [
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
    ],
  },
  {
    title: "Strategy",
    icon: Target,
    items: [
      {
        title: "AI Recommendations",
        url: "/agency/recommendations",
        icon: Lightbulb,
        notificationKey: "unviewedResponses" as const,
      },
      {
        title: "Content Co-pilot",
        url: "/agency/content-copilot",
        icon: Sparkles,
        notificationKey: null,
      },
      {
        title: "SEO Audit",
        url: "/agency/seo-audit",
        icon: BarChartHorizontal,
        notificationKey: null,
      },
    ],
  },
  {
    title: "Administration",
    icon: Settings,
    items: [
      {
        title: "Clients",
        url: "/agency/clients",
        icon: Building2,
        notificationKey: null,
      },
      {
        title: "Invoices",
        url: "/agency/invoices",
        icon: FileText,
        notificationKey: null,
      },
      {
        title: "Trash",
        url: "/agency/trash",
        icon: Trash2,
        notificationKey: null,
      },
      {
        title: "Google Integrations",
        url: "/agency/integrations",
        icon: Link2,
        notificationKey: null,
      },
      {
        title: "Staff",
        url: "/agency/staff",
        icon: Users,
        notificationKey: null,
      },
      {
        title: "User Management",
        url: "/agency/users",
        icon: UserCog,
        notificationKey: null,
      },
    ],
  },
];

export function AgencySidebar() {
  const [location, setLocation] = useLocation();
  const authUser = getAuthUser();

  const { data: notificationCounts } = useQuery<{ unreadMessages: number; unviewedResponses: number }>({
    queryKey: ["/api/agency/notifications/counts"],
    refetchInterval: 10000,
  });

  const handleLogout = () => {
    clearAuthUser();
    setLocation("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
            <Shield className="h-5 w-5 text-primary group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm">Agency Portal</span>
            <span className="text-xs text-muted-foreground">{authUser?.profile.fullName}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <Accordion type="multiple" defaultValue={["Core", "Strategy", "Administration"]} className="w-full">
          {menuGroups.map((group) => (
            <AccordionItem value={group.title} key={group.title} className="border-none">
              <AccordionTrigger className="text-xs font-medium uppercase text-muted-foreground hover:no-underline py-2 px-2 justify-start gap-2 border-b border-border/40">
                <group.icon className="h-4 w-4 shrink-0" />
                <span className="group-data-[collapsible=icon]:hidden">{group.title}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <SidebarMenu>
                  {group.items.map((item) => {
                    const count = item.notificationKey && notificationCounts
                      ? notificationCounts[item.notificationKey]
                      : 0;

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url}
                          tooltip={item.title}
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
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SidebarContent>

      <div className="p-2 mt-auto border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Logout" data-testid="nav-logout">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </Sidebar>
  );
}

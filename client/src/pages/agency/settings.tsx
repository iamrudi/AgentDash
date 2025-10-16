import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { 
  Settings as SettingsIcon, 
  Link2, 
  Trash2, 
  Users, 
  UserCog,
  ChevronRight,
  PenTool,
  Search,
  DollarSign,
  Globe,
  Plus,
  X
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { RateLimitToggle } from "@/components/agency/rate-limit-toggle";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type SidebarMode = 'expanded' | 'collapsed' | 'hover';

// CORS Domains Manager Component
function CorsDomainsManager() {
  const [newDomain, setNewDomain] = useState("");
  const { toast } = useToast();

  const { data: corsData, isLoading } = useQuery({
    queryKey: ['/api/settings/cors-domains'],
  });

  const addDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      return await apiRequest('/api/settings/cors-domains', {
        method: 'POST',
        body: JSON.stringify({ domain }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/cors-domains'] });
      setNewDomain("");
      toast({
        title: "Domain added",
        description: "CORS domain has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add domain",
        variant: "destructive",
      });
    },
  });

  const removeDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      return await apiRequest('/api/settings/cors-domains', {
        method: 'DELETE',
        body: JSON.stringify({ domain }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/cors-domains'] });
      toast({
        title: "Domain removed",
        description: "CORS domain has been removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove domain",
        variant: "destructive",
      });
    },
  });

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    addDomainMutation.mutate(newDomain.trim());
  };

  const domains = corsData?.domains || [];

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
            <Globe className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium mb-1">CORS Allowed Domains</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Add trusted domains that can embed your forms and access public APIs
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="https://example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddDomain();
              }
            }}
            data-testid="input-cors-domain"
          />
          <Button
            onClick={handleAddDomain}
            disabled={!newDomain.trim() || addDomainMutation.isPending}
            data-testid="button-add-cors-domain"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : domains.length > 0 ? (
          <div className="space-y-2">
            {domains.map((domain: string) => (
              <div
                key={domain}
                className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50"
                data-testid={`cors-domain-${domain}`}
              >
                <span className="text-sm font-mono">{domain}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDomainMutation.mutate(domain)}
                  disabled={removeDomainMutation.isPending}
                  data-testid={`button-remove-cors-domain-${domain}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            No custom CORS domains configured
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Settings() {
  const [, setLocation] = useLocation();

  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(
    () => (localStorage.getItem('sidebarMode') as SidebarMode) || 'expanded'
  );

  // Listen for sidebar mode changes from other components
  useEffect(() => {
    const handleSidebarModeChange = (event: CustomEvent<SidebarMode>) => {
      setSidebarMode(event.detail);
    };

    window.addEventListener('sidebarModeChange', handleSidebarModeChange as EventListener);
    return () => {
      window.removeEventListener('sidebarModeChange', handleSidebarModeChange as EventListener);
    };
  }, []);

  const handleSidebarModeChange = (mode: SidebarMode) => {
    setSidebarMode(mode);
    localStorage.setItem('sidebarMode', mode);
    window.dispatchEvent(new CustomEvent('sidebarModeChange', { detail: mode }));
  };

  const settingsSections = [
    {
      title: "INTEGRATIONS",
      items: [
        {
          label: "Google Integrations",
          description: "GA4 & Search Console",
          icon: Link2,
          url: "/agency/integrations",
        },
        {
          label: "SEO Audit Tool",
          description: "Lighthouse & AI Analysis",
          icon: Search,
          url: "/agency/seo-audit",
        },
        {
          label: "Content Co-pilot",
          description: "AI-Powered Content Creation",
          icon: PenTool,
          url: "/agency/content-copilot",
        },
      ],
    },
    {
      title: "TEAM MANAGEMENT",
      items: [
        {
          label: "Staff",
          description: "Manage staff members",
          icon: Users,
          url: "/agency/staff",
        },
        {
          label: "User Management",
          description: "Create and manage users",
          icon: UserCog,
          url: "/agency/users",
        },
      ],
    },
    {
      title: "SYSTEM",
      items: [
        {
          label: "Trash",
          description: "Deleted initiatives (30-day retention)",
          icon: Trash2,
          url: "/agency/trash",
        },
        {
          label: "Invoices",
          description: "Billing and invoices",
          icon: DollarSign,
          url: "/agency/invoices",
        },
      ],
    },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-settings-title">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage integrations, team, and system preferences</p>
          </div>
        </div>

        {settingsSections.map((section, sectionIndex) => (
          <div key={section.title} className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground tracking-wider">
              {section.title}
            </h2>
            <Card className="divide-y divide-border">
              {section.items.map((item, itemIndex) => (
                <button
                  key={item.label}
                  onClick={() => setLocation(item.url)}
                  className="w-full flex items-center gap-4 p-4 hover-elevate active-elevate-2 text-left transition-colors"
                  data-testid={`button-setting-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </Card>
          </div>
        ))}

        <Separator className="my-6" />

        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground tracking-wider">
            SECURITY
          </h2>
          <CorsDomainsManager />
        </div>

        <Separator className="my-6" />

        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground tracking-wider">
            DEVELOPER
          </h2>
          <RateLimitToggle />
        </div>

        <Separator className="my-6" />

        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground tracking-wider">
            SIDEBAR CONTROL
          </h2>
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-1">Sidebar Display Mode</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Choose how the sidebar should be displayed
                </p>
              </div>
              <RadioGroup 
                value={sidebarMode} 
                onValueChange={(value) => handleSidebarModeChange(value as SidebarMode)}
                data-testid="radio-sidebar-mode"
              >
                <div className="flex items-center space-x-2 p-3 rounded-md hover-elevate">
                  <RadioGroupItem value="expanded" id="expanded" data-testid="radio-expanded" />
                  <Label htmlFor="expanded" className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm">Expanded</div>
                    <div className="text-xs text-muted-foreground">Sidebar is always expanded</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-md hover-elevate">
                  <RadioGroupItem value="collapsed" id="collapsed" data-testid="radio-collapsed" />
                  <Label htmlFor="collapsed" className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm">Collapsed</div>
                    <div className="text-xs text-muted-foreground">Sidebar shows icons only</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-md hover-elevate">
                  <RadioGroupItem value="hover" id="hover" data-testid="radio-hover" />
                  <Label htmlFor="hover" className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm">Expand on hover</div>
                    <div className="text-xs text-muted-foreground">Collapsed by default, expands when you hover</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

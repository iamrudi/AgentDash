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
  X,
  Bot,
  Palette
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
import { LogoUploader } from "@/components/logo-uploader";

type SidebarMode = 'expanded' | 'collapsed' | 'hover';

// AI Provider Manager Component
function AIProviderManager() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<{ aiProvider: string; isDefault: boolean; isSuperAdminGlobal?: boolean; message?: string }>({
    queryKey: ['/api/agency/settings'],
  });

  const updateProviderMutation = useMutation({
    mutationFn: async (aiProvider: string) => {
      const response = await apiRequest('PUT', '/api/agency/settings', { aiProvider });
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log('[AI Provider] PUT response data:', data);
      console.log('[AI Provider] isSuperAdminGlobal:', data?.isSuperAdminGlobal);
      console.log('[AI Provider] message:', data?.message);
      
      // Check if this is a SuperAdmin trying to change global settings
      if (data?.isSuperAdminGlobal && data?.message) {
        toast({
          title: "Information",
          description: data.message,
        });
      } else {
        toast({
          title: "AI Provider Updated",
          description: "Your AI provider preference has been saved successfully",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/agency/settings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update AI provider",
        variant: "destructive",
      });
    },
  });

  const currentProvider = settings?.aiProvider || "gemini";

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
            <Bot className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium mb-1">AI Provider</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Choose which AI provider to use for recommendations and analysis
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <RadioGroup 
            value={currentProvider}
            onValueChange={(value) => updateProviderMutation.mutate(value)}
            disabled={updateProviderMutation.isPending}
            data-testid="radio-ai-provider"
          >
            <div className="flex items-center space-x-2 p-3 rounded-md hover-elevate">
              <RadioGroupItem value="gemini" id="gemini" data-testid="radio-gemini" />
              <Label htmlFor="gemini" className="flex-1 cursor-pointer">
                <div className="font-medium text-sm">Google Gemini</div>
                <div className="text-xs text-muted-foreground">Gemini 2.5 Pro & Flash models</div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-md hover-elevate">
              <RadioGroupItem value="openai" id="openai" data-testid="radio-openai" />
              <Label htmlFor="openai" className="flex-1 cursor-pointer">
                <div className="font-medium text-sm">OpenAI</div>
                <div className="text-xs text-muted-foreground">GPT-4o & GPT-4o-mini models</div>
              </Label>
            </div>
          </RadioGroup>
        )}

        {settings?.isDefault && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            {settings?.isSuperAdminGlobal ? (
              <>
                <strong>SuperAdmin View:</strong> You are viewing the global default AI provider. 
                To change settings for a specific agency, please log in as an Admin of that agency. 
                To change the global default, update the AI_PROVIDER environment variable.
              </>
            ) : (
              "Currently using default provider from environment configuration"
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// CORS Domains Manager Component
function CorsDomainsManager() {
  const [newDomain, setNewDomain] = useState("");
  const { toast } = useToast();

  const { data: corsData, isLoading } = useQuery<{ domains: string[] }>({
    queryKey: ['/api/settings/cors-domains'],
  });

  const addDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      return await apiRequest('POST', '/api/settings/cors-domains', { domain });
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
      return await apiRequest('DELETE', '/api/settings/cors-domains', { domain });
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

// Branding Manager Component
interface BrandingSettings {
  agencyLogo: string | null;
  clientLogo: string | null;
  staffLogo: string | null;
}

function BrandingManager() {
  const { data: branding, isLoading } = useQuery<BrandingSettings>({
    queryKey: ['/api/agency/settings/branding'],
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">Loading branding settings...</div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
            <Palette className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium mb-1">Branding & White-Labeling</h3>
            <p className="text-xs text-muted-foreground">
              Upload custom logos to personalize each portal with your agency branding
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <LogoUploader
            type="agencyLogo"
            currentLogo={branding?.agencyLogo || null}
            label="Agency Portal Logo"
            description="Displayed in the admin sidebar"
            testIdPrefix="logo-agency"
          />
          
          <LogoUploader
            type="clientLogo"
            currentLogo={branding?.clientLogo || null}
            label="Client Portal Logo"
            description="Displayed in client dashboards"
            testIdPrefix="logo-client"
          />
          
          <LogoUploader
            type="staffLogo"
            currentLogo={branding?.staffLogo || null}
            label="Staff Portal Logo"
            description="Displayed in staff dashboard"
            testIdPrefix="logo-staff"
          />
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
          <strong>Tip:</strong> Use PNG or SVG files with transparent backgrounds for best results. 
          Maximum file size is 2MB. Recommended dimensions: 200x50 pixels.
        </div>
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

        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground tracking-wider">
            AI CONFIGURATION
          </h2>
          <AIProviderManager />
        </div>

        <Separator className="my-6" />

        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground tracking-wider">
            BRANDING
          </h2>
          <BrandingManager />
        </div>

        <Separator className="my-6" />

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

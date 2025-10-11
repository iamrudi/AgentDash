import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CheckCircle2, XCircle, ExternalLink, Loader2, Plus, Trash2, Target } from "lucide-react";
import { Client, ClientObjective } from "@shared/schema";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface GA4Integration {
  connected: boolean;
  ga4PropertyId?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface GA4Property {
  propertyId: string;
  displayName: string;
  accountName: string;
}

export default function ClientDetail() {
  const [, params] = useRoute("/agency/clients/:clientId");
  const clientId = params?.clientId;
  const { toast } = useToast();
  const [selectedProperty, setSelectedProperty] = useState<string>("");

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ['/api/agency/clients', clientId],
    enabled: !!clientId,
  });

  const { data: ga4Integration, isLoading: integrationLoading } = useQuery<GA4Integration>({
    queryKey: ['/api/integrations/ga4', clientId],
    enabled: !!clientId,
  });

  const { data: ga4Properties, isLoading: propertiesLoading } = useQuery<GA4Property[]>({
    queryKey: ['/api/integrations/ga4', clientId, 'properties'],
    enabled: !!clientId && ga4Integration?.connected === true,
  });

  const initiateOAuthMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/oauth/google/initiate?clientId=${clientId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to initiate OAuth');
      }
      return await response.json() as { authUrl: string };
    },
    onSuccess: (data) => {
      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    },
    onError: (error: Error) => {
      toast({
        title: "OAuth Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const savePropertyMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      return await apiRequest(
        "POST",
        `/api/integrations/ga4/${clientId}/property`,
        { ga4PropertyId: propertyId }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/ga4', clientId] });
      toast({
        title: "Success",
        description: "GA4 property saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveProperty = () => {
    if (selectedProperty) {
      savePropertyMutation.mutate(selectedProperty);
    }
  };

  const style = {
    "--sidebar-width": "16rem",
  };

  if (clientLoading) {
    return (
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between p-4 border-b">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (!client) {
    return (
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between p-4 border-b">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto p-6">
              <p className="text-muted-foreground">Client not found</p>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h1 className="text-3xl font-semibold mb-2" data-testid="text-client-name">
                  {client.companyName}
                </h1>
                <p className="text-muted-foreground">
                  Manage client details and integrations
                </p>
              </div>

              <Tabs defaultValue="integrations" className="w-full">
                <TabsList>
                  <TabsTrigger value="integrations" data-testid="tab-integrations">
                    Integrations
                  </TabsTrigger>
                  <TabsTrigger value="objectives" data-testid="tab-objectives">
                    Objectives
                  </TabsTrigger>
                  <TabsTrigger value="details" data-testid="tab-details">
                    Details
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="integrations" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Google Analytics 4</CardTitle>
                          <CardDescription>
                            Connect client's GA4 property for analytics integration
                          </CardDescription>
                        </div>
                        <div>
                          {integrationLoading ? (
                            <Badge variant="outline">Loading...</Badge>
                          ) : ga4Integration?.connected ? (
                            <Badge variant="default" className="gap-1" data-testid="badge-ga4-connected">
                              <CheckCircle2 className="h-3 w-3" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1" data-testid="badge-ga4-disconnected">
                              <XCircle className="h-3 w-3" />
                              Not Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!ga4Integration?.connected ? (
                        <div>
                          <p className="text-sm text-muted-foreground mb-4">
                            Client needs to authorize access to their Google Analytics account.
                            Click the button below to initiate the OAuth flow.
                          </p>
                          <Button
                            onClick={() => initiateOAuthMutation.mutate()}
                            disabled={initiateOAuthMutation.isPending}
                            data-testid="button-connect-ga4"
                          >
                            {initiateOAuthMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Initiating...
                              </>
                            ) : (
                              <>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Connect Google Analytics
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Connected At</p>
                              <p className="font-medium">
                                {ga4Integration.createdAt ? new Date(ga4Integration.createdAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Last Updated</p>
                              <p className="font-medium">
                                {ga4Integration.updatedAt ? new Date(ga4Integration.updatedAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="ga4-property" className="text-sm font-medium">
                              GA4 Property
                            </label>
                            {propertiesLoading ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading properties...
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Select
                                  value={selectedProperty || ga4Integration.ga4PropertyId || ""}
                                  onValueChange={setSelectedProperty}
                                >
                                  <SelectTrigger className="flex-1" data-testid="select-ga4-property">
                                    <SelectValue placeholder="Select a GA4 property" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ga4Properties?.map((property) => (
                                      <SelectItem key={property.propertyId} value={property.propertyId}>
                                        {property.displayName} ({property.accountName})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  onClick={handleSaveProperty}
                                  disabled={!selectedProperty || savePropertyMutation.isPending}
                                  data-testid="button-save-property"
                                >
                                  {savePropertyMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                              </div>
                            )}
                            {ga4Integration.ga4PropertyId && (
                              <p className="text-sm text-muted-foreground">
                                Current: {ga4Integration.ga4PropertyId}
                              </p>
                            )}
                          </div>

                          <Button
                            variant="outline"
                            onClick={() => initiateOAuthMutation.mutate()}
                            disabled={initiateOAuthMutation.isPending}
                            data-testid="button-reconnect-ga4"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Reconnect
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <SyncMetricsCard clientId={clientId!} />
                </TabsContent>

                <TabsContent value="objectives" className="space-y-4 mt-6">
                  <ObjectivesManager clientId={clientId!} />
                </TabsContent>

                <TabsContent value="details" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Client Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Company Name</p>
                          <p className="font-medium">{client.companyName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Client ID</p>
                          <p className="font-mono text-xs">{client.id}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <FinancialMetrics client={client} />
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Form schema for creating objectives
const objectiveFormSchema = z.object({
  targetMetric: z.string().min(1, "Target metric is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type ObjectiveForm = z.infer<typeof objectiveFormSchema>;

// Objectives Manager Component
function ObjectivesManager({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const form = useForm<ObjectiveForm>({
    resolver: zodResolver(objectiveFormSchema),
    defaultValues: {
      targetMetric: "",
      description: "",
    },
  });

  const { data: objectives = [], isLoading } = useQuery<ClientObjective[]>({
    queryKey: ['/api/agency/clients', clientId, 'objectives'],
    enabled: !!clientId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ObjectiveForm) => {
      return await apiRequest("POST", `/api/agency/clients/${clientId}/objectives`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agency/clients', clientId, 'objectives'] });
      form.reset();
      setShowForm(false);
      toast({
        title: "Success",
        description: "Objective created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: string }) => {
      return await apiRequest("PATCH", `/api/agency/objectives/${id}`, {
        isActive: isActive === "true" ? "false" : "true",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agency/clients', clientId, 'objectives'] });
      toast({
        title: "Success",
        description: "Objective updated successfully",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/agency/objectives/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agency/clients', clientId, 'objectives'] });
      toast({
        title: "Success",
        description: "Objective deleted successfully",
      });
    },
  });

  const onSubmit = (data: ObjectiveForm) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Client Objectives</CardTitle>
              <CardDescription>
                Set goals and targets for this client to guide AI recommendations
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowForm(!showForm)}
              size="sm"
              data-testid="button-add-objective"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Objective
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="mb-6 p-4 border rounded-lg">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="targetMetric"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Metric</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., conversions, sessions, revenue"
                            data-testid="input-target-metric"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Increase qualified organic leads by 20% in Q4"
                            rows={3}
                            data-testid="textarea-objective-description"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      data-testid="button-save-objective"
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Objective"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        form.reset();
                      }}
                      data-testid="button-cancel-objective"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : objectives.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No objectives set for this client yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {objectives.map((objective) => (
                <div
                  key={objective.id}
                  className="p-4 border rounded-lg flex items-start justify-between gap-4"
                  data-testid={`objective-${objective.id}`}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {objective.targetMetric}
                      </Badge>
                      <Badge variant={objective.isActive === "true" ? "default" : "secondary"}>
                        {objective.isActive === "true" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm">{objective.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActiveMutation.mutate({
                        id: objective.id,
                        isActive: objective.isActive || "true",
                      })}
                      disabled={toggleActiveMutation.isPending}
                      data-testid={`button-toggle-objective-${objective.id}`}
                    >
                      {objective.isActive === "true" ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(objective.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-objective-${objective.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Financial Metrics Component
function FinancialMetrics({ client }: { client: Client }) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [leadValue, setLeadValue] = useState(client.leadValue || "");
  const [retainerAmount, setRetainerAmount] = useState(client.retainerAmount || "");
  const [billingDay, setBillingDay] = useState(client.billingDay?.toString() || "");
  const [monthlyRetainerHours, setMonthlyRetainerHours] = useState(client.monthlyRetainerHours || "");

  const updateMutation = useMutation({
    mutationFn: async (data: { leadValue?: number | null; retainerAmount?: number | null; billingDay?: number | null; monthlyRetainerHours?: number | null }) => {
      return await apiRequest("PATCH", `/api/agency/clients/${client.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agency/clients', client.id] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Financial metrics updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update financial metrics",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const data = {
      leadValue: leadValue ? parseFloat(leadValue) : null,
      retainerAmount: retainerAmount ? parseFloat(retainerAmount) : null,
      billingDay: billingDay ? parseInt(billingDay) : null,
      monthlyRetainerHours: monthlyRetainerHours ? parseFloat(monthlyRetainerHours) : null,
    };
    updateMutation.mutate(data);
  };

  const handleCancel = () => {
    setLeadValue(client.leadValue || "");
    setRetainerAmount(client.retainerAmount || "");
    setBillingDay(client.billingDay?.toString() || "");
    setMonthlyRetainerHours(client.monthlyRetainerHours || "");
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Financial Metrics</CardTitle>
            <CardDescription>
              Configure pipeline calculations and billing settings
            </CardDescription>
          </div>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-financial-metrics"
            >
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="lead-value" className="text-sm font-medium">
                Lead Value ($)
              </label>
              <Input
                id="lead-value"
                type="number"
                placeholder="e.g., 500"
                value={leadValue}
                onChange={(e) => setLeadValue(e.target.value)}
                data-testid="input-lead-value"
              />
              <p className="text-xs text-muted-foreground">
                Value per lead for pipeline calculation. Pipeline = Conversions × Lead Value
              </p>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="retainer-amount" className="text-sm font-medium">
                Monthly Retainer ($)
              </label>
              <Input
                id="retainer-amount"
                type="number"
                placeholder="e.g., 5000"
                value={retainerAmount}
                onChange={(e) => setRetainerAmount(e.target.value)}
                data-testid="input-retainer-amount"
              />
              <p className="text-xs text-muted-foreground">
                Monthly retainer amount for automatic invoicing
              </p>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="billing-day" className="text-sm font-medium">
                Billing Day
              </label>
              <Input
                id="billing-day"
                type="number"
                min="1"
                max="28"
                placeholder="e.g., 25"
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value)}
                data-testid="input-billing-day"
              />
              <p className="text-xs text-muted-foreground">
                Day of month for automatic invoicing (1-28)
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="monthly-retainer-hours" className="text-sm font-medium">
                Monthly Retainer Hours
              </label>
              <Input
                id="monthly-retainer-hours"
                type="number"
                placeholder="e.g., 40"
                value={monthlyRetainerHours}
                onChange={(e) => setMonthlyRetainerHours(e.target.value)}
                data-testid="input-monthly-retainer-hours"
              />
              <p className="text-xs text-muted-foreground">
                Total hours included in monthly retainer. Hours reset on billing day.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                data-testid="button-save-financial-metrics"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
                data-testid="button-cancel-financial-metrics"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Lead Value</p>
                <p className="text-lg font-semibold" data-testid="text-lead-value">
                  {client.leadValue ? `$${parseFloat(client.leadValue).toLocaleString()}` : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Retainer</p>
                <p className="text-lg font-semibold" data-testid="text-retainer-amount">
                  {client.retainerAmount ? `$${parseFloat(client.retainerAmount).toLocaleString()}` : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Billing Day</p>
                <p className="text-lg font-semibold" data-testid="text-billing-day">
                  {client.billingDay ? `${client.billingDay}${getDaySuffix(client.billingDay)} of month` : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function SyncMetricsCard({ clientId }: { clientId: string }) {
  const { toast } = useToast();

  const syncMetricsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/agency/clients/${clientId}/sync-metrics`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agency/clients', clientId, 'metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agency/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agency/recommendations'] });
      toast({
        title: "Success",
        description: "Metrics synced successfully from GA4 and GSC",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Analytics Metrics</CardTitle>
        <CardDescription>
          Fetch the latest metrics from Google Analytics 4 and Google Search Console to enable AI recommendations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Click the button below to sync the last 30 days of analytics data. This data is required for generating AI-powered strategic recommendations.
        </p>
        <Button
          onClick={() => syncMetricsMutation.mutate()}
          disabled={syncMetricsMutation.isPending}
          data-testid="button-sync-metrics"
        >
          {syncMetricsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing Metrics...
            </>
          ) : (
            "Sync Metrics"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

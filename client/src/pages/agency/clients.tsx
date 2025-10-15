import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Client, createClientUserSchema, type CreateClientUser } from "@shared/schema";
import { Building2, Plus, Search, LayoutGrid, List, CheckCircle2, XCircle, ExternalLink, Sparkles } from "lucide-react";
import { ClientFilter } from "@/components/client-filter";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AIRecommendationsPanel } from "@/components/ai-recommendations-panel";
import { format, subDays } from "date-fns";

type EnrichedClient = Client & {
  primaryContact: string | null;
  activeProjectsCount: number;
  overdueInvoicesCount: number;
  hasGA4: boolean;
  hasGSC: boolean;
  hasDFS: boolean;
};

export default function AgencyClientsPage() {
  const [selectedClientId, setSelectedClientId] = useState("ALL");
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelClientId, setAiPanelClientId] = useState<string>("");
  const { toast } = useToast();

  const form = useForm<CreateClientUser>({
    resolver: zodResolver(createClientUserSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      companyName: "",
    },
  });

  const { data: clients } = useQuery<EnrichedClient[]>({
    queryKey: ["/api/agency/clients"],
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: CreateClientUser) => {
      return await apiRequest("POST", "/api/agency/clients/create-user", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/clients"] });
      setIsCreating(false);
      form.reset();
      toast({
        title: "Success",
        description: "Client created successfully",
      });
    },
    onError: (error: Error & { errors?: Array<{ message: string }> }) => {
      const message = error.errors?.[0]?.message || error.message || "Failed to create client";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateClientUser) => {
    createClientMutation.mutate(data);
  };

  const handleGenerateAI = (clientId: string, clientName: string) => {
    setAiPanelClientId(clientId);
    setAiPanelOpen(true);
  };

  const handleAIPanelClose = (open: boolean) => {
    setAiPanelOpen(open);
    if (!open) {
      // Reset selected client when panel closes
      setAiPanelClientId("");
    }
  };

  // Get initials from company name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Prefetch dashboard data on hover
  const prefetchDashboardData = (clientId: string) => {
    const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const endDate = format(new Date(), 'yyyy-MM-dd');
    
    queryClient.prefetchQuery({
      queryKey: ['/api/agency/clients', clientId, 'dashboard-summary', { startDate, endDate }],
      staleTime: 300000,
    });
  };

  // Apply both filters: dropdown selection and search query
  const filteredClients = clients?.filter(client => {
    const matchesDropdown = selectedClientId === "ALL" || client.id === selectedClientId;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      client.companyName.toLowerCase().includes(searchLower) ||
      (client.primaryContact?.toLowerCase().includes(searchLower) ?? false);
    return matchesDropdown && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Clients</h1>
            <p className="text-muted-foreground">
              Manage client information, integrations, and objectives
            </p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-client">
                <Plus className="h-4 w-4 mr-2" />
                Create Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Client</DialogTitle>
                <DialogDescription>
                  Add a new client to the platform
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Acme Corporation"
                            data-testid="input-company-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Full Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="John Smith"
                            data-testid="input-full-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="john@acme.com"
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter password"
                            data-testid="input-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreating(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createClientMutation.isPending}
                      data-testid="button-submit-client"
                    >
                      {createClientMutation.isPending ? "Creating..." : "Create Client"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-clients"
            />
          </div>
          <ClientFilter
            clients={clients}
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
          />
          <div className="flex items-center gap-1 border rounded-md">
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("card")}
              data-testid="button-view-card"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              data-testid="button-view-table"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!filteredClients || filteredClients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No clients found</p>
            </CardContent>
          </Card>
        ) : viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <Card key={client.id} className="hover-elevate">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getInitials(client.companyName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate" data-testid={`text-client-${client.id}`}>
                        {client.companyName}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {client.primaryContact || "No contact"}
                      </p>
                    </div>
                  </div>

                  {/* Metrics Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="secondary" data-testid={`badge-projects-${client.id}`}>
                      {client.activeProjectsCount} Active Project{client.activeProjectsCount !== 1 ? 's' : ''}
                    </Badge>
                    {client.overdueInvoicesCount > 0 && (
                      <Badge variant="destructive" data-testid={`badge-overdue-${client.id}`}>
                        {client.overdueInvoicesCount} Overdue
                      </Badge>
                    )}
                  </div>

                  {/* Integration Status & Actions */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <TooltipProvider>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center" data-testid={`integration-ga4-${client.id}`}>
                              {client.hasGA4 ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground/40" />
                              )}
                              <span className="ml-1 text-xs text-muted-foreground">GA4</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {client.hasGA4 ? "GA4 Connected" : "GA4 Not Connected"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center" data-testid={`integration-gsc-${client.id}`}>
                              {client.hasGSC ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground/40" />
                              )}
                              <span className="ml-1 text-xs text-muted-foreground">GSC</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {client.hasGSC ? "Search Console Connected" : "Search Console Not Connected"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center" data-testid={`integration-dfs-${client.id}`}>
                              {client.hasDFS ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground/40" />
                              )}
                              <span className="ml-1 text-xs text-muted-foreground">DFS</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {client.hasDFS ? "Data for SEO Connected" : "Data for SEO Not Connected"}
                          </TooltipContent>
                        </Tooltip>
                        {(!client.hasGA4 || !client.hasGSC || !client.hasDFS) && (
                          <Link href={`/agency/clients/${client.id}?tab=integrations`}>
                            <Button variant="ghost" size="sm" className="h-6 px-2" data-testid={`button-setup-integrations-${client.id}`}>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TooltipProvider>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleGenerateAI(client.id, client.companyName)}
                            data-testid={`button-ai-generate-${client.id}`}
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Generate AI Recommendations
                        </TooltipContent>
                      </Tooltip>
                      <Link 
                        href={`/agency/clients/${client.id}`}
                        onMouseEnter={() => prefetchDashboardData(client.id)}
                      >
                        <Button variant="outline" size="sm" data-testid={`button-view-client-${client.id}`}>
                          Manage
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Primary Contact</TableHead>
                  <TableHead className="text-center">Projects</TableHead>
                  <TableHead className="text-center">Integrations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {getInitials(client.companyName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{client.companyName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{client.primaryContact || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{client.activeProjectsCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        {client.hasGA4 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/40" />
                        )}
                        {client.hasGSC ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.overdueInvoicesCount > 0 ? (
                        <Badge variant="destructive">
                          {client.overdueInvoicesCount} Overdue
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleGenerateAI(client.id, client.companyName)}
                          data-testid={`button-ai-generate-table-${client.id}`}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                        <Link 
                          href={`/agency/clients/${client.id}`}
                          onMouseEnter={() => prefetchDashboardData(client.id)}
                        >
                          <Button variant="ghost" size="sm" data-testid={`button-manage-${client.id}`}>
                            Manage
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* AI Recommendations Panel */}
        <AIRecommendationsPanel
          open={aiPanelOpen}
          onOpenChange={handleAIPanelClose}
          preSelectedClientId={aiPanelClientId}
        />
    </div>
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Profile, Agency, AuditLog, Client, Initiative } from "@shared/schema";
import { Shield, Users, Building2, ScrollText, Trash2, UserCog, Mail, Key, Bot, Lightbulb, Sparkles, Loader2, Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw, Power } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type UserWithAgency = Profile & {
  agencyName?: string;
  clientName?: string;
};

type AgencyWithCounts = Agency & {
  userCount: number;
  clientCount: number;
};

type ClientWithDetails = Client & {
  agencyName: string;
  userEmail?: string;
};

type AgencySettings = {
  agencyId: string;
  agencyName: string;
  aiProvider: string;
  isDefault: boolean;
};

type InitiativeWithClient = Initiative & {
  client?: Client;
  agencyName?: string;
};

type HealthCheck = {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latency?: number;
  details?: Record<string, unknown>;
  error?: string;
};

type SystemHealth = {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  totalLatency: number;
  maintenance: {
    enabled: boolean;
    message?: string;
    enabledAt?: string;
  };
  checks: HealthCheck[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
};

export default function SuperAdminPage() {
  const [selectedUser, setSelectedUser] = useState<UserWithAgency | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [editingUserEmail, setEditingUserEmail] = useState<UserWithAgency | null>(null);
  const [newEmail, setNewEmail] = useState<string>("");
  const [editingUserPassword, setEditingUserPassword] = useState<UserWithAgency | null>(null);
  const [newPassword, setNewPassword] = useState<string>("");
  const [deletingUser, setDeletingUser] = useState<UserWithAgency | null>(null);
  const [deletingAgency, setDeletingAgency] = useState<AgencyWithCounts | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientWithDetails | null>(null);
  const [promotingUser, setPromotingUser] = useState<UserWithAgency | null>(null);
  const [selectedAgencyForSettings, setSelectedAgencyForSettings] = useState<string>("");
  const [selectedClientForRecommendations, setSelectedClientForRecommendations] = useState<string>("");
  const [recommendationPreset, setRecommendationPreset] = useState<string>("quick-wins");
  const { toast } = useToast();

  const { data: users, isLoading: usersLoading } = useQuery<UserWithAgency[]>({
    queryKey: ["/api/superadmin/users"],
  });

  const { data: agencies, isLoading: agenciesLoading } = useQuery<AgencyWithCounts[]>({
    queryKey: ["/api/superadmin/agencies"],
  });

  const { data: auditLogs, isLoading: logsLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/superadmin/audit-logs"],
  });

  const { data: clients, isLoading: clientsLoading } = useQuery<ClientWithDetails[]>({
    queryKey: ["/api/superadmin/clients"],
  });

  const { data: recommendations, isLoading: recommendationsLoading } = useQuery<InitiativeWithClient[]>({
    queryKey: ["/api/superadmin/recommendations"],
  });

  const { data: agencySettings, isLoading: settingsLoading } = useQuery<AgencySettings>({
    queryKey: ["/api/superadmin/agencies", selectedAgencyForSettings, "settings"],
    enabled: !!selectedAgencyForSettings,
  });

  const { data: systemHealth, isLoading: healthLoading, refetch: refetchHealth } = useQuery<SystemHealth>({
    queryKey: ["/api/superadmin/health"],
    refetchInterval: 30000,
  });

  const toggleMaintenanceMutation = useMutation({
    mutationFn: async ({ enabled, message }: { enabled: boolean; message?: string }) => {
      return await apiRequest("POST", "/api/superadmin/maintenance", { enabled, message });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/health"] });
      toast({
        title: "Success",
        description: "Maintenance mode updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update maintenance mode",
        variant: "destructive",
      });
    },
  });

  const updateAIProviderMutation = useMutation({
    mutationFn: async ({ agencyId, aiProvider }: { agencyId: string; aiProvider: string }) => {
      return await apiRequest("PUT", `/api/superadmin/agencies/${agencyId}/settings`, { aiProvider });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/agencies", selectedAgencyForSettings, "settings"] });
      toast({
        title: "Success",
        description: "AI provider updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update AI provider",
        variant: "destructive",
      });
    },
  });

  const generateRecommendationsMutation = useMutation({
    mutationFn: async ({ clientId, preset }: { clientId: string; preset: string }) => {
      return await apiRequest("POST", `/api/superadmin/clients/${clientId}/generate-recommendations`, { preset });
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/recommendations"] });
      const data = await response.json();
      toast({
        title: "Success",
        description: data.message || "Recommendations generated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate recommendations",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role, agencyId }: { userId: string; role: string; agencyId?: string }) => {
      return await apiRequest("PATCH", `/api/superadmin/users/${userId}/role`, { 
        role,
        ...(agencyId && { agencyId })
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users"] });
      setSelectedUser(null);
      setSelectedAgencyId("");
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      return await apiRequest("PATCH", `/api/superadmin/users/${userId}/email`, { email });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users"] });
      setEditingUserEmail(null);
      setNewEmail("");
      toast({
        title: "Success",
        description: "User email updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user email",
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      return await apiRequest("PATCH", `/api/superadmin/users/${userId}/password`, { password });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users"] });
      setEditingUserPassword(null);
      setNewPassword("");
      toast({
        title: "Success",
        description: "User password updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user password",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/superadmin/users/${userId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users"] });
      setDeletingUser(null);
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const promoteSuperAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("PATCH", `/api/superadmin/users/${userId}/promote-superadmin`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users"] });
      setPromotingUser(null);
      toast({
        title: "Success",
        description: "User promoted to SuperAdmin successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to promote user",
        variant: "destructive",
      });
    },
  });

  const deleteAgencyMutation = useMutation({
    mutationFn: async (agencyId: string) => {
      return await apiRequest("DELETE", `/api/superadmin/agencies/${agencyId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/agencies"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users"] });
      setDeletingAgency(null);
      toast({
        title: "Success",
        description: "Agency deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete agency",
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      return await apiRequest("DELETE", `/api/superadmin/clients/${clientId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/clients"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/agencies"] });
      setDeletingClient(null);
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive",
      });
    },
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "Admin":
        return "default";
      case "Staff":
        return "secondary";
      case "Client":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary/10">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-superadmin-title">
            Super Admin Portal
          </h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide user and agency management
          </p>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-7 max-w-5xl">
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="agencies" data-testid="tab-agencies">
            <Building2 className="w-4 h-4 mr-2" />
            Agencies
          </TabsTrigger>
          <TabsTrigger value="clients" data-testid="tab-clients">
            <UserCog className="w-4 h-4 mr-2" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="ai-settings" data-testid="tab-ai-settings">
            <Bot className="w-4 h-4 mr-2" />
            AI Settings
          </TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <Lightbulb className="w-4 h-4 mr-2" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">
            <Activity className="w-4 h-4 mr-2" />
            System Health
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <ScrollText className="w-4 h-4 mr-2" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Platform Users</CardTitle>
              <CardDescription>
                Manage users across all agencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="loading-users">Loading users...</div>
              ) : users && users.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Agency</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Super Admin</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                          <TableCell className="font-medium" data-testid={`text-user-name-${user.id}`}>{user.fullName}</TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(user.role)} data-testid={`badge-role-${user.id}`}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-user-agency-${user.id}`}>
                            {user.agencyName || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-user-client-${user.id}`}>
                            {user.clientName || "-"}
                          </TableCell>
                          <TableCell data-testid={`text-user-superadmin-${user.id}`}>
                            {user.isSuperAdmin ? (
                              <Badge variant="default" data-testid={`badge-superadmin-yes-${user.id}`}>
                                <Shield className="w-3 h-3 mr-1" />
                                Yes
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm" data-testid={`text-superadmin-no-${user.id}`}>
                                No
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-user-created-${user.id}`}>
                            {format(new Date(user.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(user);
                                  // Initialize to current role if not SuperAdmin, otherwise empty for manual selection
                                  setNewRole(user.isSuperAdmin ? "" : user.role);
                                  // Initialize agency if user already has one
                                  setSelectedAgencyId(user.agencyId || "");
                                }}
                                data-testid={`button-edit-user-${user.id}`}
                              >
                                <UserCog className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingUserEmail(user);
                                  setNewEmail("");
                                }}
                                data-testid={`button-edit-email-${user.id}`}
                              >
                                <Mail className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingUserPassword(user);
                                  setNewPassword("");
                                }}
                                data-testid={`button-edit-password-${user.id}`}
                              >
                                <Key className="w-4 h-4" />
                              </Button>
                              {!user.isSuperAdmin && (user.role === 'Admin' || user.role === 'Staff') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setPromotingUser(user)}
                                  data-testid={`button-promote-superadmin-${user.id}`}
                                >
                                  <Shield className="w-4 h-4 text-primary" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeletingUser(user)}
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-users">No users found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agencies" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Agencies</CardTitle>
              <CardDescription>
                View and manage all agencies on the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agenciesLoading ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="loading-agencies">Loading agencies...</div>
              ) : agencies && agencies.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agency Name</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Clients</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agencies.map((agency) => (
                        <TableRow key={agency.id} data-testid={`row-agency-${agency.id}`}>
                          <TableCell className="font-medium" data-testid={`text-agency-name-${agency.id}`}>{agency.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" data-testid={`badge-users-${agency.id}`}>
                              <Users className="w-3 h-3 mr-1" />
                              {agency.userCount}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" data-testid={`badge-clients-${agency.id}`}>
                              {agency.clientCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-agency-created-${agency.id}`}>
                            {format(new Date(agency.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingAgency(agency)}
                              data-testid={`button-delete-agency-${agency.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-agencies">No agencies found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Clients</CardTitle>
              <CardDescription>
                View and manage all clients across all agencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="loading-clients">Loading clients...</div>
              ) : clients && clients.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Agency</TableHead>
                        <TableHead>User Email</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                          <TableCell className="font-medium" data-testid={`text-client-name-${client.id}`}>
                            {client.companyName}
                          </TableCell>
                          <TableCell data-testid={`text-client-agency-${client.id}`}>
                            <Badge variant="secondary">
                              <Building2 className="w-3 h-3 mr-1" />
                              {client.agencyName}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-client-email-${client.id}`}>
                            {client.userEmail || 'N/A'}
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-client-created-${client.id}`}>
                            {format(new Date(client.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingClient(client)}
                              data-testid={`button-delete-client-${client.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-clients">No clients found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Settings</CardTitle>
              <CardDescription>
                Configure AI provider settings for each agency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="agency-settings-select">Select Agency</Label>
                  <Select value={selectedAgencyForSettings} onValueChange={setSelectedAgencyForSettings}>
                    <SelectTrigger id="agency-settings-select" data-testid="select-agency-settings">
                      <SelectValue placeholder="Choose an agency to manage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agencies?.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id}>
                          {agency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAgencyForSettings && (
                  <div className="border rounded-md p-4 space-y-4">
                    {settingsLoading ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading settings...
                      </div>
                    ) : agencySettings ? (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium mb-1">AI Provider for {agencySettings.agencyName}</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                              Choose which AI provider to use for recommendations and analysis
                              {agencySettings.isDefault && (
                                <span className="ml-2 text-yellow-600 dark:text-yellow-500">(Using default)</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <RadioGroup 
                          value={agencySettings.aiProvider}
                          onValueChange={(value) => {
                            updateAIProviderMutation.mutate({ 
                              agencyId: selectedAgencyForSettings, 
                              aiProvider: value 
                            });
                          }}
                          disabled={updateAIProviderMutation.isPending}
                          data-testid="radio-ai-provider"
                        >
                          <div className="flex items-center space-x-2 p-3 rounded-md hover-elevate">
                            <RadioGroupItem value="gemini" id="gemini" data-testid="radio-gemini" />
                            <Label htmlFor="gemini" className="flex-1 cursor-pointer">
                              <span className="font-medium">Google Gemini</span>
                              <span className="block text-xs text-muted-foreground">
                                Uses Google's Gemini AI model for recommendations
                              </span>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 p-3 rounded-md hover-elevate">
                            <RadioGroupItem value="openai" id="openai" data-testid="radio-openai" />
                            <Label htmlFor="openai" className="flex-1 cursor-pointer">
                              <span className="font-medium">OpenAI</span>
                              <span className="block text-xs text-muted-foreground">
                                Uses OpenAI's GPT model for recommendations
                              </span>
                            </Label>
                          </div>
                        </RadioGroup>

                        {updateAIProviderMutation.isPending && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Updating...
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        Unable to load settings
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate Recommendations</CardTitle>
                <CardDescription>
                  Generate AI-powered recommendations for any client
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <Label htmlFor="client-recommendations-select">Select Client</Label>
                    <Select value={selectedClientForRecommendations} onValueChange={setSelectedClientForRecommendations}>
                      <SelectTrigger id="client-recommendations-select" data-testid="select-client-recommendations">
                        <SelectValue placeholder="Choose a client..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.companyName} ({client.agencyName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <Label htmlFor="preset-select">Preset</Label>
                    <Select value={recommendationPreset} onValueChange={setRecommendationPreset}>
                      <SelectTrigger id="preset-select" data-testid="select-preset">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quick-wins">Quick Wins</SelectItem>
                        <SelectItem value="strategic-growth">Strategic Growth</SelectItem>
                        <SelectItem value="full-audit">Full Audit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={() => {
                      if (selectedClientForRecommendations) {
                        generateRecommendationsMutation.mutate({
                          clientId: selectedClientForRecommendations,
                          preset: recommendationPreset,
                        });
                      }
                    }}
                    disabled={!selectedClientForRecommendations || generateRecommendationsMutation.isPending}
                    data-testid="button-generate-recommendations"
                  >
                    {generateRecommendationsMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Recommendations</CardTitle>
                <CardDescription>
                  View recommendations across all agencies and clients
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recommendationsLoading ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="loading-recommendations">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading recommendations...
                  </div>
                ) : recommendations && recommendations.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Agency</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Impact</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recommendations.map((rec) => (
                          <TableRow key={rec.id} data-testid={`row-recommendation-${rec.id}`}>
                            <TableCell className="font-medium max-w-[200px] truncate" data-testid={`text-rec-title-${rec.id}`}>
                              {rec.title}
                            </TableCell>
                            <TableCell data-testid={`text-rec-client-${rec.id}`}>
                              {rec.client?.companyName || 'Unknown'}
                            </TableCell>
                            <TableCell data-testid={`text-rec-agency-${rec.id}`}>
                              <Badge variant="secondary">
                                <Building2 className="w-3 h-3 mr-1" />
                                {rec.agencyName || 'Unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`text-rec-status-${rec.id}`}>
                              <Badge 
                                variant={
                                  rec.status === 'approved' ? 'default' : 
                                  rec.status === 'rejected' ? 'destructive' : 
                                  'secondary'
                                }
                              >
                                {rec.status}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`text-rec-impact-${rec.id}`}>
                              <Badge variant="outline">{rec.impact || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground" data-testid={`text-rec-created-${rec.id}`}>
                              {format(new Date(rec.createdAt), "MMM d, yyyy")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-recommendations">
                    No recommendations found
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health" className="mt-6">
          <div className="grid gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">System Health Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time monitoring of platform health and services
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchHealth()}
                disabled={healthLoading}
                data-testid="button-refresh-health"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${healthLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {healthLoading && !systemHealth ? (
              <Card>
                <CardContent className="py-8">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading health status...
                  </div>
                </CardContent>
              </Card>
            ) : systemHealth ? (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        {systemHealth.status === "healthy" ? (
                          <CheckCircle className="w-8 h-8 text-green-500" />
                        ) : systemHealth.status === "degraded" ? (
                          <AlertTriangle className="w-8 h-8 text-yellow-500" />
                        ) : (
                          <XCircle className="w-8 h-8 text-red-500" />
                        )}
                        <div>
                          <p className="text-sm text-muted-foreground">Overall Status</p>
                          <p className="text-xl font-semibold capitalize" data-testid="text-overall-status">
                            {systemHealth.status}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-green-100 dark:bg-green-900">
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Healthy</p>
                          <p className="text-xl font-semibold" data-testid="text-healthy-count">
                            {systemHealth.summary.healthy}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-yellow-100 dark:bg-yellow-900">
                          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Degraded</p>
                          <p className="text-xl font-semibold" data-testid="text-degraded-count">
                            {systemHealth.summary.degraded}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-red-100 dark:bg-red-900">
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Unhealthy</p>
                          <p className="text-xl font-semibold" data-testid="text-unhealthy-count">
                            {systemHealth.summary.unhealthy}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Power className="w-5 h-5" />
                      Maintenance Mode
                    </CardTitle>
                    <CardDescription>
                      Enable maintenance mode to block non-SuperAdmin access
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={systemHealth.maintenance.enabled ? "destructive" : "secondary"}
                          data-testid="badge-maintenance-status"
                        >
                          {systemHealth.maintenance.enabled ? "ENABLED" : "DISABLED"}
                        </Badge>
                        {systemHealth.maintenance.enabled && systemHealth.maintenance.message && (
                          <span className="text-sm text-muted-foreground">
                            {systemHealth.maintenance.message}
                          </span>
                        )}
                      </div>
                      <Button
                        variant={systemHealth.maintenance.enabled ? "outline" : "destructive"}
                        size="sm"
                        onClick={() => toggleMaintenanceMutation.mutate({ 
                          enabled: !systemHealth.maintenance.enabled 
                        })}
                        disabled={toggleMaintenanceMutation.isPending}
                        data-testid="button-toggle-maintenance"
                      >
                        {toggleMaintenanceMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : systemHealth.maintenance.enabled ? (
                          "Disable Maintenance"
                        ) : (
                          "Enable Maintenance"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Health Checks</CardTitle>
                    <CardDescription>
                      Detailed status of all system components (Last check: {new Date(systemHealth.timestamp).toLocaleTimeString()}, {systemHealth.totalLatency}ms)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Component</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Latency</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {systemHealth.checks.map((check) => (
                            <TableRow key={check.name} data-testid={`row-check-${check.name}`}>
                              <TableCell className="font-medium capitalize">
                                {check.name.replace(/_/g, ' ')}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={
                                    check.status === "healthy" ? "default" :
                                    check.status === "degraded" ? "secondary" : "destructive"
                                  }
                                  data-testid={`badge-check-status-${check.name}`}
                                >
                                  {check.status === "healthy" && <CheckCircle className="w-3 h-3 mr-1" />}
                                  {check.status === "degraded" && <AlertTriangle className="w-3 h-3 mr-1" />}
                                  {check.status === "unhealthy" && <XCircle className="w-3 h-3 mr-1" />}
                                  {check.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {check.latency !== undefined ? `${check.latency}ms` : '-'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                                {check.error ? (
                                  <span className="text-red-500">{check.error}</span>
                                ) : check.details ? (
                                  <span title={JSON.stringify(check.details, null, 2)}>
                                    {Object.entries(check.details).slice(0, 3).map(([k, v]) => (
                                      <span key={k} className="mr-2">
                                        {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                      </span>
                                    ))}
                                  </span>
                                ) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    Unable to load health status
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Track all Super Admin actions across the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="loading-logs">Loading audit logs...</div>
              ) : auditLogs && auditLogs.length > 0 ? (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-4 rounded-md border"
                      data-testid={`audit-log-${log.id}`}
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                        <ScrollText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium" data-testid={`text-log-action-${log.id}`}>{log.action}</p>
                          <Badge variant="outline" className="text-xs" data-testid={`badge-log-type-${log.id}`}>
                            {log.resourceType}
                          </Badge>
                        </div>
                        {log.resourceId && (
                          <p className="text-sm text-muted-foreground" data-testid={`text-log-resource-${log.id}`}>
                            Resource ID: {log.resourceId}
                          </p>
                        )}
                        {log.details != null && (
                          <p className="text-sm text-muted-foreground" data-testid={`text-log-details-${log.id}`}>
                            {(() => {
                              const d = log.details;
                              return typeof d === 'string' ? d : JSON.stringify(d);
                            })()}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground" data-testid={`text-log-created-${log.id}`}>
                          {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-logs">No audit logs found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Update Role Dialog */}
      {selectedUser && (
        <AlertDialog open={!!selectedUser} onOpenChange={() => {
          setSelectedUser(null);
          setSelectedAgencyId("");
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Update User Role</AlertDialogTitle>
              <AlertDialogDescription>
                Change the role for {selectedUser.fullName}
                {selectedUser.isSuperAdmin && (
                  <span className="block mt-2 text-yellow-600 dark:text-yellow-500">
                    <strong>Warning:</strong> Demoting from SuperAdmin requires selecting an agency.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role-select">Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger id="role-select" data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                    <SelectItem value="Client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Show agency selector when demoting from SuperAdmin or when role requires agency */}
              {(selectedUser.isSuperAdmin || !selectedUser.agencyId) && newRole !== "SuperAdmin" && (
                <div className="space-y-2">
                  <Label htmlFor="agency-select">
                    Agency <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
                    <SelectTrigger id="agency-select" data-testid="select-agency">
                      <SelectValue placeholder="Select an agency" />
                    </SelectTrigger>
                    <SelectContent>
                      {agencies?.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id}>
                          {agency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedAgencyId && (
                    <p className="text-sm text-muted-foreground">
                      Required when demoting from SuperAdmin or assigning agency
                    </p>
                  )}
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-role">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  if (!selectedUser) return;
                  
                  // Validate role selection
                  if (!newRole) {
                    e.preventDefault();
                    toast({
                      title: "Role Required",
                      description: "Please select a role",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Validate agency requirement
                  const requiresAgency = (selectedUser.isSuperAdmin || !selectedUser.agencyId) && newRole !== "SuperAdmin";
                  
                  if (requiresAgency && !selectedAgencyId) {
                    e.preventDefault();
                    toast({
                      title: "Agency Required",
                      description: "Please select an agency for this role",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  updateRoleMutation.mutate({
                    userId: selectedUser.id,
                    role: newRole,
                    agencyId: selectedAgencyId || undefined,
                  });
                }}
                data-testid="button-confirm-role"
              >
                Update Role
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Update Email Dialog */}
      {editingUserEmail && (
        <AlertDialog open={!!editingUserEmail} onOpenChange={() => setEditingUserEmail(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Update User Email</AlertDialogTitle>
              <AlertDialogDescription>
                Change the email address for {editingUserEmail.fullName}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="new-email">New Email Address</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                data-testid="input-new-email"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-email">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (editingUserEmail && newEmail) {
                    updateEmailMutation.mutate({
                      userId: editingUserEmail.id,
                      email: newEmail,
                    });
                  }
                }}
                disabled={!newEmail || !newEmail.includes('@')}
                data-testid="button-confirm-email"
              >
                Update Email
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Update Password Dialog */}
      {editingUserPassword && (
        <AlertDialog open={!!editingUserPassword} onOpenChange={() => setEditingUserPassword(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Update User Password</AlertDialogTitle>
              <AlertDialogDescription>
                Set a new password for {editingUserPassword.fullName}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-password">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (editingUserPassword && newPassword) {
                    updatePasswordMutation.mutate({
                      userId: editingUserPassword.id,
                      password: newPassword,
                    });
                  }
                }}
                disabled={!newPassword || newPassword.length < 6}
                data-testid="button-confirm-password"
              >
                Update Password
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Promote to SuperAdmin Dialog */}
      {promotingUser && (
        <AlertDialog open={!!promotingUser} onOpenChange={() => setPromotingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Promote to SuperAdmin</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to promote <span className="font-semibold">{promotingUser.fullName}</span> to SuperAdmin?
                <br /><br />
                <span className="text-sm font-medium">This will:</span>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>Grant platform-wide access across all agencies</li>
                  <li>Remove their agency assignment</li>
                  <li>Give them full administrative privileges</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-promote">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (promotingUser) {
                    promoteSuperAdminMutation.mutate(promotingUser.id);
                  }
                }}
                disabled={promoteSuperAdminMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-confirm-promote"
              >
                {promoteSuperAdminMutation.isPending ? "Promoting..." : "Promote to SuperAdmin"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete User Dialog */}
      {deletingUser && (
        <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deletingUser.fullName}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-user">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingUser) {
                    deleteUserMutation.mutate(deletingUser.id);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-user"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Agency Dialog */}
      {deletingAgency && (
        <AlertDialog open={!!deletingAgency} onOpenChange={() => setDeletingAgency(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Agency</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deletingAgency.name}? This will also delete all associated users and clients. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-agency">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingAgency) {
                    deleteAgencyMutation.mutate(deletingAgency.id);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-agency"
              >
                Delete Agency
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Client Dialog */}
      {deletingClient && (
        <AlertDialog open={!!deletingClient} onOpenChange={() => setDeletingClient(null)}>
          <AlertDialogContent data-testid="dialog-delete-client">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Client</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deletingClient.companyName}</span>?
                This will permanently delete the client and all associated data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-client">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deletingClient && deleteClientMutation.mutate(deletingClient.id)}
                data-testid="button-confirm-delete-client"
              >
                Delete Client
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Profile, Agency, AuditLog, Client } from "@shared/schema";
import { Shield, Users, Building2, ScrollText, Trash2, UserCog, Mail, Key } from "lucide-react";
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

export default function SuperAdminPage() {
  const [selectedUser, setSelectedUser] = useState<UserWithAgency | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [editingUserEmail, setEditingUserEmail] = useState<UserWithAgency | null>(null);
  const [newEmail, setNewEmail] = useState<string>("");
  const [editingUserPassword, setEditingUserPassword] = useState<UserWithAgency | null>(null);
  const [newPassword, setNewPassword] = useState<string>("");
  const [deletingUser, setDeletingUser] = useState<UserWithAgency | null>(null);
  const [deletingAgency, setDeletingAgency] = useState<AgencyWithCounts | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientWithDetails | null>(null);
  const [promotingUser, setPromotingUser] = useState<UserWithAgency | null>(null);
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

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest("PATCH", `/api/superadmin/users/${userId}/role`, { role });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users"] });
      setSelectedUser(null);
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
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
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
                                  setNewRole(user.role);
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
                        {log.details && (
                          <p className="text-sm text-muted-foreground" data-testid={`text-log-details-${log.id}`}>
                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
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
        <AlertDialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Update User Role</AlertDialogTitle>
              <AlertDialogDescription>
                Change the role for {selectedUser.fullName}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Staff">Staff</SelectItem>
                  <SelectItem value="Client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-role">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedUser) {
                    updateRoleMutation.mutate({
                      userId: selectedUser.id,
                      role: newRole,
                    });
                  }
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

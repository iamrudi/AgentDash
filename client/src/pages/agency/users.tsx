import { useQuery, useMutation } from "@tanstack/react-query";
import { AgencyLayout } from "@/components/agency-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Profile, Client } from "@shared/schema";
import { Users as UsersIcon, Mail, Building2, Shield, UserCog } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserWithProfile = User & {
  profile: Profile | null;
  client?: Client | null;
};

export default function AgencyUsersPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<UserWithProfile[]>({
    queryKey: ["/api/agency/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest("PATCH", `/api/agency/users/${userId}/role`, { role });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/agency/users"] });
      setIsEditing(false);
      setSelectedUser(null);
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const handleEditRole = (user: UserWithProfile) => {
    setSelectedUser(user);
    setNewRole(user.profile?.role || "Client");
    setIsEditing(true);
  };

  const handleSaveRole = () => {
    if (selectedUser && newRole) {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
    }
  };

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
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">User Management</h1>
            <p className="text-muted-foreground">
              View and manage all users and their roles
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              All Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading users...
              </div>
            ) : !users || users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UsersIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No users found</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {user.profile?.role === "Admin" ? (
                                <Shield className="h-4 w-4 text-primary" />
                              ) : user.profile?.role === "Staff" ? (
                                <UserCog className="h-4 w-4 text-primary" />
                              ) : (
                                <Building2 className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            {user.profile?.fullName || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.profile?.role || "")} data-testid={`badge-role-${user.id}`}>
                            {user.profile?.role || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.client?.companyName || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRole(user)}
                            data-testid={`button-edit-${user.id}`}
                          >
                            Edit Role
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User Role</DialogTitle>
              <DialogDescription>
                Change the role for {selectedUser?.profile?.fullName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="user-email">Email</Label>
                <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">
                  {selectedUser?.email}
                </div>
              </div>
              <div>
                <Label htmlFor="user-role">Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Client">Client</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveRole}
                  disabled={updateRoleMutation.isPending}
                  data-testid="button-save-role"
                >
                  {updateRoleMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AgencyLayout>
  );
}

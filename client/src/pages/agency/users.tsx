import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Profile, Client, createStaffAdminUserSchema, type CreateStaffAdminUser } from "@shared/schema";
import { Users as UsersIcon, Mail, Building2, Shield, UserCog, Plus, Trash2, Filter } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const { toast } = useToast();

  const form = useForm<CreateStaffAdminUser>({
    resolver: zodResolver(createStaffAdminUserSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      role: "Staff",
    },
  });

  const { data: users, isLoading } = useQuery<UserWithProfile[]>({
    queryKey: ["/api/agency/users"],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateStaffAdminUser) => {
      return await apiRequest("POST", "/api/agency/users/create", data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/agency/users"] });
      setIsCreating(false);
      form.reset();
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: Error & { errors?: Array<{ message: string }> }) => {
      const message = error.errors?.[0]?.message || error.message || "Failed to create user";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
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
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/agency/users/${userId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/agency/users"] });
      setIsDeleting(false);
      setSelectedUser(null);
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

  const handleDeleteUser = (user: UserWithProfile) => {
    setSelectedUser(user);
    setIsDeleting(true);
  };

  const confirmDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  const onSubmit = (data: CreateStaffAdminUser) => {
    createUserMutation.mutate(data);
  };

  // Filter users by role
  const filteredUsers = users?.filter(user => {
    if (roleFilter === "all") return true;
    return user.profile?.role === roleFilter;
  }) || [];

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
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">User Management</h1>
            <p className="text-muted-foreground">
              View and manage all users and their roles
            </p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new staff member or administrator to the platform
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Staff">Staff</SelectItem>
                            <SelectItem value="Admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" data-testid="input-fullname" {...field} />
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
                          <Input type="email" placeholder="john@example.com" data-testid="input-email" {...field} />
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
                          <Input type="password" placeholder="••••••••" data-testid="input-password" {...field} />
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
                      data-testid="button-cancel-create"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit-user">
                      {createUserMutation.isPending ? "Creating..." : "Create User"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5" />
                All Users
              </CardTitle>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-role-filter">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                    <SelectItem value="Client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UsersIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No users found with the selected filter</p>
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
                    {filteredUsers.map((user) => (
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
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRole(user)}
                              data-testid={`button-edit-${user.id}`}
                            >
                              Edit Role
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user)}
                              data-testid={`button-delete-${user.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
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

        <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedUser?.profile?.fullName}? This action cannot be undone.
                This will permanently delete the user account and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleteUserMutation.isPending}
                data-testid="button-confirm-delete"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  );
}

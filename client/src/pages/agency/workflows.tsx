import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Play,
  Zap,
  GitBranch,
} from "lucide-react";
import { format } from "date-fns";

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  steps: unknown;
  updatedAt: string;
  createdAt: string;
}

export default function Workflows() {
  const { toast } = useToast();

  const { data: workflows, isLoading } = useQuery<Workflow[]>({
    queryKey: ["/api/workflows"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/workflows/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Workflow deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete workflow", description: error.message, variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/workflows/${id}/duplicate`);
    },
    onSuccess: () => {
      toast({ title: "Workflow duplicated" });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to duplicate workflow", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Published</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "archived":
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Workflows</h1>
          <p className="text-muted-foreground">Build and manage automated workflows</p>
        </div>
        <Link href="/agency/workflow-builder">
          <Button data-testid="button-create-workflow">
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !workflows || workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <GitBranch className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Create your first workflow to automate tasks, process signals, and orchestrate AI operations.
            </p>
            <Link href="/agency/workflow-builder">
              <Button data-testid="button-create-first-workflow">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Workflow
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Workflows</CardTitle>
            <CardDescription>{workflows.length} workflow{workflows.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <TableRow key={workflow.id} data-testid={`row-workflow-${workflow.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <Link href={`/agency/workflow-builder/${workflow.id}`}>
                            <span className="font-medium hover:underline cursor-pointer" data-testid={`link-workflow-${workflow.id}`}>
                              {workflow.name}
                            </span>
                          </Link>
                          {workflow.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{workflow.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(workflow.status)}</TableCell>
                    <TableCell>
                      {(() => {
                        const steps = workflow.steps;
                        if (Array.isArray(steps)) return steps.length;
                        if (steps && typeof steps === 'object') {
                          const arr = (steps as Record<string, unknown>).steps;
                          if (Array.isArray(arr)) return arr.length;
                        }
                        return 0;
                      })()} steps
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(() => {
                        const dateStr = workflow.updatedAt || workflow.createdAt;
                        if (!dateStr) return "-";
                        try {
                          return format(new Date(dateStr), "MMM d, yyyy");
                        } catch {
                          return "-";
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-workflow-menu-${workflow.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/agency/workflow-builder/${workflow.id}`}>
                            <DropdownMenuItem>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(workflow.id)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          {workflow.status === "published" && (
                            <DropdownMenuItem>
                              <Play className="h-4 w-4 mr-2" />
                              Run Now
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(workflow.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

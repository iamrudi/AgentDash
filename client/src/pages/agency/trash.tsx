import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Initiative, Client } from "@shared/schema";
import { Trash2, RotateCcw, Building2, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";

export default function TrashPage() {
  const { toast } = useToast();
  
  const { data: deletedInitiatives, isLoading } = useQuery<Initiative[]>({
    queryKey: ["/api/initiatives/trash"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const restoreMutation = useMutation({
    mutationFn: async (initiativeId: string) => {
      return await apiRequest("POST", `/api/initiatives/${initiativeId}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/initiatives/trash"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/initiatives"] });
      toast({
        title: "Initiative restored",
        description: "The initiative has been restored successfully.",
      });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (initiativeId: string) => {
      return await apiRequest("DELETE", `/api/initiatives/${initiativeId}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/initiatives/trash"] });
      toast({
        title: "Initiative permanently deleted",
        description: "The initiative has been permanently deleted.",
        variant: "destructive",
      });
    },
  });

  const getDaysUntilDeletion = (deletedAt: string | Date | null) => {
    if (!deletedAt) return 30;
    const deleted = typeof deletedAt === 'string' ? new Date(deletedAt) : deletedAt;
    const now = new Date();
    const daysPassed = Math.floor((now.getTime() - deleted.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysPassed);
  };

  if (isLoading) {
    return (
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Trash</h1>
              <p className="text-muted-foreground">Deleted initiatives are kept for 30 days</p>
            </div>
          </div>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>Loading...</p>
            </CardContent>
          </Card>
        </div>
    );
  }

  return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Trash</h1>
            <p className="text-muted-foreground">
              Deleted initiatives are kept for 30 days before permanent deletion
            </p>
          </div>
        </div>

        {!deletedInitiatives || deletedInitiatives.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No deleted initiatives</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {deletedInitiatives.map((initiative) => {
              const client = clients?.find(c => c.id === initiative.clientId);
              const daysLeft = getDaysUntilDeletion(initiative.deletedAt);
              
              return (
                <Card key={initiative.id} data-testid={`trash-initiative-${initiative.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{client?.companyName || "Unknown Client"}</span>
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Deleted
                          </Badge>
                          <Badge variant="outline">
                            {daysLeft} day{daysLeft !== 1 ? 's' : ''} until permanent deletion
                          </Badge>
                        </div>
                        <CardTitle className="text-lg">{initiative.title}</CardTitle>
                        {initiative.deletedAt && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Deleted {formatDistanceToNow(
                              typeof initiative.deletedAt === 'string' 
                                ? new Date(initiative.deletedAt) 
                                : initiative.deletedAt, 
                              { addSuffix: true }
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreMutation.mutate(initiative.id)}
                          disabled={restoreMutation.isPending}
                          data-testid={`button-restore-${initiative.id}`}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              data-testid={`button-permanent-delete-${initiative.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete Forever
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Permanently Delete Initiative</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the initiative and remove all associated data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => permanentDeleteMutation.mutate(initiative.id)}
                                disabled={permanentDeleteMutation.isPending}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                data-testid={`button-confirm-permanent-delete-${initiative.id}`}
                              >
                                {permanentDeleteMutation.isPending ? "Deleting..." : "Delete Forever"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {initiative.observation && (
                      <div>
                        <p className="text-sm font-medium mb-1">Observation</p>
                        <p className="text-sm text-muted-foreground">{initiative.observation}</p>
                      </div>
                    )}
                    {initiative.proposedAction && (
                      <div>
                        <p className="text-sm font-medium mb-1">Proposed Action</p>
                        <p className="text-sm text-muted-foreground">{initiative.proposedAction}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      {initiative.billingType === "hours" && initiative.estimatedHours ? (
                        <div>
                          <span className="font-medium">Hours:</span> {initiative.estimatedHours}h
                        </div>
                      ) : initiative.cost ? (
                        <div>
                          <span className="font-medium">Cost:</span> ${initiative.cost}
                        </div>
                      ) : null}
                      {initiative.impact && (
                        <div>
                          <span className="font-medium">Impact:</span> {initiative.impact}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
  );
}

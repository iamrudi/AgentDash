import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Building2, DollarSign, Plus, TrendingUp, User, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateDealDialog } from "@/components/crm/create-deal-dialog";
import { EditDealDialog } from "@/components/crm/edit-deal-dialog";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Deal, Contact, Company } from "@shared/schema";

const stageColors = {
  "lead": "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  "qualified": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  "proposal": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  "closed-won": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  "closed-lost": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

const stageLabels = {
  "lead": "Lead",
  "qualified": "Qualified",
  "proposal": "Proposal",
  "closed-won": "Closed Won",
  "closed-lost": "Closed Lost",
};

export default function DealsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: deals = [], isLoading } = useQuery<(Deal & { contact?: Contact; company?: Company | null })[]>({
    queryKey: ["/api/crm/deals"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/crm/deals/${id}`, {});
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Deal deleted successfully." 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not delete deal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (deal: Deal) => {
    if (window.confirm(`Are you sure you want to delete deal "${deal.name}"?`)) {
      deleteMutation.mutate(deal.id);
    }
  };

  const formatCurrency = (cents?: number | null) => {
    if (!cents) return "—";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Deals</h1>
          <p className="text-muted-foreground mt-1">Manage your sales pipeline and opportunities</p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          data-testid="button-create-deal"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Deal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Deals</CardTitle>
          <CardDescription>Track and manage your sales opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading deals...</p>
            </div>
          ) : deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" data-testid="empty-state">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No deals yet</h3>
              <p className="text-muted-foreground mb-4">Start tracking your sales pipeline</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Deal
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Close Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((deal) => (
                    <TableRow key={deal.id} data-testid={`row-deal-${deal.id}`}>
                      <TableCell className="font-medium" data-testid={`text-deal-name-${deal.id}`}>
                        {deal.name}
                      </TableCell>
                      <TableCell data-testid={`text-deal-value-${deal.id}`}>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {formatCurrency(deal.value)}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`badge-deal-stage-${deal.id}`}>
                        <Badge className={stageColors[deal.stage as keyof typeof stageColors]}>
                          {stageLabels[deal.stage as keyof typeof stageLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-deal-contact-${deal.id}`}>
                        {deal.contact ? (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {deal.contact.firstName} {deal.contact.lastName}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-deal-company-${deal.id}`}>
                        {deal.company ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {deal.company.name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-deal-close-date-${deal.id}`}>
                        {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-deal-created-${deal.id}`}>
                        {new Date(deal.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(deal)}
                            data-testid={`button-edit-deal-${deal.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(deal)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-deal-${deal.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
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

      <CreateDealDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
      
      <EditDealDialog
        deal={editingDeal as any}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </div>
  );
}

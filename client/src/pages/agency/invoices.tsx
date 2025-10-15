import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Invoice, Client, insertInvoiceSchema, type InsertInvoice } from "@shared/schema";
import { FileText, Plus, DollarSign, Calendar, TrendingUp, AlertCircle, Receipt, Download, Eye } from "lucide-react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClientFilter } from "@/components/client-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InvoiceWithClient = Invoice & {
  client: Client;
};

export default function AgencyInvoicesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("ALL");
  const { toast } = useToast();

  const { data: invoices = [], isLoading } = useQuery<InvoiceWithClient[]>({
    queryKey: ["/api/client/invoices"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const form = useForm<InsertInvoice>({
    resolver: zodResolver(insertInvoiceSchema),
    defaultValues: {
      invoiceNumber: "",
      totalAmount: "",
      status: "Draft",
      issueDate: "",
      dueDate: "",
      clientId: "",
      pdfUrl: "",
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: InsertInvoice) => {
      return await apiRequest("POST", "/api/invoices", data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/client/invoices"] });
      setIsCreating(false);
      form.reset();
      toast({
        title: "Success",
        description: "Invoice created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/invoices/${invoiceId}/status`, { status });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/client/invoices"] });
      setEditingStatusId(null);
      toast({
        title: "Success",
        description: "Invoice status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update invoice status",
        variant: "destructive",
      });
    },
  });

  const generatePdfMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return await apiRequest("POST", `/api/invoices/${invoiceId}/generate-pdf`, {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/client/invoices"] });
      toast({
        title: "Success",
        description: "PDF generated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate PDF",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertInvoice) => {
    createInvoiceMutation.mutate(data);
  };

  const handleStatusChange = (invoiceId: string, newStatus: string) => {
    updateStatusMutation.mutate({ invoiceId, status: newStatus });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Paid":
        return "default";
      case "Draft":
        return "outline";
      case "Due":
        return "secondary";
      case "Overdue":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Filter invoices by selected client
  const filteredInvoices = selectedClientId === "ALL" 
    ? invoices 
    : invoices.filter(inv => inv.clientId === selectedClientId);

  // Calculate metrics from filtered invoices
  const totalRevenue = filteredInvoices
    .filter(inv => inv.status === "Paid")
    .reduce((sum, inv) => sum + parseFloat(inv.totalAmount), 0);

  const outstandingAmount = filteredInvoices
    .filter(inv => inv.status === "Due" || inv.status === "Overdue")
    .reduce((sum, inv) => sum + parseFloat(inv.totalAmount), 0);

  const totalInvoices = filteredInvoices.length;

  const overdueCount = filteredInvoices.filter(inv => inv.status === "Overdue").length;

  return (
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Invoice Management</h1>
            <p className="text-muted-foreground">
              Create and manage client invoices
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ClientFilter 
              clients={clients}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
              testId="select-invoice-client-filter"
            />
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-invoice">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Invoice</DialogTitle>
                <DialogDescription>
                  Generate a new invoice for a client
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-client">
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.companyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Number</FormLabel>
                        <FormControl>
                          <Input placeholder="INV-001" data-testid="input-invoice-number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Amount</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="1000.00" data-testid="input-amount" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="issueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issue Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-issue-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-due-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Draft">Draft</SelectItem>
                            <SelectItem value="Due">Due</SelectItem>
                            <SelectItem value="Paid">Paid</SelectItem>
                            <SelectItem value="Overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
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
                    <Button type="submit" disabled={createInvoiceMutation.isPending} data-testid="button-submit-invoice">
                      {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-total-revenue">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-revenue">
                ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">From paid invoices</p>
            </CardContent>
          </Card>

          <Card data-testid="card-outstanding">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-outstanding">
                ${outstandingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Due and overdue</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-invoices">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-invoices">
                {totalInvoices}
              </div>
              <p className="text-xs text-muted-foreground">All statuses</p>
            </CardContent>
          </Card>

          <Card data-testid="card-overdue">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-overdue-count">
                {overdueCount}
              </div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              All Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading invoices...
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No invoices found</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                        <TableCell className="font-medium">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          {invoice.client?.companyName || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            {parseFloat(invoice.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {editingStatusId === invoice.id ? (
                            <Select
                              defaultValue={invoice.status}
                              onValueChange={(value) => handleStatusChange(invoice.id, value)}
                              data-testid={`select-status-${invoice.id}`}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Draft">Draft</SelectItem>
                                <SelectItem value="Due">Due</SelectItem>
                                <SelectItem value="Paid">Paid</SelectItem>
                                <SelectItem value="Overdue">Overdue</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={getStatusBadgeVariant(invoice.status)} data-testid={`badge-status-${invoice.id}`}>
                              {invoice.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(invoice.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {editingStatusId === invoice.id ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingStatusId(null)}
                                data-testid={`button-cancel-edit-${invoice.id}`}
                              >
                                Cancel
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingStatusId(invoice.id)}
                                  data-testid={`button-edit-status-${invoice.id}`}
                                >
                                  Status
                                </Button>
                                {!invoice.pdfUrl && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => generatePdfMutation.mutate(invoice.id)}
                                    disabled={generatePdfMutation.isPending}
                                    data-testid={`button-generate-pdf-${invoice.id}`}
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    PDF
                                  </Button>
                                )}
                                {invoice.pdfUrl && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(invoice.pdfUrl!, "_blank")}
                                    data-testid={`button-view-pdf-${invoice.id}`}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    PDF
                                  </Button>
                                )}
                              </>
                            )}
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
      </div>
  );
}

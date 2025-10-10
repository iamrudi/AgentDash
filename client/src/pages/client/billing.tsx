import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, FileText } from "lucide-react";
import { InvoiceWithClient } from "@shared/schema";
import { format } from "date-fns";

export default function Billing() {
  const { data: invoices = [], isLoading } = useQuery<InvoiceWithClient[]>({
    queryKey: ["/api/client/invoices"],
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-billing">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your invoices and payment methods</p>
      </div>

      {/* How to Pay Card */}
      <Card data-testid="card-how-to-pay">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            How to Pay
          </CardTitle>
          <CardDescription>Payment methods and instructions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-semibold mb-2">Accepted Payment Methods</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Bank Transfer / Wire</li>
              <li>Credit Card (Visa, Mastercard, Amex)</li>
              <li>ACH Payment</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Payment Instructions</h4>
            <p className="text-sm text-muted-foreground">
              Please include your invoice number in the payment reference. For bank transfers, 
              contact your account manager for wire details. All payments are due within 30 days of invoice date.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Table */}
      <Card data-testid="card-invoices">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoices
          </CardTitle>
          <CardDescription>View and track your invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No invoices found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="table-head-invoice">Invoice #</TableHead>
                  <TableHead data-testid="table-head-date">Date</TableHead>
                  <TableHead data-testid="table-head-amount">Amount</TableHead>
                  <TableHead data-testid="table-head-status">Status</TableHead>
                  <TableHead data-testid="table-head-due-date">Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id} data-testid={`invoice-row-${invoice.id}`}>
                    <TableCell className="font-medium" data-testid={`invoice-number-${invoice.id}`}>
                      #{invoice.invoiceNumber}
                    </TableCell>
                    <TableCell data-testid={`invoice-date-${invoice.id}`}>
                      {format(new Date(invoice.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell data-testid={`invoice-amount-${invoice.id}`}>
                      ${invoice.amount.toLocaleString()}
                    </TableCell>
                    <TableCell data-testid={`invoice-status-${invoice.id}`}>
                      <Badge 
                        variant={invoice.status === "Paid" ? "default" : invoice.status === "Pending" ? "secondary" : "destructive"}
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`invoice-due-date-${invoice.id}`}>
                      {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

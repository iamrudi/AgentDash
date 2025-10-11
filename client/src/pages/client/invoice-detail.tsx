import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { InvoiceWithClient, InvoiceLineItem } from "@shared/schema";
import { format } from "date-fns";

export default function InvoiceDetail() {
  const [, params] = useRoute("/client/invoices/:id");
  const [, setLocation] = useLocation();
  const invoiceId = params?.id;

  const { data: invoice, isLoading: invoiceLoading } = useQuery<InvoiceWithClient>({
    queryKey: ['/api/client/invoices', invoiceId],
    enabled: !!invoiceId,
  });

  const { data: lineItems = [], isLoading: lineItemsLoading } = useQuery<InvoiceLineItem[]>({
    queryKey: ["/api/invoices", invoiceId, "line-items"],
    enabled: !!invoiceId,
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Paid":
        return "default";
      case "Overdue":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (invoiceLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-muted-foreground">Loading invoice...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-muted-foreground">Invoice not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/client/billing")}
            data-testid="button-back-to-billing"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Billing
          </Button>
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-invoice-detail">
              Invoice #{invoice.invoiceNumber}
            </h1>
            <p className="text-muted-foreground mt-1">
              Issued {invoice.issueDate ? format(new Date(invoice.issueDate), "MMMM d, yyyy") : "N/A"}
            </p>
          </div>
        </div>
        {invoice.pdfUrl && (
          <Button
            variant="default"
            onClick={() => window.open(invoice.pdfUrl!, "_blank")}
            data-testid="button-download-pdf"
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        )}
      </div>

      {/* Invoice Summary Card */}
      <Card data-testid="card-invoice-summary">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Summary
            </span>
            <Badge variant={getStatusVariant(invoice.status)} data-testid="badge-invoice-status">
              {invoice.status}
            </Badge>
          </CardTitle>
          <CardDescription>Complete invoice details and payment information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Bill To</h4>
              <p className="text-sm" data-testid="text-client-name">
                {invoice.client?.companyName || "N/A"}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Payment Details</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date:</span>
                  <span data-testid="text-due-date">{format(new Date(invoice.dueDate), "MMMM d, yyyy")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-semibold" data-testid="text-total-amount">
                    ${Number(invoice.totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items Card */}
      <Card data-testid="card-line-items">
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>Detailed breakdown of charges</CardDescription>
        </CardHeader>
        <CardContent>
          {lineItemsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading line items...</div>
          ) : lineItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No line items found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="table-head-description">Description</TableHead>
                    <TableHead data-testid="table-head-quantity" className="text-right">Quantity</TableHead>
                    <TableHead data-testid="table-head-unit-price" className="text-right">Unit Price</TableHead>
                    <TableHead data-testid="table-head-total" className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id} data-testid={`line-item-row-${item.id}`}>
                      <TableCell data-testid={`line-item-description-${item.id}`}>
                        {item.description}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`line-item-quantity-${item.id}`}>
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`line-item-unit-price-${item.id}`}>
                        ${Number(item.unitPrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`line-item-total-${item.id}`}>
                        ${Number(item.lineTotal).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span data-testid="text-line-items-total">
                        ${Number(invoice.totalAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Instructions Card */}
      <Card data-testid="card-payment-instructions">
        <CardHeader>
          <CardTitle>Payment Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-semibold mb-2">How to Pay</h4>
            <p className="text-sm text-muted-foreground">
              Please include invoice number <strong>#{invoice.invoiceNumber}</strong> in your payment reference.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Accepted Payment Methods</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Bank Transfer / Wire</li>
              <li>Credit Card (Visa, Mastercard, Amex)</li>
              <li>ACH Payment</li>
            </ul>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              For wire transfer details, please contact your account manager. All payments are due within 30 days of invoice date.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

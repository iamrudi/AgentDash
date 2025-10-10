import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceWithClient } from "@shared/schema";
import { FileText, Download, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

interface InvoiceCardProps {
  invoice: InvoiceWithClient;
  onDownload?: () => void;
}

export function InvoiceCard({ invoice, onDownload }: InvoiceCardProps) {
  const statusColors: Record<string, string> = {
    Paid: "bg-accent/20 text-accent",
    Pending: "bg-chart-3/20 text-chart-3",
    Overdue: "bg-destructive/20 text-destructive",
  };

  const amount = parseFloat(invoice.amount);

  return (
    <Card
      className="hover-elevate transition-all"
      data-testid={`card-invoice-${invoice.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-2 bg-primary/10 rounded-md">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate" data-testid={`text-invoice-number-${invoice.id}`}>
                {invoice.invoiceNumber}
              </h3>
              {invoice.client && (
                <p className="text-xs text-muted-foreground truncate">
                  {invoice.client.companyName}
                </p>
              )}
            </div>
          </div>
          <Badge
            variant="secondary"
            className={statusColors[invoice.status]}
            data-testid={`badge-invoice-status-${invoice.id}`}
          >
            {invoice.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Amount</span>
          <span className="text-lg font-mono font-semibold" data-testid={`text-invoice-amount-${invoice.id}`}>
            ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Due {format(parseISO(invoice.dueDate), "MMM d, yyyy")}</span>
          </div>
          {invoice.pdfUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownload}
              data-testid={`button-download-invoice-${invoice.id}`}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

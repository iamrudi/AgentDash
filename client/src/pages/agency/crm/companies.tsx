import { useQuery } from "@tanstack/react-query";
import type { Company } from "@shared/schema";
import { CreateCompanyDialog } from "@/components/crm/create-company-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building } from "lucide-react";

export default function CompaniesPage() {
  const { data: companies, isLoading, error } = useQuery<Company[]>({
    queryKey: ["/api/crm/companies"],
  });

  const getTypeVariant = (type: string) => {
    switch (type) {
      case "customer":
        return "default";
      case "lead":
        return "secondary";
      case "partner":
        return "outline";
      case "supplier":
        return "outline";
      default:
        return "secondary";
    }
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Companies
          </h2>
          <p className="text-muted-foreground">
            Manage your company relationships and prospects
          </p>
        </div>
        <CreateCompanyDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Companies</CardTitle>
          <CardDescription>
            A list of all companies in your CRM system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" data-testid="alert-error">
              <AlertDescription>
                Failed to load companies. Please try again later.
              </AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {!isLoading && !error && companies && (
            <>
              {companies.length === 0 ? (
                <div 
                  className="flex flex-col items-center justify-center py-12 text-center"
                  data-testid="empty-state"
                >
                  <Building className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No companies yet</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Get started by creating your first company
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                        <TableCell className="font-medium" data-testid={`text-company-name-${company.id}`}>
                          {company.name}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={getTypeVariant(company.type || "lead")}
                            data-testid={`badge-company-type-${company.id}`}
                          >
                            {(company.type || "lead").charAt(0).toUpperCase() + 
                             (company.type || "lead").slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-company-website-${company.id}`}>
                          {company.website ? (
                            <a
                              href={company.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {company.website}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-company-phone-${company.id}`}>
                          {company.phone || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell data-testid={`text-company-created-${company.id}`}>
                          {formatDate(company.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

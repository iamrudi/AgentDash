import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Search, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Client, ClientKnowledge, KnowledgeCategory } from "@shared/schema";

export default function ClientRecords() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("ALL");
  const [selectedCategoryId, setSelectedCategoryId] = useState("ALL");

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery<ClientKnowledge[]>({
    queryKey: ["/api/knowledge", { status: "active" }],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<KnowledgeCategory[]>({
    queryKey: ["/api/knowledge/categories"],
  });

  const isLoading = recordsLoading || clientsLoading || categoriesLoading;

  const getClientName = (clientId: string | null) => {
    if (!clientId) return "—";
    const client = clients.find(c => c.id === clientId);
    return client?.companyName || "Unknown";
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.displayName || category?.name || "Unknown";
  };

  const filteredRecords = records.filter(item => {
    const matchesSearch = !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.content && item.content.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesClient = selectedClientId === "ALL" || item.clientId === selectedClientId;
    const matchesCategory = selectedCategoryId === "ALL" || item.categoryId === selectedCategoryId;
    return matchesSearch && matchesClient && matchesCategory;
  });

  const activeCategories = categories.filter(c => c.isActive);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BookOpen className="h-6 w-6" />
            Client Records
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse all knowledge entries across clients
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-records"
            />
          </div>
        </div>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-client">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {activeCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.displayName || cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              {filteredRecords.length} {filteredRecords.length === 1 ? "Record" : "Records"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground" data-testid="text-empty-state">
              {records.length === 0
                ? "No client records yet. Add records from each client's detail page."
                : "No records match your filters."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords
                  .slice()
                  .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                  .map((record) => (
                  <TableRow key={record.id} data-testid={`row-record-${record.id}`}>
                    <TableCell className="font-medium" data-testid={`text-record-title-${record.id}`}>
                      {record.title}
                    </TableCell>
                    <TableCell data-testid={`text-record-client-${record.id}`}>
                      {getClientName(record.clientId)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" data-testid={`badge-category-${record.id}`}>
                        {getCategoryName(record.categoryId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.confidenceScore != null
                        ? `${Math.round(Number(record.confidenceScore) * 100)}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {record.createdAt ? format(new Date(record.createdAt), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.clientId && (
                        <Link href={`/agency/clients/${record.clientId}?tab=client-record`} data-testid={`link-view-record-${record.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-record-${record.id}`}>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </Link>
                      )}
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

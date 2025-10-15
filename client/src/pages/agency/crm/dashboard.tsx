import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Users, DollarSign, TrendingUp, Plus, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { CreateCompanyDialog } from "@/components/crm/create-company-dialog";
import { CreateContactDialog } from "@/components/crm/create-contact-dialog";
import { CreateDealDialog } from "@/components/crm/create-deal-dialog";

export default function CrmDashboard() {
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isCreateContactOpen, setIsCreateContactOpen] = useState(false);
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);

  // Fetch all CRM data
  const { data: companies = [] } = useQuery({
    queryKey: ["/api/crm/companies"],
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["/api/crm/contacts"],
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["/api/crm/deals"],
  });

  // Calculate metrics
  const totalCompanies = companies.length;
  const totalContacts = contacts.length;
  const totalDeals = deals.length;

  // Calculate total pipeline value
  const totalPipelineValue = deals.reduce((sum: number, deal: any) => sum + (deal.value || 0), 0);

  // Calculate deals by stage
  const dealsByStage = deals.reduce((acc: any, deal: any) => {
    acc[deal.stage] = (acc[deal.stage] || 0) + 1;
    return acc;
  }, {});

  // Get recent items (last 5)
  const recentCompanies = companies.slice(-5).reverse();
  const recentContacts = contacts.slice(-5).reverse();
  const recentDeals = deals.slice(-5).reverse();

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const stageColors: Record<string, string> = {
    lead: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
    qualified: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    proposal: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
    "closed-won": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    "closed-lost": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  };

  const stageLabels: Record<string, string> = {
    lead: "Lead",
    qualified: "Qualified",
    proposal: "Proposal",
    "closed-won": "Closed Won",
    "closed-lost": "Closed Lost",
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">CRM Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage your customer relationships and sales pipeline</p>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-metric-companies">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-companies">{totalCompanies}</div>
              <p className="text-xs text-muted-foreground mt-1">Active organizations</p>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-contacts">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-contacts">{totalContacts}</div>
              <p className="text-xs text-muted-foreground mt-1">People in your network</p>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-deals">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-deals">{totalDeals}</div>
              <p className="text-xs text-muted-foreground mt-1">Opportunities in pipeline</p>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-pipeline">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pipeline-value">{formatCurrency(totalPipelineValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total deal value</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card data-testid="card-quick-actions">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Create new records in your CRM</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => setIsCreateCompanyOpen(true)}
                data-testid="button-quick-create-company"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Company
              </Button>
              <Button 
                onClick={() => setIsCreateContactOpen(true)}
                data-testid="button-quick-create-contact"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Contact
              </Button>
              <Button 
                onClick={() => setIsCreateDealOpen(true)}
                data-testid="button-quick-create-deal"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Deal
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Overview */}
        <Card data-testid="card-pipeline-overview">
          <CardHeader>
            <CardTitle>Sales Pipeline</CardTitle>
            <CardDescription>Deals by stage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              {Object.entries(stageLabels).map(([stage, label]) => (
                <div key={stage} className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold" data-testid={`text-stage-${stage}`}>
                    {dealsByStage[stage] || 0}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Recent Companies */}
          <Card data-testid="card-recent-companies">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle>Recent Companies</CardTitle>
                <CardDescription>Latest additions</CardDescription>
              </div>
              <Link href="/agency/crm/companies">
                <Button variant="ghost" size="sm" data-testid="button-view-all-companies">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentCompanies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No companies yet</p>
              ) : (
                <div className="space-y-3">
                  {recentCompanies.map((company: any) => (
                    <Link key={company.id} href="/agency/crm/companies">
                      <div 
                        className="flex items-start gap-3 p-3 rounded-lg hover-elevate active-elevate-2 cursor-pointer"
                        data-testid={`item-recent-company-${company.id}`}
                      >
                        <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{company.name}</p>
                          {company.type && (
                            <p className="text-xs text-muted-foreground capitalize">{company.type}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Contacts */}
          <Card data-testid="card-recent-contacts">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle>Recent Contacts</CardTitle>
                <CardDescription>Latest additions</CardDescription>
              </div>
              <Link href="/agency/crm/contacts">
                <Button variant="ghost" size="sm" data-testid="button-view-all-contacts">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No contacts yet</p>
              ) : (
                <div className="space-y-3">
                  {recentContacts.map((contact: any) => (
                    <Link key={contact.id} href="/agency/crm/contacts">
                      <div 
                        className="flex items-start gap-3 p-3 rounded-lg hover-elevate active-elevate-2 cursor-pointer"
                        data-testid={`item-recent-contact-${contact.id}`}
                      >
                        <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {contact.firstName} {contact.lastName}
                          </p>
                          {contact.email && (
                            <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Deals */}
          <Card data-testid="card-recent-deals">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle>Recent Deals</CardTitle>
                <CardDescription>Latest opportunities</CardDescription>
              </div>
              <Link href="/agency/crm/deals">
                <Button variant="ghost" size="sm" data-testid="button-view-all-deals">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentDeals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No deals yet</p>
              ) : (
                <div className="space-y-3">
                  {recentDeals.map((deal: any) => (
                    <Link key={deal.id} href="/agency/crm/deals">
                      <div 
                        className="flex items-start gap-3 p-3 rounded-lg hover-elevate active-elevate-2 cursor-pointer"
                        data-testid={`item-recent-deal-${deal.id}`}
                      >
                        <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{deal.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={stageColors[deal.stage]} data-testid={`badge-deal-stage-${deal.id}`}>
                              {stageLabels[deal.stage as keyof typeof stageLabels]}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{formatCurrency(deal.value)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create Dialogs */}
        <CreateCompanyDialog 
          open={isCreateCompanyOpen} 
          onOpenChange={setIsCreateCompanyOpen}
        />
        <CreateContactDialog 
          open={isCreateContactOpen} 
          onOpenChange={setIsCreateContactOpen}
        />
        <CreateDealDialog 
          open={isCreateDealOpen} 
          onOpenChange={setIsCreateDealOpen}
        />
      </div>
    </div>
  );
}

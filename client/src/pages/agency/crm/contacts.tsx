import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Mail, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateContactDialog } from "@/components/crm/create-contact-dialog";
import type { Contact, Company } from "@shared/schema";

export default function ContactsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: contacts = [], isLoading } = useQuery<(Contact & { company?: Company | null })[]>({
    queryKey: ["/api/crm/contacts"],
  });

  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Contacts</h1>
          <p className="text-muted-foreground mt-1">Manage your contacts and relationships</p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          data-testid="button-create-contact"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Contact
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Contacts</CardTitle>
          <CardDescription>A list of all contacts in your CRM system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading contacts...</p>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" data-testid="empty-state">
              <Mail className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No contacts yet</h3>
              <p className="text-muted-foreground mb-4">Get started by creating your first contact</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Contact
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                      <TableCell className="font-medium" data-testid={`text-contact-name-${contact.id}`}>
                        {contact.firstName} {contact.lastName}
                      </TableCell>
                      <TableCell data-testid={`text-contact-email-${contact.id}`}>
                        <a 
                          href={`mailto:${contact.email}`}
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </a>
                      </TableCell>
                      <TableCell data-testid={`text-contact-phone-${contact.id}`}>
                        {contact.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-contact-company-${contact.id}`}>
                        {contact.company ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {contact.company.name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-contact-created-${contact.id}`}>
                        {new Date(contact.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateContactDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}

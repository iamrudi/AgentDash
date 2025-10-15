import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Company, Contact } from "@shared/schema";

const createDealFormSchema = z.object({
  name: z.string().min(1, "Deal name is required"),
  value: z.string().optional(), // Input as dollars, convert to cents
  stage: z.enum(["lead", "qualified", "proposal", "closed-won", "closed-lost"]).default("lead"),
  closeDate: z.string().optional(),
  contactId: z.string().uuid("Please select a contact"),
  companyId: z.string().uuid().optional().nullable(),
});

type FormData = z.infer<typeof createDealFormSchema>;

interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDealDialog({ open, onOpenChange }: CreateDealDialogProps) {
  const { toast } = useToast();

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/crm/contacts"],
    enabled: open,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/crm/companies"],
    enabled: open,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(createDealFormSchema),
    defaultValues: {
      name: "",
      value: "",
      stage: "lead",
      closeDate: "",
      contactId: "",
      companyId: null,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Convert value from dollars to cents
      const valueInCents = data.value ? Math.round(parseFloat(data.value) * 100) : undefined;
      
      const payload = {
        name: data.name,
        value: valueInCents,
        stage: data.stage,
        closeDate: data.closeDate || undefined,
        contactId: data.contactId,
        companyId: data.companyId || undefined,
      };
      
      return await apiRequest("POST", "/api/crm/deals", payload);
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Deal created successfully." 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create deal",
        variant: "destructive"
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-create-deal">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
          <DialogDescription>
            Add a new deal to your CRM pipeline. Enter the deal details below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Q4 Marketing Campaign" 
                      {...field} 
                      data-testid="input-deal-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Value (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        placeholder="5000.00" 
                        {...field} 
                        data-testid="input-deal-value"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="closeDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Close Date (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="date"
                        {...field} 
                        data-testid="input-deal-close-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-deal-stage">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="closed-won">Closed Won</SelectItem>
                      <SelectItem value="closed-lost">Closed Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-deal-contact">
                        <SelectValue placeholder="Select a contact" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.firstName} {contact.lastName} ({contact.email})
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
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company (Optional)</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "__NONE__" ? null : value)} 
                    value={field.value || "__NONE__"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-deal-company">
                        <SelectValue placeholder="Select a company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__NONE__">None</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
                data-testid="button-cancel-deal"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-save-deal"
              >
                {mutation.isPending ? "Creating..." : "Save Deal"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

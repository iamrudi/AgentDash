import { useEffect } from "react";
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
import type { Company } from "@shared/schema";

const editDealFormSchema = z.object({
  name: z.string().min(1, "Deal name is required"),
  value: z.string().optional(),
  stage: z.enum(["lead", "qualified", "proposal", "closed-won", "closed-lost"]),
  closeDate: z.string().optional(),
  contactId: z.string().uuid("Please select a contact"),
  companyId: z.string().uuid().optional().nullable(),
});

type FormData = z.infer<typeof editDealFormSchema>;

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
}

interface Deal {
  id: string;
  name: string;
  value?: number | null;
  stage: "lead" | "qualified" | "proposal" | "closed-won" | "closed-lost";
  closeDate?: string | null;
  contactId: string;
  companyId?: string | null;
}

interface EditDealDialogProps {
  deal: Deal | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDealDialog({ deal, isOpen, onOpenChange }: EditDealDialogProps) {
  const { toast } = useToast();

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/crm/contacts"],
    enabled: isOpen,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/crm/companies"],
    enabled: isOpen,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(editDealFormSchema),
    defaultValues: {
      name: "",
      value: "",
      stage: "lead",
      closeDate: "",
      contactId: "",
      companyId: null,
    },
  });

  // Reset form when deal changes
  useEffect(() => {
    if (deal) {
      form.reset({
        name: deal.name,
        value: deal.value ? (deal.value / 100).toString() : "",
        stage: deal.stage,
        closeDate: deal.closeDate || "",
        contactId: deal.contactId,
        companyId: deal.companyId || null,
      });
    }
  }, [deal, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!deal) throw new Error("No deal selected");
      
      // Convert dollars to cents and "__NONE__" to null
      const submitData = {
        ...data,
        value: data.value ? Math.round(parseFloat(data.value) * 100) : undefined,
        companyId: data.companyId === "__NONE__" ? null : data.companyId,
        closeDate: data.closeDate || undefined,
      };
      
      return await apiRequest("PATCH", `/api/crm/deals/${deal.id}`, submitData);
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Deal updated successfully." 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update deal",
        variant: "destructive"
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-edit-deal">
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
          <DialogDescription>
            Update deal information. Click save when you're done.
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
                      placeholder="Q4 2024 Contract" 
                      {...field} 
                      data-testid="input-edit-deal-name"
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
                    <FormLabel>Value (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        placeholder="5000.00" 
                        {...field} 
                        data-testid="input-edit-deal-value"
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
                        data-testid="input-edit-deal-close-date"
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
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-deal-stage">
                        <SelectValue placeholder="Select a stage" />
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
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-deal-contact">
                        <SelectValue placeholder="Select a contact" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.firstName} {contact.lastName}
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
                    onValueChange={field.onChange}
                    value={field.value || "__NONE__"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-deal-company">
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

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-deal"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-save-edit-deal"
              >
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

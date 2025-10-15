import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(["customer", "supplier", "partner", "lead"]).default("lead"),
});

type FormData = z.infer<typeof formSchema>;

export function CreateCompanyDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      website: "",
      phone: "",
      address: "",
      type: "lead",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("POST", "/api/crm/companies", data);
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Company created successfully." 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      setIsOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not create company. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-company">
          Create Company
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" data-testid="dialog-create-company">
        <DialogHeader>
          <DialogTitle>Create New Company</DialogTitle>
          <DialogDescription>
            Add a new company to your CRM. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Acme Inc." 
                      data-testid="input-company-name"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://acme.com" 
                      data-testid="input-company-website"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="+1 (555) 123-4567" 
                      data-testid="input-company-phone"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="123 Main St, City, State 12345" 
                      data-testid="input-company-address"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-company-type">
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lead" data-testid="option-lead">Lead</SelectItem>
                      <SelectItem value="customer" data-testid="option-customer">Customer</SelectItem>
                      <SelectItem value="partner" data-testid="option-partner">Partner</SelectItem>
                      <SelectItem value="supplier" data-testid="option-supplier">Supplier</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-save-company"
              >
                {mutation.isPending ? "Saving..." : "Save Company"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

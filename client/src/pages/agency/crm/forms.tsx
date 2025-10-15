import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Copy, Code, GripVertical, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const fieldTypes = ["text", "email", "phone", "textarea"] as const;

const fieldSchema = z.object({
  label: z.string().min(1, "Label is required"),
  fieldType: z.enum(fieldTypes),
  placeholder: z.string().optional(),
  required: z.boolean(),
  sortOrder: z.number(),
});

const formSchema = z.object({
  name: z.string().min(1, "Form name is required"),
  description: z.string().optional(),
  fields: z.array(fieldSchema).min(1, "At least one field is required"),
});

type FormData = z.infer<typeof formSchema>;

interface Form {
  id: string;
  publicId: string;
  name: string;
  description: string | null;
  agencyId: string;
  isDeleted: number;
  createdAt: string;
  updatedAt: string;
}

interface FormField {
  id: string;
  formId: string;
  label: string;
  fieldType: string;
  placeholder: string | null;
  required: number;
  sortOrder: number;
  metadata: any;
}

interface FormWithFields extends Form {
  fields: FormField[];
}

export default function FormsPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormWithFields | null>(null);
  const [embedFormId, setEmbedFormId] = useState<string | null>(null);

  const { data: forms, isLoading } = useQuery<Form[]>({
    queryKey: ["/api/crm/forms"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      fields: [
        { label: "Email", fieldType: "email", placeholder: "you@example.com", required: true, sortOrder: 0 },
      ],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("POST", "/api/crm/forms", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/forms"] });
      setIsCreateOpen(false);
      form.reset();
      toast({
        title: "Form created",
        description: "Your form has been created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create form",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      return await apiRequest("PATCH", `/api/crm/forms/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/forms"] });
      setEditingForm(null);
      form.reset();
      toast({
        title: "Form updated",
        description: "Your form has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update form",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/crm/forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/forms"] });
      toast({
        title: "Form deleted",
        description: "The form has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete form",
        variant: "destructive",
      });
    },
  });

  const addField = () => {
    const currentFields = form.getValues("fields");
    form.setValue("fields", [
      ...currentFields,
      {
        label: "",
        fieldType: "text",
        placeholder: "",
        required: false,
        sortOrder: currentFields.length,
      },
    ]);
  };

  const removeField = (index: number) => {
    const currentFields = form.getValues("fields");
    form.setValue(
      "fields",
      currentFields.filter((_, i) => i !== index)
    );
  };

  const handleSubmit = (data: FormData) => {
    if (editingForm) {
      updateMutation.mutate({ id: editingForm.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = async (formToEdit: Form) => {
    const response = await fetch(`/api/crm/forms/${formToEdit.id}`);
    const formWithFields: FormWithFields = await response.json();
    
    setEditingForm(formWithFields);
    form.reset({
      name: formWithFields.name,
      description: formWithFields.description || "",
      fields: formWithFields.fields
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((f) => ({
          label: f.label,
          fieldType: f.fieldType as any,
          placeholder: f.placeholder || "",
          required: f.required === 1,
          sortOrder: f.sortOrder,
        })),
    });
  };

  const getEmbedCode = (publicId: string) => {
    const embedUrl = `${window.location.origin}/forms/embed/${publicId}`;
    return `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0"></iframe>`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Embed code copied to clipboard",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Forms</h1>
          <p className="text-muted-foreground">Create and manage lead capture forms</p>
        </div>
        <Dialog open={isCreateOpen || !!editingForm} onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingForm(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-form">
              <Plus className="w-4 h-4 mr-2" />
              Create Form
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingForm ? "Edit Form" : "Create New Form"}</DialogTitle>
              <DialogDescription>
                {editingForm ? "Update your form details and fields" : "Create a new lead capture form"}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact Form" {...field} data-testid="input-form-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="A brief description of this form"
                          {...field}
                          data-testid="input-form-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FormLabel>Form Fields</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addField}
                      data-testid="button-add-field"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Field
                    </Button>
                  </div>

                  {form.watch("fields").map((_, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-start gap-3">
                        <GripVertical className="w-5 h-5 text-muted-foreground mt-8" />
                        <div className="flex-1 space-y-3">
                          <FormField
                            control={form.control}
                            name={`fields.${index}.label`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Label</FormLabel>
                                <FormControl>
                                  <Input placeholder="Field label" {...field} data-testid={`input-field-label-${index}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={form.control}
                              name={`fields.${index}.fieldType`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Type</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid={`select-field-type-${index}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="text">Text</SelectItem>
                                      <SelectItem value="email">Email</SelectItem>
                                      <SelectItem value="phone">Phone</SelectItem>
                                      <SelectItem value="textarea">Text Area</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`fields.${index}.placeholder`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Placeholder</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Optional" {...field} data-testid={`input-field-placeholder-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name={`fields.${index}.required`}
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={(e) => field.onChange(e.target.checked)}
                                    className="w-4 h-4"
                                    data-testid={`checkbox-field-required-${index}`}
                                  />
                                </FormControl>
                                <FormLabel className="!mt-0">Required field</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeField(index)}
                          disabled={form.watch("fields").length === 1}
                          data-testid={`button-remove-field-${index}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingForm(null);
                      form.reset();
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-form"
                  >
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Form"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {!forms || forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Code className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No forms yet</h3>
            <p className="text-muted-foreground mb-4">Create your first lead capture form to get started</p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-form">
              <Plus className="w-4 h-4 mr-2" />
              Create Form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((formItem) => (
            <Card key={formItem.id} className="hover-elevate" data-testid={`card-form-${formItem.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg" data-testid={`text-form-name-${formItem.id}`}>
                      {formItem.name}
                    </CardTitle>
                    {formItem.description && (
                      <CardDescription className="mt-1">{formItem.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant="secondary" className="ml-2">Active</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <div>Created {new Date(formItem.createdAt).toLocaleDateString()}</div>
                  <div className="font-mono text-xs mt-1 break-all">ID: {formItem.publicId}</div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(formItem)}
                  data-testid={`button-edit-form-${formItem.id}`}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmbedFormId(formItem.publicId)}
                  data-testid={`button-embed-form-${formItem.id}`}
                >
                  <Code className="w-4 h-4 mr-1" />
                  Embed
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this form?")) {
                      deleteMutation.mutate(formItem.id);
                    }
                  }}
                  data-testid={`button-delete-form-${formItem.id}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Embed Code Dialog */}
      <Dialog open={!!embedFormId} onOpenChange={() => setEmbedFormId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Embed Form</DialogTitle>
            <DialogDescription>
              Copy the code below and paste it into your website's HTML
            </DialogDescription>
          </DialogHeader>
          
          {embedFormId && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-md">
                <code className="text-sm break-all">{getEmbedCode(embedFormId)}</code>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => copyToClipboard(getEmbedCode(embedFormId))}
                  className="flex-1"
                  data-testid="button-copy-embed"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Embed Code
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/forms/embed/${embedFormId}`, "_blank")}
                  data-testid="button-preview-form"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
  const [apiFormId, setApiFormId] = useState<string | null>(null);

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
    try {
      const response = await fetch(`/api/crm/forms/${formToEdit.id}`, {
        credentials: 'include', // Ensure cookies are sent
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch form: ${response.statusText}`);
      }
      
      const formWithFields: FormWithFields = await response.json();
      
      // Validate that fields exist and is an array
      if (!formWithFields.fields || !Array.isArray(formWithFields.fields)) {
        throw new Error("Form fields are missing or invalid");
      }
      
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
      setIsCreateOpen(true);
    } catch (error: any) {
      console.error("Failed to load form for editing:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load form for editing",
        variant: "destructive",
      });
    }
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
              <CardFooter className="flex gap-2 flex-wrap">
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
                  variant="outline"
                  size="sm"
                  onClick={() => setApiFormId(formItem.publicId)}
                  data-testid={`button-api-form-${formItem.id}`}
                >
                  <Code className="w-4 h-4 mr-1" />
                  API
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

      {/* API Documentation Dialog */}
      <Dialog open={!!apiFormId} onOpenChange={() => setApiFormId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>API Documentation</DialogTitle>
            <DialogDescription>
              Use these endpoints to connect external systems like WordPress, Contact Form 7, or custom integrations
            </DialogDescription>
          </DialogHeader>
          
          {apiFormId && (
            <div className="space-y-6">
              {/* API Base Info */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Form ID</h3>
                <div className="bg-muted p-3 rounded-md font-mono text-sm break-all">
                  {apiFormId}
                </div>
              </div>

              {/* Endpoint 1: Get Form Metadata */}
              <div className="space-y-2">
                <h3 className="font-semibold">1. Get Form Metadata (Fields)</h3>
                <p className="text-sm text-muted-foreground">
                  Retrieve form fields and configuration. Useful to build dynamic forms.
                </p>
                <div className="bg-muted p-3 rounded-md space-y-2">
                  <div className="font-mono text-sm">
                    <span className="text-green-600">GET</span> {window.location.origin}/api/public/forms/{apiFormId}
                  </div>
                </div>
                
                <details className="border rounded-md p-3">
                  <summary className="cursor-pointer font-semibold text-sm">Response Example</summary>
                  <pre className="mt-2 text-xs overflow-x-auto">{`{
  "name": "Contact Form",
  "description": "Get in touch with us",
  "fields": [
    {
      "id": "1",
      "label": "Email",
      "fieldType": "email",
      "placeholder": "you@example.com",
      "required": 1,
      "sortOrder": 0
    },
    {
      "id": "2",
      "label": "Full Name",
      "fieldType": "text",
      "required": 1,
      "sortOrder": 1
    }
  ]
}`}</pre>
                </details>
              </div>

              {/* Endpoint 2: Submit Form */}
              <div className="space-y-2">
                <h3 className="font-semibold">2. Submit Form Data</h3>
                <p className="text-sm text-muted-foreground">
                  Submit form data. The server will auto-create a Contact and Deal in your CRM if email and name are provided.
                </p>
                <div className="bg-muted p-3 rounded-md space-y-2">
                  <div className="font-mono text-sm">
                    <span className="text-blue-600">POST</span> {window.location.origin}/api/public/forms/{apiFormId}/submit
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Content-Type: application/json
                  </div>
                </div>
                
                <details className="border rounded-md p-3">
                  <summary className="cursor-pointer font-semibold text-sm">Request Body Example</summary>
                  <pre className="mt-2 text-xs overflow-x-auto">{`{
  "formData": {
    "1": "john@example.com",
    "2": "John Doe",
    "3": "+1234567890"
  },
  "honeypot": ""
}`}</pre>
                  <p className="mt-2 text-xs text-muted-foreground">
                    • Use field IDs as keys in formData object<br />
                    • Always include honeypot field (leave empty for real users)<br />
                    • Required fields must be filled
                  </p>
                </details>

                <details className="border rounded-md p-3">
                  <summary className="cursor-pointer font-semibold text-sm">Response Example (Success)</summary>
                  <pre className="mt-2 text-xs overflow-x-auto">{`{
  "message": "Form submitted successfully",
  "submissionId": "123"
}`}</pre>
                </details>
              </div>

              {/* Code Examples */}
              <div className="space-y-3">
                <h3 className="font-semibold">Code Examples</h3>
                
                {/* cURL Example */}
                <details className="border rounded-md p-3">
                  <summary className="cursor-pointer font-semibold text-sm">cURL</summary>
                  <div className="mt-2 space-y-2">
                    <pre className="text-xs overflow-x-auto bg-muted p-3 rounded">{`curl -X POST '${window.location.origin}/api/public/forms/${apiFormId}/submit' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "formData": {
      "1": "john@example.com",
      "2": "John Doe"
    },
    "honeypot": ""
  }'`}</pre>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(`curl -X POST '${window.location.origin}/api/public/forms/${apiFormId}/submit' -H 'Content-Type: application/json' -d '{"formData":{"1":"john@example.com","2":"John Doe"},"honeypot":""}'`)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </details>

                {/* JavaScript Example */}
                <details className="border rounded-md p-3">
                  <summary className="cursor-pointer font-semibold text-sm">JavaScript / Fetch</summary>
                  <div className="mt-2 space-y-2">
                    <pre className="text-xs overflow-x-auto bg-muted p-3 rounded">{`// Submit form data
const response = await fetch('${window.location.origin}/api/public/forms/${apiFormId}/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    formData: {
      '1': document.getElementById('email').value,
      '2': document.getElementById('name').value,
    },
    honeypot: '', // Always empty for real users
  }),
});

const result = await response.json();
if (response.ok) {
  console.log('Form submitted successfully:', result);
} else {
  console.error('Submission failed:', result);
}`}</pre>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(`const response = await fetch('${window.location.origin}/api/public/forms/${apiFormId}/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    formData: { '1': email, '2': name },
    honeypot: '',
  }),
});`)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </details>

                {/* PHP/WordPress Example */}
                <details className="border rounded-md p-3">
                  <summary className="cursor-pointer font-semibold text-sm">PHP (WordPress)</summary>
                  <div className="mt-2 space-y-2">
                    <pre className="text-xs overflow-x-auto bg-muted p-3 rounded">{`<?php
// WordPress form submission handler
add_action('wpcf7_mail_sent', 'submit_to_agency_portal');

function submit_to_agency_portal($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    $posted_data = $submission->get_posted_data();
    
    // Map your WordPress form fields to API field IDs
    $data = array(
        'formData' => array(
            '1' => $posted_data['your-email'],    // Field ID 1: Email
            '2' => $posted_data['your-name'],     // Field ID 2: Name
            '3' => $posted_data['your-phone'],    // Field ID 3: Phone (if exists)
        ),
        'honeypot' => ''
    );
    
    $response = wp_remote_post('${window.location.origin}/api/public/forms/${apiFormId}/submit', array(
        'headers' => array('Content-Type' => 'application/json'),
        'body' => json_encode($data),
        'timeout' => 15,
    ));
    
    if (is_wp_error($response)) {
        error_log('Form submission failed: ' . $response->get_error_message());
    } else {
        error_log('Form submitted successfully');
    }
}
?>`}</pre>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(`<?php
add_action('wpcf7_mail_sent', 'submit_to_agency_portal');
function submit_to_agency_portal($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    $posted_data = $submission->get_posted_data();
    $data = array(
        'formData' => array('1' => $posted_data['your-email'], '2' => $posted_data['your-name']),
        'honeypot' => ''
    );
    wp_remote_post('${window.location.origin}/api/public/forms/${apiFormId}/submit', array(
        'headers' => array('Content-Type' => 'application/json'),
        'body' => json_encode($data)
    ));
}
?>`)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </details>
              </div>

              {/* Important Notes */}
              <div className="border-l-4 border-primary pl-4 space-y-2">
                <h3 className="font-semibold text-sm">Important Notes</h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Always leave the <code className="bg-muted px-1 rounded">honeypot</code> field empty for legitimate submissions</li>
                  <li>Use field IDs (not labels) as keys in the formData object</li>
                  <li>The API automatically creates a Contact and Deal when both email and name are provided</li>
                  <li>Duplicate email addresses are handled gracefully (no error thrown)</li>
                  <li>Form fields can be retrieved from the metadata endpoint to build dynamic forms</li>
                  <li>No authentication required for public endpoints</li>
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

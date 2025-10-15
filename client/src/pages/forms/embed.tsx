import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2 } from "lucide-react";

interface FormField {
  id: string;
  label: string;
  fieldType: string;
  placeholder: string | null;
  required: number;
  sortOrder: number;
}

interface FormMetadata {
  name: string;
  description: string | null;
  fields: FormField[];
}

export default function EmbedFormPage() {
  const [, params] = useRoute("/forms/embed/:publicId");
  const publicId = params?.publicId;

  const [formMetadata, setFormMetadata] = useState<FormMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Honeypot field ref (for bot detection)
  const honeypotRef = useRef<HTMLInputElement>(null);

  // Build dynamic schema from form fields
  const buildSchema = (fields: FormField[]) => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};
    
    fields.forEach(field => {
      let fieldSchema: z.ZodTypeAny = z.string();
      
      if (field.fieldType === "email") {
        fieldSchema = z.string().email("Invalid email address");
      }
      
      if (field.required) {
        if (field.fieldType === "email") {
          fieldSchema = z.string().min(1, `${field.label} is required`).email("Invalid email address");
        } else {
          fieldSchema = z.string().min(1, `${field.label} is required`);
        }
      } else {
        fieldSchema = z.string().optional();
      }
      
      schemaFields[field.id] = fieldSchema;
    });
    
    return z.object(schemaFields);
  };

  // Fetch form metadata
  useEffect(() => {
    if (!publicId) return;

    const fetchFormMetadata = async () => {
      try {
        const response = await fetch(`/api/public/forms/${publicId}`);
        
        if (!response.ok) {
          throw new Error("Form not found");
        }
        
        const data: FormMetadata = await response.json();
        setFormMetadata(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load form");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFormMetadata();
  }, [publicId]);

  const form = useForm({
    resolver: formMetadata ? zodResolver(buildSchema(formMetadata.fields)) : undefined,
    defaultValues: formMetadata?.fields.reduce((acc, field) => {
      acc[field.id] = "";
      return acc;
    }, {} as Record<string, string>) || {},
  });

  // Reset form when metadata changes
  useEffect(() => {
    if (formMetadata) {
      const defaultValues = formMetadata.fields.reduce((acc, field) => {
        acc[field.id] = "";
        return acc;
      }, {} as Record<string, string>);
      form.reset(defaultValues);
    }
  }, [formMetadata, form]);

  const onSubmit = async (data: Record<string, string>) => {
    if (!publicId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Get honeypot value (should be empty for real users)
      const honeypotValue = honeypotRef.current?.value || "";
      
      const response = await fetch(`/api/public/forms/${publicId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formData: data,
          honeypot: honeypotValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Submission failed");
      }

      setIsSuccess(true);
      form.reset();
    } catch (err: any) {
      setError(err.message || "Failed to submit form");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error && !formMetadata) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Form Not Found</CardTitle>
            <CardDescription>
              The form you're looking for doesn't exist or has been removed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!formMetadata) {
    return null;
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <CardTitle>Thank You!</CardTitle>
                <CardDescription>
                  Your submission has been received successfully.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                setIsSuccess(false);
                form.reset();
              }}
              className="w-full"
              data-testid="button-submit-another"
            >
              Submit Another Response
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-form-title">{formMetadata.name}</CardTitle>
            {formMetadata.description && (
              <CardDescription>{formMetadata.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Honeypot field (hidden from real users, visible to bots) */}
              <input
                ref={honeypotRef}
                type="text"
                name="honeypot"
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px" }}
                tabIndex={-1}
                autoComplete="off"
                data-testid="input-honeypot"
              />

              {formMetadata.fields
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>
                      {field.label}
                      {field.required === 1 && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    
                    {field.fieldType === "textarea" ? (
                      <Textarea
                        id={field.id}
                        placeholder={field.placeholder || ""}
                        {...form.register(field.id)}
                        data-testid={`input-${field.id}`}
                      />
                    ) : (
                      <Input
                        id={field.id}
                        type={
                          field.fieldType === "email"
                            ? "email"
                            : field.fieldType === "phone"
                            ? "tel"
                            : "text"
                        }
                        placeholder={field.placeholder || ""}
                        {...form.register(field.id)}
                        data-testid={`input-${field.id}`}
                      />
                    )}
                    
                    {form.formState.errors[field.id] && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors[field.id]?.message as string}
                      </p>
                    )}
                  </div>
                ))}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full"
                data-testid="button-submit-form"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Router, Response } from "express";
import { storage } from "../storage";

const router = Router();

// Get form metadata for embedding (publicId lookup)
router.get("/forms/:publicId", async (req, res: Response) => {
  try {
    const { publicId } = req.params;
    
    const form = await storage.getFormByPublicId(publicId);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }
    
    const fields = await storage.getFormFieldsByFormId(form.id);
    
    res.json({
      name: form.name,
      description: form.description,
      fields: fields.map(f => ({
        id: f.id,
        label: f.label,
        fieldType: f.fieldType,
        placeholder: f.placeholder,
        required: f.required,
        sortOrder: f.sortOrder,
      })),
    });
  } catch (error: any) {
    console.error("Form metadata fetch error:", error);
    res.status(500).json({ message: "Failed to fetch form metadata" });
  }
});

// Submit form (public endpoint with rate limiting and honeypot)
router.post("/forms/:publicId/submit", async (req, res: Response) => {
  try {
    const { publicId } = req.params;
    const { formData, honeypot } = req.body;
    
    // Honeypot validation (if honeypot field is filled, it's a bot)
    if (honeypot && honeypot.trim() !== "") {
      console.log("Honeypot triggered - potential bot submission blocked");
      // Return success to avoid revealing the honeypot to bots
      return res.status(200).json({ message: "Form submitted successfully" });
    }
    
    // Get form
    const form = await storage.getFormByPublicId(publicId);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }
    
    // Get form fields for validation
    const fields = await storage.getFormFieldsByFormId(form.id);
    
    // Validate required fields
    for (const field of fields) {
      if (field.required && (!formData[field.id] || formData[field.id].trim() === "")) {
        return res.status(400).json({ 
          message: `Field "${field.label}" is required`,
          field: field.id,
        });
      }
    }
    
    // Create form submission
    const submission = await storage.createFormSubmission({
      formId: form.id,
      agencyId: form.agencyId,
      submission: formData,
    });
    
    // Auto-create Contact and Deal from submission
    // Extract common fields (email, name, phone) based on field types and labels
    let email: string | null = null;
    let firstName: string | null = null;
    let lastName: string | null = null;
    let phone: string | null = null;
    
    for (const field of fields) {
      const value = formData[field.id];
      if (!value || typeof value !== 'string' || value.trim() === '') continue;
      
      const trimmedValue = value.trim();
      const labelLower = field.label.toLowerCase();
      
      // Email field type takes precedence
      if (field.fieldType === "email" && !email) {
        email = trimmedValue;
      }
      // Phone field type takes precedence
      else if (field.fieldType === "phone" && !phone) {
        phone = trimmedValue;
      }
      // Parse name fields by label patterns
      else if ((labelLower.includes("first name") || labelLower === "name" || labelLower === "first") && !firstName) {
        firstName = trimmedValue;
      }
      else if ((labelLower.includes("last name") || labelLower === "last" || labelLower === "surname") && !lastName) {
        lastName = trimmedValue;
      }
      // If label is just "name" or "full name", try to split it
      else if ((labelLower === "full name" || labelLower === "your name") && !firstName) {
        const nameParts = trimmedValue.split(' ');
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else {
          firstName = trimmedValue;
        }
      }
    }
    
    // Only create contact if we have BOTH valid email AND explicit name
    // Never fabricate or derive placeholder data
    const hasValidEmail = email && email.includes('@') && email.includes('.') && !email.includes('placeholder.com');
    const hasExplicitName = firstName && firstName.trim().length > 0 && firstName !== "Unknown";
    
    // Require BOTH email and name for contact creation
    if (hasValidEmail && hasExplicitName) {
      try {
        // TypeScript knows firstName and email are not null here because of hasExplicitName and hasValidEmail checks
        const contact = await storage.createContact({
          agencyId: form.agencyId,
          firstName: firstName!.trim(),
          lastName: (lastName && lastName.trim().length > 0) ? lastName.trim() : firstName!.trim(),
          email: email!.trim(),
          phone: phone ? phone.trim() : null,
          companyId: null,
          clientId: null,
        });
        
        // Create deal associated with the contact
        await storage.createDeal({
          agencyId: form.agencyId,
          contactId: contact.id,
          companyId: null,
          name: `Lead from ${form.name}`,
          value: 0, // Default to 0, agency can update later
          stage: "lead",
          closeDate: null,
        });
        
        console.log(`[Form Submission] Created contact (${contact.email}) and deal from form: ${form.name}`);
      } catch (error: any) {
        console.error("[Form Submission] Failed to auto-create contact/deal:", error);
        // Check if it's a duplicate email error
        if (error.message && (error.message.includes('unique') || error.message.includes('duplicate'))) {
          console.log('[Form Submission] Contact with this email already exists - skipping creation');
        }
        // Don't fail the submission if contact/deal creation fails
      }
    } else {
      // Log the specific reason for skipping
      if (!hasValidEmail && !hasExplicitName) {
        console.log('[Form Submission] Skipping contact/deal creation - no valid email or name provided');
      } else if (!hasValidEmail) {
        console.log('[Form Submission] Skipping contact/deal creation - no valid email provided');
      } else if (!hasExplicitName) {
        console.log('[Form Submission] Skipping contact/deal creation - no explicit name provided');
      }
    }
    
    res.status(201).json({ 
      message: "Form submitted successfully",
      submissionId: submission.id,
    });
  } catch (error: any) {
    console.error("Form submission error:", error);
    res.status(500).json({ message: "Form submission failed" });
  }
});

export default router;

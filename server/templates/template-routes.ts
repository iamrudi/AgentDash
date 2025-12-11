import { Router, Request, Response } from "express";
import { z } from "zod";
import { templateService } from "./template-service";

export const templateRouter = Router();

const templateVariableSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'date', 'boolean', 'select', 'array']),
  required: z.boolean(),
  description: z.string().optional(),
  default: z.unknown().optional(),
  options: z.array(z.string()).optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
  }).optional(),
});

const createTemplateSchema = z.object({
  type: z.enum(['project', 'task_list', 'workflow', 'prompt']),
  name: z.string().min(1),
  description: z.string().optional(),
  isSystem: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  content: z.record(z.unknown()),
  variables: z.array(templateVariableSchema).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  content: z.record(z.unknown()).optional(),
  variables: z.array(templateVariableSchema).optional(),
  changelog: z.string().optional(),
});

const instantiateSchema = z.object({
  variableValues: z.record(z.unknown()),
  clientId: z.string().uuid().optional(),
  workflowExecutionId: z.string().uuid().optional(),
});

templateRouter.get("/", async (req: Request, res: Response) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const { type } = req.query;
    const templates = await templateService.getTemplatesForAgency(
      agencyId,
      type as string | undefined
    );

    res.json(templates);
  } catch (error: any) {
    console.error("[TEMPLATES] Error fetching templates:", error);
    res.status(500).json({ error: error.message });
  }
});

templateRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const template = await templateService.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    if (template.agencyId && template.agencyId !== agencyId && !template.isSystem && !template.isPublic) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(template);
  } catch (error: any) {
    console.error("[TEMPLATES] Error fetching template:", error);
    res.status(500).json({ error: error.message });
  }
});

templateRouter.post("/", async (req: Request, res: Response) => {
  try {
    const agencyId = (req as any).agencyId;
    const userId = (req as any).userId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const validation = createTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
    }

    const template = await templateService.createTemplate(
      validation.data,
      agencyId,
      userId
    );

    res.status(201).json(template);
  } catch (error: any) {
    console.error("[TEMPLATES] Error creating template:", error);
    res.status(500).json({ error: error.message });
  }
});

templateRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const agencyId = (req as any).agencyId;
    const userId = (req as any).userId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const validation = updateTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
    }

    const { changelog, ...updates } = validation.data;

    const template = await templateService.updateTemplate(
      req.params.id,
      updates,
      agencyId,
      userId,
      changelog
    );

    res.json(template);
  } catch (error: any) {
    console.error("[TEMPLATES] Error updating template:", error);
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

templateRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const deleted = await templateService.deleteTemplate(req.params.id, agencyId);
    if (!deleted) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({ success: true, message: "Template deleted" });
  } catch (error: any) {
    console.error("[TEMPLATES] Error deleting template:", error);
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

templateRouter.get("/:id/versions", async (req: Request, res: Response) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const template = await templateService.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    if (template.agencyId && template.agencyId !== agencyId && !template.isSystem) {
      return res.status(403).json({ error: "Access denied" });
    }

    const versions = await templateService.getTemplateVersions(req.params.id);
    res.json(versions);
  } catch (error: any) {
    console.error("[TEMPLATES] Error fetching template versions:", error);
    res.status(500).json({ error: error.message });
  }
});

templateRouter.get("/:id/versions/:versionId", async (req: Request, res: Response) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const version = await templateService.getTemplateVersion(req.params.versionId);
    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }

    res.json(version);
  } catch (error: any) {
    console.error("[TEMPLATES] Error fetching template version:", error);
    res.status(500).json({ error: error.message });
  }
});

templateRouter.post("/:id/instantiate", async (req: Request, res: Response) => {
  try {
    const agencyId = (req as any).agencyId;
    const userId = (req as any).userId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const validation = instantiateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
    }

    const template = await templateService.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    if (template.type === 'project') {
      if (!validation.data.clientId) {
        return res.status(400).json({ error: "clientId required for project templates" });
      }

      const result = await templateService.instantiateProjectTemplate(
        req.params.id,
        validation.data.variableValues,
        validation.data.clientId,
        agencyId,
        userId,
        validation.data.workflowExecutionId
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(201).json(result);
    } else if (template.type === 'prompt') {
      const result = await templateService.instantiatePromptTemplate(
        req.params.id,
        validation.data.variableValues,
        agencyId
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result);
    } else {
      return res.status(400).json({
        error: `Instantiation not supported for template type: ${template.type}`,
      });
    }
  } catch (error: any) {
    console.error("[TEMPLATES] Error instantiating template:", error);
    res.status(500).json({ error: error.message });
  }
});

templateRouter.post("/:id/clone", async (req: Request, res: Response) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const { name } = req.body;

    const cloned = await templateService.cloneTemplate(
      req.params.id,
      agencyId,
      name
    );

    res.status(201).json(cloned);
  } catch (error: any) {
    console.error("[TEMPLATES] Error cloning template:", error);
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

import { db } from "../db";
import {
  templates,
  templateVersions,
  templateInstantiations,
  projects,
  taskLists,
  tasks,
  clients,
  Template,
  InsertTemplate,
  TemplateVersion,
  InsertTemplateVersion,
  TemplateInstantiation,
  TemplateVariable,
  ProjectTemplateContent,
  TaskListTemplateContent,
  TaskTemplateContent,
  PromptTemplateContent,
} from "@shared/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";

interface VariableValues {
  [key: string]: unknown;
}

interface InstantiationResult {
  success: boolean;
  outputType: string;
  outputId?: string;
  instantiationId?: string;
  error?: string;
  createdEntities?: {
    projects?: string[];
    taskLists?: string[];
    tasks?: string[];
  };
}

class TemplateService {
  substituteVariables(content: string, variables: VariableValues): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (varName in variables) {
        return String(variables[varName]);
      }
      return match;
    });
  }

  substituteInObject<T>(obj: T, variables: VariableValues): T {
    if (typeof obj === 'string') {
      return this.substituteVariables(obj, variables) as T;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.substituteInObject(item, variables)) as T;
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteInObject(value, variables);
      }
      return result as T;
    }
    return obj;
  }

  validateVariables(
    templateVariables: TemplateVariable[],
    providedValues: VariableValues
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const variable of templateVariables) {
      const value = providedValues[variable.name];

      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required variable '${variable.name}' is missing`);
        continue;
      }

      if (value === undefined || value === null) continue;

      switch (variable.type) {
        case 'number':
          if (typeof value !== 'number' && isNaN(Number(value))) {
            errors.push(`Variable '${variable.name}' must be a number`);
          }
          if (variable.validation?.min !== undefined && Number(value) < variable.validation.min) {
            errors.push(`Variable '${variable.name}' must be at least ${variable.validation.min}`);
          }
          if (variable.validation?.max !== undefined && Number(value) > variable.validation.max) {
            errors.push(`Variable '${variable.name}' must be at most ${variable.validation.max}`);
          }
          break;

        case 'string':
          if (typeof value !== 'string') {
            errors.push(`Variable '${variable.name}' must be a string`);
          } else {
            if (variable.validation?.minLength && value.length < variable.validation.minLength) {
              errors.push(`Variable '${variable.name}' must be at least ${variable.validation.minLength} characters`);
            }
            if (variable.validation?.maxLength && value.length > variable.validation.maxLength) {
              errors.push(`Variable '${variable.name}' must be at most ${variable.validation.maxLength} characters`);
            }
            if (variable.validation?.pattern && !new RegExp(variable.validation.pattern).test(value)) {
              errors.push(`Variable '${variable.name}' must match pattern ${variable.validation.pattern}`);
            }
          }
          break;

        case 'date':
          if (isNaN(Date.parse(String(value)))) {
            errors.push(`Variable '${variable.name}' must be a valid date`);
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
            errors.push(`Variable '${variable.name}' must be a boolean`);
          }
          break;

        case 'select':
          if (variable.options && !variable.options.includes(String(value))) {
            errors.push(`Variable '${variable.name}' must be one of: ${variable.options.join(', ')}`);
          }
          break;

        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`Variable '${variable.name}' must be an array`);
          }
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async createTemplate(input: InsertTemplate, agencyId: string, userId?: string): Promise<Template> {
    const [template] = await db
      .insert(templates)
      .values({
        ...input,
        agencyId: input.isSystem ? null : agencyId,
      })
      .returning();

    const [version] = await db
      .insert(templateVersions)
      .values({
        templateId: template.id,
        version: 1,
        content: input.content,
        variables: input.variables || [],
        changelog: 'Initial version',
        createdBy: userId,
      })
      .returning();

    await db
      .update(templates)
      .set({ currentVersionId: version.id })
      .where(eq(templates.id, template.id));

    return { ...template, currentVersionId: version.id };
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<InsertTemplate>,
    agencyId: string,
    userId?: string,
    changelog?: string
  ): Promise<Template> {
    const existing = await this.getTemplateById(templateId);
    if (!existing) throw new Error('Template not found');

    if (existing.agencyId && existing.agencyId !== agencyId && !existing.isSystem) {
      throw new Error('Access denied');
    }

    const shouldVersion = updates.content !== undefined || updates.variables !== undefined;

    if (shouldVersion) {
      const latestVersion = await db
        .select()
        .from(templateVersions)
        .where(eq(templateVersions.templateId, templateId))
        .orderBy(desc(templateVersions.version))
        .limit(1);

      const nextVersion = (latestVersion[0]?.version || 0) + 1;

      const [newVersion] = await db
        .insert(templateVersions)
        .values({
          templateId,
          version: nextVersion,
          content: updates.content || existing.content,
          variables: updates.variables || existing.variables,
          changelog: changelog || `Version ${nextVersion}`,
          createdBy: userId,
        })
        .returning();

      updates.currentVersionId = newVersion.id;
    }

    const [updated] = await db
      .update(templates)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(templates.id, templateId))
      .returning();

    return updated;
  }

  async getTemplateById(templateId: string): Promise<Template | null> {
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);

    return template || null;
  }

  async getTemplatesForAgency(
    agencyId: string,
    type?: string
  ): Promise<Template[]> {
    const conditions = [
      or(
        eq(templates.agencyId, agencyId),
        eq(templates.isSystem, true),
        eq(templates.isPublic, true)
      ),
    ];

    if (type) {
      conditions.push(eq(templates.type, type));
    }

    return db
      .select()
      .from(templates)
      .where(and(...conditions))
      .orderBy(desc(templates.updatedAt));
  }

  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    return db
      .select()
      .from(templateVersions)
      .where(eq(templateVersions.templateId, templateId))
      .orderBy(desc(templateVersions.version));
  }

  async getTemplateVersion(versionId: string): Promise<TemplateVersion | null> {
    const [version] = await db
      .select()
      .from(templateVersions)
      .where(eq(templateVersions.id, versionId))
      .limit(1);

    return version || null;
  }

  async deleteTemplate(templateId: string, agencyId: string): Promise<boolean> {
    const template = await this.getTemplateById(templateId);
    if (!template) return false;

    if (template.agencyId && template.agencyId !== agencyId) {
      throw new Error('Access denied');
    }

    await db.delete(templates).where(eq(templates.id, templateId));
    return true;
  }

  async instantiateProjectTemplate(
    templateId: string,
    variableValues: VariableValues,
    clientId: string,
    agencyId: string,
    userId?: string,
    workflowExecutionId?: string
  ): Promise<InstantiationResult> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      return { success: false, outputType: 'project', error: 'Template not found' };
    }

    if (template.type !== 'project') {
      return { success: false, outputType: 'project', error: 'Template is not a project template' };
    }

    const templateVariables = (template.variables || []) as TemplateVariable[];
    const validation = this.validateVariables(templateVariables, variableValues);
    if (!validation.valid) {
      return { success: false, outputType: 'project', error: validation.errors.join('; ') };
    }

    const client = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.agencyId, agencyId)))
      .limit(1);

    if (client.length === 0) {
      return { success: false, outputType: 'project', error: 'Client not found or access denied' };
    }

    const content = this.substituteInObject(
      template.content as ProjectTemplateContent,
      variableValues
    );

    const createdEntities: InstantiationResult['createdEntities'] = {
      projects: [],
      taskLists: [],
      tasks: [],
    };

    try {
      await db.transaction(async (tx) => {
        const [project] = await tx
          .insert(projects)
          .values({
            name: content.name,
            description: content.description || '',
            status: 'Active',
            clientId,
            workflowExecutionId,
          })
          .returning();

        createdEntities.projects!.push(project.id);

        for (const listTemplate of content.taskLists || []) {
          const [taskList] = await tx
            .insert(taskLists)
            .values({
              name: listTemplate.name,
              projectId: project.id,
              agencyId,
              workflowExecutionId,
            })
            .returning();

          createdEntities.taskLists!.push(taskList.id);

          for (const taskTemplate of listTemplate.tasks || []) {
            const createdTask = await this.createTaskFromTemplate(
              tx,
              taskTemplate,
              taskList.id,
              project.id,
              null,
              workflowExecutionId
            );
            createdEntities.tasks!.push(createdTask.id);

            for (const subtaskTemplate of taskTemplate.subtasks || []) {
              const createdSubtask = await this.createTaskFromTemplate(
                tx,
                subtaskTemplate,
                taskList.id,
                project.id,
                createdTask.id,
                workflowExecutionId
              );
              createdEntities.tasks!.push(createdSubtask.id);
            }
          }
        }

        const [instantiation] = await tx
          .insert(templateInstantiations)
          .values({
            templateId,
            templateVersionId: template.currentVersionId,
            agencyId,
            createdBy: userId,
            variableValues,
            outputType: 'project',
            outputId: project.id,
            workflowExecutionId,
          })
          .returning();

        await tx
          .update(templates)
          .set({ usageCount: sql`${templates.usageCount} + 1` })
          .where(eq(templates.id, templateId));

        return {
          success: true,
          outputType: 'project',
          outputId: project.id,
          instantiationId: instantiation.id,
          createdEntities,
        };
      });

      return {
        success: true,
        outputType: 'project',
        outputId: createdEntities.projects![0],
        createdEntities,
      };
    } catch (error: any) {
      console.error('[TEMPLATES] Error instantiating project template:', error);
      return { success: false, outputType: 'project', error: error.message };
    }
  }

  private async createTaskFromTemplate(
    tx: any,
    taskTemplate: TaskTemplateContent,
    listId: string,
    projectId: string,
    parentId: string | null,
    workflowExecutionId?: string
  ) {
    const dueDate = taskTemplate.dueDaysFromStart
      ? new Date(Date.now() + taskTemplate.dueDaysFromStart * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]
      : undefined;

    const [task] = await tx
      .insert(tasks)
      .values({
        description: taskTemplate.description,
        status: taskTemplate.status || 'To Do',
        priority: taskTemplate.priority || 'Medium',
        dueDate,
        timeEstimate: taskTemplate.timeEstimate || '0',
        listId,
        projectId,
        parentId,
        workflowExecutionId,
      })
      .returning();

    return task;
  }

  async instantiatePromptTemplate(
    templateId: string,
    variableValues: VariableValues,
    agencyId: string
  ): Promise<{ success: boolean; prompt?: string; error?: string }> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    if (template.type !== 'prompt') {
      return { success: false, error: 'Template is not a prompt template' };
    }

    const templateVariables = (template.variables || []) as TemplateVariable[];
    const validation = this.validateVariables(templateVariables, variableValues);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('; ') };
    }

    const content = template.content as PromptTemplateContent;
    const substitutedPrompt = this.substituteVariables(content.prompt, variableValues);

    return { success: true, prompt: substitutedPrompt };
  }

  async cloneTemplate(
    templateId: string,
    targetAgencyId: string,
    newName?: string
  ): Promise<Template> {
    const source = await this.getTemplateById(templateId);
    if (!source) throw new Error('Template not found');

    if (!source.isSystem && !source.isPublic && source.agencyId !== targetAgencyId) {
      throw new Error('Access denied');
    }

    const [cloned] = await db
      .insert(templates)
      .values({
        agencyId: targetAgencyId,
        type: source.type,
        name: newName || `${source.name} (Copy)`,
        description: source.description,
        isSystem: false,
        isPublic: false,
        category: source.category,
        tags: source.tags,
        content: source.content,
        variables: source.variables,
      })
      .returning();

    const [version] = await db
      .insert(templateVersions)
      .values({
        templateId: cloned.id,
        version: 1,
        content: source.content,
        variables: source.variables,
        changelog: `Cloned from ${source.name}`,
      })
      .returning();

    await db
      .update(templates)
      .set({ currentVersionId: version.id })
      .where(eq(templates.id, cloned.id));

    return { ...cloned, currentVersionId: version.id };
  }
}

export const templateService = new TemplateService();

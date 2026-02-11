import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import { db } from "../../db";
import { projects, taskLists, tasks } from "@shared/schema";
import { InvoiceGeneratorService } from "../../services/invoiceGenerator";
import {
  InitiativeResponseRequestSchema,
  type InitiativeResponseRequest,
} from "../../domain/initiatives/schemas";

type ExistingInitiative = NonNullable<Awaited<ReturnType<IStorage["getInitiativeById"]>>>;

export interface InitiativeResponseResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class InitiativeResponseService {
  constructor(private storage: IStorage) {}

  async respondToInitiative(
    ctx: RequestContext,
    initiativeId: string,
    payload: InitiativeResponseRequest
  ): Promise<InitiativeResponseResult<unknown>> {
    const parsed = InitiativeResponseRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid payload",
        errors: parsed.error.errors,
      };
    }

    const { response, feedback } = parsed.data;
    const existingInitiative = await this.storage.getInitiativeById(initiativeId);
    if (!existingInitiative) {
      return { ok: false, status: 404, error: "Initiative not found" };
    }

    if (response === "approved" && existingInitiative.billingType === "hours" && existingInitiative.estimatedHours) {
      const hoursNeeded = parseFloat(existingInitiative.estimatedHours);
      const hoursInfo = await this.storage.checkRetainerHours(existingInitiative.clientId);
      if (hoursInfo.available < hoursNeeded) {
        return {
          ok: false,
          status: 400,
          error: `Insufficient retainer hours. You have ${hoursInfo.available} hours available but need ${hoursNeeded} hours. Please contact your account manager to purchase additional hours.`,
        };
      }
      await this.storage.deductRetainerHours(existingInitiative.clientId, hoursNeeded);
    }

    const initiative = await this.storage.updateInitiativeClientResponse(initiativeId, response, feedback);
    this.captureOutcomeFeedback(initiativeId, existingInitiative, response, feedback);

    let projectId: string | undefined = existingInitiative.projectId || undefined;
    let invoiceId: string | undefined = existingInitiative.invoiceId || undefined;

    if (response === "approved") {
      if (!projectId) {
        const client = await this.storage.getClientById(existingInitiative.clientId);
        if (!client) {
          return {
            ok: false,
            status: 400,
            error: "Cannot create project: client not found for this initiative",
          };
        }

        try {
          let createdProjectId: string | undefined;

          await db.transaction(async (tx) => {
            const [project] = await tx.insert(projects).values({
              name: existingInitiative.title,
              description: existingInitiative.observation,
              status: "Active",
              clientId: existingInitiative.clientId,
            }).returning();

            if (!project?.id) {
              throw new Error("Failed to create project: no ID returned");
            }

            createdProjectId = project.id;

            const [taskList] = await tx.insert(taskLists).values({
              name: existingInitiative.title,
              projectId: project.id,
              agencyId: client.agencyId,
            }).returning();

            if (
              existingInitiative.actionTasks &&
              Array.isArray(existingInitiative.actionTasks) &&
              existingInitiative.actionTasks.length > 0
            ) {
              const taskValues = existingInitiative.actionTasks.map((taskDescription) => ({
                description: taskDescription,
                status: "To Do" as const,
                priority: "Medium" as const,
                projectId: project.id,
                listId: taskList.id,
                startDate: null,
                dueDate: null,
                parentId: null,
                initiativeId: existingInitiative.id,
              }));
              await tx.insert(tasks).values(taskValues);
            }
          });

          if (!createdProjectId) {
            throw new Error("Transaction completed but project ID was not set");
          }

          projectId = createdProjectId;
          await this.storage.updateInitiative(initiativeId, { projectId });
        } catch (error: any) {
          return {
            ok: false,
            status: 500,
            error: `Initiative approved, but failed to create project: ${error.message}`,
          };
        }
      }

      if (!invoiceId && (existingInitiative.billingType === "fixed" || (existingInitiative.cost && parseFloat(existingInitiative.cost) > 0))) {
        try {
          const invoiceGenerator = new InvoiceGeneratorService(this.storage);
          invoiceId = await invoiceGenerator.generateInvoiceFromInitiative(initiativeId);
          await this.storage.updateInitiative(initiativeId, { invoiceId });
        } catch (invoiceError) {
          console.error("Failed to generate invoice from initiative:", invoiceError);
        }
      }
    }

    await this.notifyAdminsOfClientResponse(ctx, existingInitiative.title, response);

    return {
      ok: true,
      status: 200,
      data: {
        ...initiative,
        projectId,
        invoiceId,
        message: response === "approved"
          ? `Initiative approved successfully${projectId ? ", project and tasks created" : ""}${invoiceId ? ", invoice generated" : ""}`
          : undefined,
      },
    };
  }

  private async notifyAdminsOfClientResponse(
    ctx: RequestContext,
    initiativeTitle: string,
    response: "approved" | "rejected" | "discussing"
  ): Promise<void> {
    try {
      if (ctx.role !== "Client") {
        return;
      }
      const profile = await this.storage.getProfileByUserId(ctx.userId);
      if (profile?.role !== "Client") {
        return;
      }
      const client = await this.storage.getClientByProfileId(profile.id);
      const adminUsers = client?.agencyId
        ? await this.storage.getAllUsersWithProfiles(client.agencyId)
        : [];
      const admins = adminUsers.filter((u) => u.profile?.role === "Admin");
      const responseText = response === "approved" ? "approved" : response === "rejected" ? "rejected" : "wants to discuss";
      for (const admin of admins) {
        await this.storage.createNotification({
          userId: admin.id,
          type: "initiative_response",
          title: "Initiative Response",
          message: `${profile.fullName} from ${client?.companyName} ${responseText} "${initiativeTitle}"`,
          link: `/agency/recommendations`,
          isRead: "false",
          isArchived: "false",
        });
      }
    } catch (notificationError) {
      console.error("Failed to create initiative response notification:", notificationError);
    }
  }

  private captureOutcomeFeedback(
    initiativeId: string,
    existingInitiative: ExistingInitiative,
    response: "approved" | "rejected" | "discussing",
    feedback: string | undefined
  ) {
    import("../../intelligence/outcome-feedback-service").then(({ outcomeFeedbackService }) => {
      this.storage.getClientById(existingInitiative.clientId).then((client) => {
        if (!client) {
          return;
        }
        outcomeFeedbackService.captureOutcome({
          agencyId: client.agencyId,
          clientId: existingInitiative.clientId,
          recommendationId: initiativeId,
          recommendationType: existingInitiative.recommendationType || "strategic",
          wasAccepted: response === "approved",
          predictedImpact: existingInitiative.impact ? Number(existingInitiative.impact) : undefined,
          notes: feedback || undefined,
        }).catch((err: Error) => {
          console.error("[FEEDBACK_LOOP] Failed to capture outcome:", err);
        });
      }).catch((err: Error) => {
        console.error("[FEEDBACK_LOOP] Failed to get client:", err);
      });
    }).catch((err: Error) => {
      console.error("[FEEDBACK_LOOP] Failed to import feedback service:", err);
    });
  }
}

import type { IStorage } from "../storage";
import type { WorkflowStep } from "@shared/schema";

const DEFAULT_WORKFLOW_NAME = "Client Record Recommendations";
const DEFAULT_SIGNAL_SOURCE = "internal";
const DEFAULT_SIGNAL_TYPE = "client_record_updated";

export async function ensureClientRecordRecommendationWorkflow(
  storage: IStorage,
  agencyId: string
): Promise<{ workflowId: string; routeId: string } | null> {
  const existingRoutes = await storage.getMatchingSignalRoutes(
    agencyId,
    DEFAULT_SIGNAL_SOURCE,
    DEFAULT_SIGNAL_TYPE
  );

  if (existingRoutes.length > 0) {
    return null;
  }

  const steps: WorkflowStep[] = [
    {
      id: "signal_client_record_updated",
      name: "Client Record Updated",
      type: "signal",
      config: {
        signal: { type: DEFAULT_SIGNAL_TYPE, filter: {} },
      },
      next: "generate_recommendations",
    },
    {
      id: "generate_recommendations",
      name: "Generate Recommendations",
      type: "action",
      config: {
        action: {
          type: "generate_recommendations",
          config: {},
        },
      },
      next: null,
    },
  ];

  const workflow = await storage.createWorkflow({
    agencyId,
    name: DEFAULT_WORKFLOW_NAME,
    description: "Default workflow for generating recommendations from client record updates.",
    status: "active",
    triggerType: "signal",
    triggerConfig: {
      signalType: DEFAULT_SIGNAL_TYPE,
    },
    steps,
    retryPolicy: { maxRetries: 1, backoffMs: 1000 },
  } as any);

  const route = await storage.createSignalRoute({
    agencyId,
    workflowId: workflow.id,
    name: "Client Record Updated",
    description: "Route client_record_updated signals to recommendation workflow.",
    source: DEFAULT_SIGNAL_SOURCE,
    type: DEFAULT_SIGNAL_TYPE,
    enabled: true,
    priority: 100,
  } as any);

  return { workflowId: workflow.id, routeId: route.id };
}

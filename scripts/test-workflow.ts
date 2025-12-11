import { db } from "../server/db";
import { storage } from "../server/storage";
import { createWorkflowEngine } from "../server/workflow/engine";
import { workflows, workflowExecutions, workflowEvents } from "@shared/schema";
import { eq } from "drizzle-orm";

async function runWorkflowTest() {
  console.log("=== Workflow Engine Test ===\n");
  
  const agencies = await db.query.agencies.findMany({ limit: 1 });
  if (agencies.length === 0) {
    console.error("No agencies found. Please ensure the database is seeded.");
    return;
  }
  
  const agencyId = agencies[0].id;
  console.log(`Using agency: ${agencies[0].name} (${agencyId})\n`);

  const testWorkflow = await storage.createWorkflow({
    agencyId,
    name: "Test Signal-Rule Workflow",
    description: "A simple workflow to test the signal and rule handlers",
    status: "active",
    triggerType: "manual",
    triggerConfig: null,
    steps: [
      {
        id: "step-1",
        type: "signal",
        name: "Capture Signal",
        config: {
          signal: {
            type: "test",
            filter: null
          }
        },
        next: "step-2"
      },
      {
        id: "step-2",
        type: "rule",
        name: "Check Value Threshold",
        config: {
          rule: {
            conditions: [
              { field: "value", operator: "gte", value: 100 }
            ],
            logic: "all"
          }
        },
        next: "step-3"
      },
      {
        id: "step-3",
        type: "action",
        name: "Log Success",
        config: {
          action: {
            type: "update_initiative",
            config: { status: "approved" }
          }
        },
        next: null
      }
    ] as any,
    timeout: 60,
    retryPolicy: null,
    createdBy: null,
  });
  
  console.log(`Created workflow: ${testWorkflow.name} (${testWorkflow.id})`);
  console.log(`Status: ${testWorkflow.status}\n`);

  const engine = createWorkflowEngine(storage);
  
  console.log("Executing workflow with value=150 (should pass rule)...");
  const execution1 = await engine.execute(testWorkflow, { 
    type: "test", 
    value: 150,
    source: "test-script"
  }, {
    triggerId: "test-run-1",
    triggerType: "manual"
  });
  
  console.log(`Execution 1 ID: ${execution1.id}`);
  console.log(`Status: ${execution1.status}`);
  console.log(`Result: ${JSON.stringify(execution1.result, null, 2)}\n`);

  const events1 = await storage.getWorkflowEventsByExecutionId(execution1.id);
  console.log(`Step events for execution 1:`);
  events1.forEach(e => {
    console.log(`  - ${e.stepId}: ${e.eventType} (${e.durationMs}ms)`);
  });
  console.log("");

  console.log("Executing workflow with value=50 (should fail rule)...");
  const execution2 = await engine.execute(testWorkflow, { 
    type: "test", 
    value: 50,
    source: "test-script"
  }, {
    triggerId: "test-run-2",
    triggerType: "manual"
  });
  
  console.log(`Execution 2 ID: ${execution2.id}`);
  console.log(`Status: ${execution2.status}`);
  console.log(`Result: ${JSON.stringify(execution2.result, null, 2)}\n`);

  console.log("Testing idempotency (re-executing with same input)...");
  const execution3 = await engine.execute(testWorkflow, { 
    type: "test", 
    value: 150,
    source: "test-script"
  }, {
    triggerId: "test-run-3",
    triggerType: "manual"
  });
  
  console.log(`Execution 3 ID: ${execution3.id}`);
  console.log(`Same as execution 1? ${execution3.id === execution1.id}`);
  console.log("");

  console.log("Cleaning up test data...");
  await db.delete(workflows).where(eq(workflows.id, testWorkflow.id));
  console.log("Test workflow deleted.\n");
  
  console.log("=== Workflow Engine Test Complete ===");
}

runWorkflowTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });

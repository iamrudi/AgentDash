import { useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Zap,
  Filter,
  Brain,
  Play,
  ArrowRight,
  Bell,
  GitBranch,
  Save,
  CheckCircle,
  TestTube,
  Undo,
  Redo,
  Trash2,
  Plus,
  Settings,
  GripVertical,
  ChevronLeft,
} from "lucide-react";
import { Link } from "wouter";

type StepType = "signal" | "rule" | "ai" | "action" | "transform" | "notification" | "branch";

interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

interface WorkflowDefinition {
  id?: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  connections: Array<{ source: string; target: string }>;
}

interface StepNodeData extends Record<string, unknown> {
  type: StepType;
  label: string;
  config: Record<string, unknown>;
}

const stepTypeConfig: Record<StepType, { label: string; icon: typeof Zap; color: string; bgColor: string }> = {
  signal: { label: "Signal", icon: Zap, color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800" },
  rule: { label: "Rule", icon: Filter, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" },
  ai: { label: "AI", icon: Brain, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800" },
  action: { label: "Action", icon: Play, color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" },
  transform: { label: "Transform", icon: ArrowRight, color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800" },
  notification: { label: "Notification", icon: Bell, color: "text-pink-600", bgColor: "bg-pink-50 dark:bg-pink-950 border-pink-200 dark:border-pink-800" },
  branch: { label: "Branch", icon: GitBranch, color: "text-cyan-600", bgColor: "bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800" },
};

function StepNode({ data, selected }: { data: { type: StepType; label: string; config: Record<string, unknown> }; selected: boolean }) {
  const config = stepTypeConfig[data.type];
  const Icon = config.icon;
  const isBranch = data.type === "branch";

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 min-w-[180px] relative ${config.bgColor} ${
        selected ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
      data-testid={`node-${data.type}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white dark:!border-gray-800"
      />
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded ${config.color} bg-white dark:bg-gray-800`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">{data.label}</p>
          <p className="text-xs text-muted-foreground capitalize">{config.label}</p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-white dark:!border-gray-800"
      />
      {isBranch && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-white dark:!border-gray-800"
          />
          <Handle
            type="source"
            position={Position.Left}
            id="false"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-white dark:!border-gray-800"
          />
        </>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  stepNode: StepNode,
};

function StepPalette({ onDragStart }: { onDragStart: (event: React.DragEvent, stepType: StepType) => void }) {
  return (
    <Card className="w-64 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Step Palette</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-2 p-2">
            {(Object.keys(stepTypeConfig) as StepType[]).map((type) => {
              const config = stepTypeConfig[type];
              const Icon = config.icon;
              return (
                <div
                  key={type}
                  draggable
                  onDragStart={(e) => onDragStart(e, type)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing hover-elevate ${config.bgColor}`}
                  data-testid={`palette-${type}`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div className={`p-1.5 rounded ${config.color} bg-white dark:bg-gray-800`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">{config.label}</span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function PropertiesPanel({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
}: {
  selectedNode: Node | null;
  onUpdateNode: (id: string, data: Record<string, unknown>) => void;
  onDeleteNode: (id: string) => void;
}) {
  if (!selectedNode) {
    return (
      <Card className="w-80 h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select a step to configure its properties.</p>
        </CardContent>
      </Card>
    );
  }

  const stepType = selectedNode.data.type as StepType;
  const config = stepTypeConfig[stepType];
  const Icon = config.icon;

  return (
    <Card className="w-80 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${config.color} bg-white dark:bg-gray-800 border`}>
              <Icon className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-medium">{config.label} Properties</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeleteNode(selectedNode.id)}
            className="h-8 w-8 text-destructive"
            data-testid="button-delete-node"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="step-name">Step Name</Label>
              <Input
                id="step-name"
                value={selectedNode.data.label as string}
                onChange={(e) => onUpdateNode(selectedNode.id, { ...selectedNode.data, label: e.target.value })}
                data-testid="input-step-name"
              />
            </div>

            {stepType === "signal" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="signal-source">Signal Source</Label>
                  <Select
                    value={(selectedNode.data.config as Record<string, string>)?.source || ""}
                    onValueChange={(value) =>
                      onUpdateNode(selectedNode.id, {
                        ...selectedNode.data,
                        config: { ...(selectedNode.data.config as object), source: value },
                      })
                    }
                  >
                    <SelectTrigger id="signal-source" data-testid="select-signal-source">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ga4">Google Analytics 4</SelectItem>
                      <SelectItem value="gsc">Google Search Console</SelectItem>
                      <SelectItem value="hubspot">HubSpot</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signal-type">Signal Type</Label>
                  <Input
                    id="signal-type"
                    placeholder="e.g., traffic_drop, deal_created"
                    value={(selectedNode.data.config as Record<string, string>)?.signalType || ""}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, {
                        ...selectedNode.data,
                        config: { ...(selectedNode.data.config as object), signalType: e.target.value },
                      })
                    }
                    data-testid="input-signal-type"
                  />
                </div>
              </>
            )}

            {stepType === "rule" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="rule-field">Field</Label>
                  <Input
                    id="rule-field"
                    placeholder="e.g., payload.value"
                    value={(selectedNode.data.config as Record<string, string>)?.field || ""}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, {
                        ...selectedNode.data,
                        config: { ...(selectedNode.data.config as object), field: e.target.value },
                      })
                    }
                    data-testid="input-rule-field"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-operator">Operator</Label>
                  <Select
                    value={(selectedNode.data.config as Record<string, string>)?.operator || ""}
                    onValueChange={(value) =>
                      onUpdateNode(selectedNode.id, {
                        ...selectedNode.data,
                        config: { ...(selectedNode.data.config as object), operator: value },
                      })
                    }
                  >
                    <SelectTrigger id="rule-operator" data-testid="select-rule-operator">
                      <SelectValue placeholder="Select operator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eq">Equals</SelectItem>
                      <SelectItem value="neq">Not Equals</SelectItem>
                      <SelectItem value="gt">Greater Than</SelectItem>
                      <SelectItem value="gte">Greater Than or Equal</SelectItem>
                      <SelectItem value="lt">Less Than</SelectItem>
                      <SelectItem value="lte">Less Than or Equal</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="in">In List</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-value">Value</Label>
                  <Input
                    id="rule-value"
                    placeholder="Comparison value"
                    value={(selectedNode.data.config as Record<string, string>)?.value || ""}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, {
                        ...selectedNode.data,
                        config: { ...(selectedNode.data.config as object), value: e.target.value },
                      })
                    }
                    data-testid="input-rule-value"
                  />
                </div>
              </>
            )}

            {stepType === "ai" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ai-provider">AI Provider</Label>
                  <Select
                    value={(selectedNode.data.config as Record<string, string>)?.provider || ""}
                    onValueChange={(value) =>
                      onUpdateNode(selectedNode.id, {
                        ...selectedNode.data,
                        config: { ...(selectedNode.data.config as object), provider: value },
                      })
                    }
                  >
                    <SelectTrigger id="ai-provider" data-testid="select-ai-provider">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-operation">Operation</Label>
                  <Select
                    value={(selectedNode.data.config as Record<string, string>)?.operation || ""}
                    onValueChange={(value) =>
                      onUpdateNode(selectedNode.id, {
                        ...selectedNode.data,
                        config: { ...(selectedNode.data.config as object), operation: value },
                      })
                    }
                  >
                    <SelectTrigger id="ai-operation" data-testid="select-ai-operation">
                      <SelectValue placeholder="Select operation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="analyze">Analyze</SelectItem>
                      <SelectItem value="recommend">Recommend</SelectItem>
                      <SelectItem value="generate">Generate</SelectItem>
                      <SelectItem value="summarize">Summarize</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-prompt">Prompt Template</Label>
                  <Textarea
                    id="ai-prompt"
                    placeholder="Enter your prompt template..."
                    rows={4}
                    value={(selectedNode.data.config as Record<string, string>)?.prompt || ""}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, {
                        ...selectedNode.data,
                        config: { ...(selectedNode.data.config as object), prompt: e.target.value },
                      })
                    }
                    data-testid="textarea-ai-prompt"
                  />
                </div>
              </>
            )}

            {stepType === "action" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="action-type">Action Type</Label>
                  <Select
                    value={(selectedNode.data.config as Record<string, string>)?.actionType || ""}
                    onValueChange={(value) =>
                      onUpdateNode(selectedNode.id, {
                        ...selectedNode.data,
                        config: { ...(selectedNode.data.config as object), actionType: value },
                      })
                    }
                  >
                    <SelectTrigger id="action-type" data-testid="select-action-type">
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create_project">Create Project</SelectItem>
                      <SelectItem value="create_task">Create Task</SelectItem>
                      <SelectItem value="update_task">Update Task</SelectItem>
                      <SelectItem value="create_invoice">Create Invoice</SelectItem>
                      <SelectItem value="send_email">Send Email</SelectItem>
                      <SelectItem value="webhook">Call Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {stepType === "notification" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="notification-channel">Channel</Label>
                  <Select
                    value={(selectedNode.data.config as Record<string, string>)?.channel || ""}
                    onValueChange={(value) =>
                      onUpdateNode(selectedNode.id, {
                        ...selectedNode.data,
                        config: { ...(selectedNode.data.config as object), channel: value },
                      })
                    }
                  >
                    <SelectTrigger id="notification-channel" data-testid="select-notification-channel">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_app">In-App</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slack">Slack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notification-message">Message Template</Label>
                  <Textarea
                    id="notification-message"
                    placeholder="Notification message..."
                    rows={3}
                    value={(selectedNode.data.config as Record<string, string>)?.message || ""}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, {
                        ...selectedNode.data,
                        config: { ...(selectedNode.data.config as object), message: e.target.value },
                      })
                    }
                    data-testid="textarea-notification-message"
                  />
                </div>
              </>
            )}

            {stepType === "branch" && (
              <div className="space-y-2">
                <Label>Branch Conditions</Label>
                <p className="text-xs text-muted-foreground">
                  Add multiple outgoing connections to define conditional paths based on the previous step's output.
                </p>
              </div>
            )}

            {stepType === "transform" && (
              <div className="space-y-2">
                <Label htmlFor="transform-expression">Transform Expression</Label>
                <Textarea
                  id="transform-expression"
                  placeholder="e.g., { newField: input.oldField * 2 }"
                  rows={4}
                  value={(selectedNode.data.config as Record<string, string>)?.expression || ""}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, {
                      ...selectedNode.data,
                      config: { ...(selectedNode.data.config as object), expression: e.target.value },
                    })
                  }
                  data-testid="textarea-transform-expression"
                />
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function WorkflowBuilderCanvas() {
  const [, params] = useRoute("/agency/workflow-builder/:id?");
  const workflowId = params?.id;
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [workflowDescription, setWorkflowDescription] = useState("");

  const { data: existingWorkflow } = useQuery({
    queryKey: ["/api/workflows", workflowId],
    enabled: !!workflowId,
  });

  const saveMutation = useMutation({
    mutationFn: async (workflow: WorkflowDefinition) => {
      if (workflowId) {
        return apiRequest("PATCH", `/api/workflows/${workflowId}`, workflow);
      }
      return apiRequest("POST", "/api/workflows", workflow);
    },
    onSuccess: () => {
      toast({ title: "Workflow saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save workflow", description: error.message, variant: "destructive" });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (workflow: WorkflowDefinition) => {
      return apiRequest("POST", "/api/workflows/validate", workflow);
    },
    onSuccess: () => {
      toast({ title: "Workflow is valid", description: "All steps and connections are properly configured." });
    },
    onError: (error: Error) => {
      toast({ title: "Validation failed", description: error.message, variant: "destructive" });
    },
  });

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "hsl(var(--primary))" } }, eds));
    },
    [setEdges]
  );

  const onDragStart = useCallback((event: React.DragEvent, stepType: StepType) => {
    event.dataTransfer.setData("application/reactflow", stepType);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow") as StepType;
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const config = stepTypeConfig[type];
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: "stepNode",
        position,
        data: {
          type,
          label: `New ${config.label}`,
          config: {},
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onUpdateNode = useCallback(
    (id: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return { ...node, data };
          }
          return node;
        })
      );
      setSelectedNode((prev) => (prev?.id === id ? { ...prev, data } : prev));
    },
    [setNodes]
  );

  const onDeleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== id));
      setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  const handleSave = useCallback(() => {
    const workflow: WorkflowDefinition = {
      id: workflowId,
      name: workflowName,
      description: workflowDescription,
      steps: nodes.map((node) => ({
        id: node.id,
        type: node.data.type as StepType,
        name: node.data.label as string,
        config: node.data.config as Record<string, unknown>,
        position: node.position,
      })),
      connections: edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
    };
    saveMutation.mutate(workflow);
  }, [workflowId, workflowName, workflowDescription, nodes, edges, saveMutation]);

  const handleValidate = useCallback(() => {
    const workflow: WorkflowDefinition = {
      name: workflowName,
      description: workflowDescription,
      steps: nodes.map((node) => ({
        id: node.id,
        type: node.data.type as StepType,
        name: node.data.label as string,
        config: node.data.config as Record<string, unknown>,
        position: node.position,
      })),
      connections: edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
    };
    validateMutation.mutate(workflow);
  }, [workflowName, workflowDescription, nodes, edges, validateMutation]);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      <StepPalette onDragStart={onDragStart} />

      <div className="flex-1 flex flex-col gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/agency/workflows">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex-1">
                <Input
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0"
                  placeholder="Workflow Name"
                  data-testid="input-workflow-name"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                Draft
              </Badge>
              <Separator orientation="vertical" className="h-6" />
              <Button variant="ghost" size="icon" disabled data-testid="button-undo">
                <Undo className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" disabled data-testid="button-redo">
                <Redo className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={validateMutation.isPending}
                data-testid="button-validate"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Validate
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled
                data-testid="button-test"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Test
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </Card>

        <Card className="flex-1">
          <div ref={reactFlowWrapper} className="h-full w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              className="bg-muted/30"
            >
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  const type = node.data?.type as StepType;
                  const colors: Record<StepType, string> = {
                    signal: "#ca8a04",
                    rule: "#2563eb",
                    ai: "#9333ea",
                    action: "#16a34a",
                    transform: "#ea580c",
                    notification: "#db2777",
                    branch: "#0891b2",
                  };
                  return colors[type] || "#888";
                }}
              />
              <Background gap={16} size={1} />
              <Panel position="bottom-center">
                <Card className="px-4 py-2">
                  <p className="text-xs text-muted-foreground">
                    Drag steps from the palette to the canvas. Connect steps by dragging from one node to another.
                  </p>
                </Card>
              </Panel>
            </ReactFlow>
          </div>
        </Card>
      </div>

      <PropertiesPanel
        selectedNode={selectedNode}
        onUpdateNode={onUpdateNode}
        onDeleteNode={onDeleteNode}
      />
    </div>
  );
}

export default function WorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderCanvas />
    </ReactFlowProvider>
  );
}

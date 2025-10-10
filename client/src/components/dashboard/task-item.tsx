import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskWithProject } from "@shared/schema";
import { Calendar, AlertCircle } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

interface TaskItemProps {
  task: TaskWithProject;
  onToggle?: (taskId: string, completed: boolean) => void;
  showProject?: boolean;
}

export function TaskItem({ task, onToggle, showProject = false }: TaskItemProps) {
  const isCompleted = task.status === "Completed";
  const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && !isCompleted;

  const statusColors: Record<string, string> = {
    Pending: "bg-muted text-muted-foreground",
    "In Progress": "bg-chart-3/20 text-chart-3",
    Completed: "bg-accent/20 text-accent",
  };

  const priorityColors: Record<string, string> = {
    High: "border-l-destructive",
    Medium: "border-l-chart-3",
    Low: "border-l-chart-1",
  };

  return (
    <Card
      className={`border-l-4 ${priorityColors[task.priority || "Medium"]}`}
      data-testid={`card-task-${task.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={(checked) => onToggle?.(task.id, !!checked)}
            className="mt-0.5"
            data-testid={`checkbox-task-${task.id}`}
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <p
                className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}
                data-testid={`text-task-description-${task.id}`}
              >
                {task.description}
              </p>
              <Badge
                variant="secondary"
                className={statusColors[task.status]}
                data-testid={`badge-task-status-${task.id}`}
              >
                {task.status}
              </Badge>
            </div>
            
            {showProject && task.project && (
              <p className="text-xs text-muted-foreground">
                Project: {task.project.name}
              </p>
            )}
            
            <div className="flex items-center gap-4 flex-wrap">
              {task.dueDate && (
                <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {isOverdue && <AlertCircle className="h-3 w-3" />}
                  <Calendar className="h-3 w-3" />
                  <span data-testid={`text-task-duedate-${task.id}`}>
                    {format(parseISO(task.dueDate), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              <Badge variant="outline" className="text-xs" data-testid={`badge-task-priority-${task.id}`}>
                {task.priority}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

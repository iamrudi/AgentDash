import { useQuery } from "@tanstack/react-query";
import { AgencyLayout } from "@/components/agency-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task, StaffAssignment, Profile } from "@shared/schema";
import { Users, CheckCircle2, Circle } from "lucide-react";

export default function AgencyStaffPage() {
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/staff/tasks"],
  });

  const { data: assignments } = useQuery<StaffAssignment[]>({
    queryKey: ["/api/staff/assignments"],
  });

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Staff Management</h1>
          <p className="text-muted-foreground">
            Manage staff assignments and track task progress
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Tasks & Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!tasks || tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No tasks assigned yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-lg border hover-elevate"
                    data-testid={`task-${task.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {task.status === "Completed" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium mb-1">{task.description}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant={task.status === "Completed" ? "secondary" : "default"}>
                              {task.status}
                            </Badge>
                            {task.priority && (
                              <Badge variant="outline">{task.priority}</Badge>
                            )}
                            {task.dueDate && (
                              <span className="text-xs text-muted-foreground">
                                Due: {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AgencyLayout>
  );
}

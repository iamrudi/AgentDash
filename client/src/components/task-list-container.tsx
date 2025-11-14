import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, GripVertical, UserPlus } from "lucide-react";
import { format } from "date-fns";
import type { Task, TaskList, Profile, StaffAssignment } from "@shared/schema";
import { TaskStatusControl, TaskPriorityControl } from "./task-inline-editors";

type TaskWithAssignments = Task & {
  assignments: Array<StaffAssignment & { staffProfile: Profile }>;
};

interface TaskListContainerProps {
  taskList: TaskList;
  tasks: TaskWithAssignments[];
  projectId: string; // Added for inline editors
  onEditList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onCreateTask: (listId: string) => void;
  onEditTask: (task: TaskWithAssignments) => void;
  onDeleteTask: (task: TaskWithAssignments) => void;
  onAssignStaff: (task: TaskWithAssignments) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "Completed": return "bg-green-500/10 text-green-500 border-green-500/20";
    case "In Progress": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "To Do": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "Blocked": return "bg-red-500/10 text-red-500 border-red-500/20";
    default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "Urgent": return "bg-red-600/10 text-red-600 border-red-600/20";
    case "High": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    case "Medium": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "Low": return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
};

export function TaskListContainer({
  taskList,
  tasks,
  projectId,
  onEditList,
  onDeleteList,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onAssignStaff,
}: TaskListContainerProps) {
  const [isHovered, setIsHovered] = useState(false);

  const listTasks = tasks.filter(task => task.listId === taskList.id);

  return (
    <Card 
      className="flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`task-list-${taskList.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
            <CardTitle className="text-base" data-testid={`task-list-name-${taskList.id}`}>
              {taskList.name}
            </CardTitle>
            <Badge variant="secondary" className="ml-auto">
              {listTasks.length}
            </Badge>
          </div>
          <div className={`flex items-center gap-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEditList(taskList.id)}
              data-testid={`button-edit-list-${taskList.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onDeleteList(taskList.id)}
              data-testid={`button-delete-list-${taskList.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-2">
        {listTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No tasks in this list
          </div>
        ) : (
          listTasks.map(task => (
            <Card key={task.id} className="hover-elevate" data-testid={`card-task-${task.id}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate" data-testid={`text-task-description-${task.id}`}>
                        {task.description}
                      </p>
                      <TaskStatusControl 
                        task={task} 
                        projectId={projectId}
                      />
                      <TaskPriorityControl 
                        task={task} 
                        projectId={projectId}
                      />
                    </div>
                    
                    {task.dueDate && (
                      <p className="text-xs text-muted-foreground" data-testid={`text-task-due-${task.id}`}>
                        Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                      </p>
                    )}

                    {task.assignments && task.assignments.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {task.assignments.map(assignment => (
                          <Badge
                            key={assignment.id}
                            variant="outline"
                            className="text-xs"
                            data-testid={`badge-assigned-${assignment.staffProfile.id}`}
                          >
                            {assignment.staffProfile.fullName}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onAssignStaff(task)}
                      data-testid={`button-assign-staff-${task.id}`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEditTask(task)}
                      data-testid={`button-edit-task-${task.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onDeleteTask(task)}
                      data-testid={`button-delete-task-${task.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => onCreateTask(taskList.id)}
          data-testid={`button-add-task-to-list-${taskList.id}`}
        >
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </CardContent>
    </Card>
  );
}

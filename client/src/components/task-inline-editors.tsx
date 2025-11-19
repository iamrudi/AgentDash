import { useState, useEffect, type MouseEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task, TaskStatus, TaskPriority, Profile, StaffAssignment } from "@shared/schema";
import { taskStatusEnum, taskPriorityEnum } from "@shared/schema";

type TaskWithAssignments = Task & {
  assignments: Array<StaffAssignment & { staffProfile: Profile }>;
};

// Shared optimistic update helper for task field updates
async function updateProjectTaskField(
  projectId: string,
  taskId: string,
  patch: Partial<Task>
) {
  await queryClient.cancelQueries({ queryKey: ["/api/agency/projects", projectId] });
  
  const previousData = queryClient.getQueryData(["/api/agency/projects", projectId]);

  queryClient.setQueryData(["/api/agency/projects", projectId], (old: any) => {
    if (!old || !old.tasks) return old;
    
    return {
      ...old,
      tasks: old.tasks.map((t: Task) =>
        t.id === taskId ? { ...t, ...patch } : t
      ),
    };
  });

  return { previousData };
}

// Helper to get status variant (using semantic design tokens)
const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case "Completed": return "default"; // Uses accent color
    case "In Progress": return "default";
    case "To Do": return "secondary";
    case "Blocked": return "destructive";
    default: return "secondary";
  }
};

// Helper to get priority variant (using semantic design tokens)
const getPriorityVariant = (priority: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (priority) {
    case "Urgent": return "destructive";
    case "High": return "default";
    case "Medium": return "secondary";
    case "Low": return "outline";
    default: return "secondary";
  }
};

// Task Status Inline Editor
interface TaskStatusControlProps {
  task: Task;
  projectId: string;
}

export function TaskStatusControl({ task, projectId }: TaskStatusControlProps) {
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (status: TaskStatus) => {
      return await apiRequest("PATCH", `/api/tasks/${task.id}`, { status });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks/full"] }),
      ]);
    },
  });

  const variant = getStatusVariant(task.status);
  const variantClasses = {
    default: "bg-accent text-accent-foreground border-accent",
    secondary: "bg-secondary text-secondary-foreground border-secondary",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    outline: "bg-transparent text-foreground border-border"
  }[variant];

  return (
    <Select
      value={task.status}
      onValueChange={(value) => updateMutation.mutate(value as TaskStatus)}
      disabled={updateMutation.isPending}
    >
      <SelectTrigger 
        className={`h-auto border px-2 py-1 text-xs w-auto ${variantClasses}`}
        data-testid={`select-task-status-${task.id}`}
        aria-label={`Change status from ${task.status}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {taskStatusEnum.map((status) => (
          <SelectItem key={status} value={status} data-testid={`option-status-${status}`}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Task Priority Inline Editor
interface TaskPriorityControlProps {
  task: Task;
  projectId: string;
}

export function TaskPriorityControl({ task, projectId }: TaskPriorityControlProps) {
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (priority: TaskPriority) => {
      return await apiRequest("PATCH", `/api/tasks/${task.id}`, { priority });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks/full"] }),
      ]);
    },
  });

  const variant = getPriorityVariant(task.priority || "Medium");
  const variantClasses = {
    default: "bg-accent text-accent-foreground border-accent",
    secondary: "bg-secondary text-secondary-foreground border-secondary",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    outline: "bg-transparent text-foreground border-border"
  }[variant];

  return (
    <Select
      value={task.priority || "Medium"}
      onValueChange={(value) => updateMutation.mutate(value as TaskPriority)}
      disabled={updateMutation.isPending}
    >
      <SelectTrigger 
        className={`h-auto border px-2 py-1 text-xs w-auto ${variantClasses}`}
        data-testid={`select-task-priority-${task.id}`}
        aria-label={`Change priority from ${task.priority || 'Medium'}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {taskPriorityEnum.map((priority) => (
          <SelectItem key={priority} value={priority} data-testid={`option-priority-${priority}`}>
            {priority}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Task Date Inline Editor
interface TaskDateControlProps {
  task: Task;
  projectId: string;
  dateType: "startDate" | "dueDate";
  label: string;
}

export function TaskDateControl({ task, projectId, dateType, label }: TaskDateControlProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const currentDate = task[dateType] ? new Date(task[dateType]!) : undefined;

  const updateMutation = useMutation({
    mutationFn: async (date: Date | null) => {
      return await apiRequest("PATCH", `/api/tasks/${task.id}`, { 
        [dateType]: date ? date.toISOString() : null 
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks/full"] }),
      ]);
      setOpen(false);
    },
  });

  const handleDateChange = (date: Date | undefined) => {
    if (!date) {
      updateMutation.mutate(null);
      return;
    }

    // Client-side validation: ensure date ordering
    if (dateType === "dueDate" && task.startDate) {
      const startDate = new Date(task.startDate);
      if (date < startDate) {
        toast({
          title: "Invalid Date",
          description: "Due date cannot be before start date",
          variant: "destructive",
        });
        return;
      }
    }

    if (dateType === "startDate" && task.dueDate) {
      const dueDate = new Date(task.dueDate);
      if (date > dueDate) {
        toast({
          title: "Invalid Date",
          description: "Start date cannot be after due date",
          variant: "destructive",
        });
        return;
      }
    }

    updateMutation.mutate(date);
  };

  const handleClear = (e: MouseEvent<HTMLOrSVGElement>) => {
    e.stopPropagation();
    updateMutation.mutate(null);
  };

  return (
    <div className="flex items-center gap-0.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs justify-start font-normal hover-elevate"
            data-testid={`button-task-${dateType}-${task.id}`}
          >
            <CalendarIcon className="mr-1.5 h-3 w-3" />
            {currentDate ? (
              <span>{label}: {format(currentDate, "MMM d, yyyy")}</span>
            ) : (
              <span className="text-muted-foreground">Set {label}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={handleDateChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {currentDate && (
        <button
          onClick={handleClear}
          className="h-4 w-4 rounded-sm opacity-50 hover:opacity-100 hover:bg-accent flex items-center justify-center"
          data-testid={`button-clear-${dateType}-${task.id}`}
          aria-label={`Clear ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// Task Assignees Display and Management
interface TaskAssigneesControlProps {
  task: TaskWithAssignments;
  projectId: string;
  onAssignStaff: (task: TaskWithAssignments) => void;
}

export function TaskAssigneesControl({ task, projectId, onAssignStaff }: TaskAssigneesControlProps) {
  const { toast } = useToast();

  const removeMutation = useMutation({
    mutationFn: async (staffProfileId: string) => {
      return await apiRequest("DELETE", `/api/agency/tasks/${task.id}/assign/${staffProfileId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] });
      toast({
        title: "Removed",
        description: "Staff member has been unassigned from this task.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignees = task.assignments || [];
  const maxDisplay = 3;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {assignees.slice(0, maxDisplay).map((assignment) => {
        const staff = assignment.staffProfile;
        const initials = staff.fullName
          ?.split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) || "?";

        return (
          <div key={assignment.id} className="relative group">
            <Avatar className="h-6 w-6" data-testid={`avatar-assignee-${staff.id}`}>
              <AvatarImage src={undefined} alt={staff.fullName || "Staff"} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => removeMutation.mutate(staff.id)}
              className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid={`button-remove-assignee-${staff.id}`}
            >
              <X className="h-2 w-2" />
            </button>
          </div>
        );
      })}
      
      {assignees.length > maxDisplay && (
        <Badge variant="secondary" className="h-6 w-6 p-0 flex items-center justify-center text-xs">
          +{assignees.length - maxDisplay}
        </Badge>
      )}
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => onAssignStaff(task)}
        data-testid={`button-assign-staff-${task.id}`}
      >
        <UserPlus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// Task Time Estimate Inline Editor
interface TaskTimeEstimateControlProps {
  task: Task;
  projectId: string;
}

export function TaskTimeEstimateControl({ task, projectId }: TaskTimeEstimateControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(task.timeEstimate || "");
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (timeEstimate: string) => {
      return await apiRequest("PATCH", `/api/tasks/${task.id}`, { timeEstimate: timeEstimate || null });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setValue(task.timeEstimate || "");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks/full"] }),
      ]);
      setIsEditing(false);
    },
  });

  const handleSave = () => {
    if (value === task.timeEstimate) {
      setIsEditing(false);
      return;
    }
    updateMutation.mutate(value.trim());
  };

  const handleCancel = () => {
    setValue(task.timeEstimate || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          placeholder="e.g., 15h, 2d, 30m"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          autoFocus
          data-testid={`input-time-estimate-${task.id}`}
        />
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} data-testid={`button-save-time-estimate-${task.id}`}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} disabled={updateMutation.isPending}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div data-testid={`control-time-estimate-${task.id}`}>
      <button
        onClick={() => setIsEditing(true)}
        className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm text-left hover-elevate"
        data-testid={`button-edit-time-estimate-${task.id}`}
      >
        <span data-testid={`text-time-estimate-${task.id}`}>
          {task.timeEstimate || <span className="text-muted-foreground">No estimate</span>}
        </span>
      </button>
    </div>
  );
}

// Task Time Tracked Inline Editor
interface TaskTimeTrackedControlProps {
  task: Task;
  projectId: string;
}

// Helper function to parse time strings like "2h 30m" into hours
function parseTimeToHours(timeStr: string): number {
  if (!timeStr || timeStr.trim() === '') return 0;
  
  let totalHours = 0;
  const hourMatch = timeStr.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minMatch = timeStr.match(/(\d+(?:\.\d+)?)\s*m/i);
  
  if (hourMatch) {
    totalHours += parseFloat(hourMatch[1]);
  }
  if (minMatch) {
    totalHours += parseFloat(minMatch[1]) / 60;
  }
  
  // If no h or m found, try parsing as a plain number (assume hours)
  if (!hourMatch && !minMatch) {
    const num = parseFloat(timeStr);
    if (!isNaN(num)) {
      totalHours = num;
    }
  }
  
  return Math.max(0, totalHours);
}

// Helper function to format hours into readable string
function formatHours(hours: number): string {
  if (hours === 0) return '0h';
  
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  
  if (wholeHours === 0) {
    return `${minutes}m`;
  }
  
  return `${wholeHours}h ${minutes}m`;
}

export function TaskTimeTrackedControl({ task, projectId }: TaskTimeTrackedControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const { toast } = useToast();

  // Safely parse timeTracked as a number, defaulting to 0
  const currentTime = typeof task.timeTracked === 'number' && !isNaN(task.timeTracked) 
    ? task.timeTracked 
    : 0;

  // Sync value state with task prop when it updates
  useEffect(() => {
    if (!isEditing) {
      const formatted = formatHours(currentTime);
      console.log('[TimeTracked useEffect] Syncing value. currentTime:', currentTime, 'formatted:', formatted, 'isEditing:', isEditing);
      setValue(formatted);
    }
  }, [currentTime, isEditing]);

  const updateMutation = useMutation({
    mutationFn: async (timeTracked: number) => {
      return await apiRequest("PATCH", `/api/tasks/${task.id}`, { timeTracked });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setValue(formatHours(currentTime));
    },
    onSuccess: async () => {
      console.log('[TimeTracked] Mutation succeeded, invalidating queries...');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/agency/projects", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tasks/full"] }),
      ]);
      console.log('[TimeTracked] Queries invalidated, closing edit mode');
      setIsEditing(false);
    },
  });

  const handleSave = () => {
    const parsedHours = parseTimeToHours(value);
    console.log('[TimeTracked] Saving value:', value, 'parsed:', parsedHours);
    if (parsedHours === currentTime) {
      setIsEditing(false);
      return;
    }
    updateMutation.mutate(parsedHours);
  };

  const handleCancel = () => {
    setValue(formatHours(currentTime));
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          placeholder="e.g., 2h 30m, 1.5h, 90m"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          autoFocus
          data-testid={`input-time-tracked-${task.id}`}
        />
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} data-testid={`button-save-time-tracked-${task.id}`}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} disabled={updateMutation.isPending}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div data-testid={`control-time-tracked-${task.id}`}>
      <button
        onClick={() => {
          setValue(formatHours(currentTime));
          setIsEditing(true);
        }}
        className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm text-left hover-elevate"
        data-testid={`button-edit-time-tracked-${task.id}`}
      >
        <span data-testid={`text-time-tracked-${task.id}`}>
          {currentTime > 0 ? formatHours(currentTime) : <span className="text-muted-foreground">No time tracked</span>}
        </span>
      </button>
    </div>
  );
}

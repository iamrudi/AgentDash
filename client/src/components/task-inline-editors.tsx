import { useState, useEffect, type MouseEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Task Time Estimate Inline Editor
interface TaskTimeEstimateControlProps {
  task: Task;
  projectId: string;
}

export function TaskTimeEstimateControl({ task, projectId }: TaskTimeEstimateControlProps) {
  const { toast } = useToast();

  // Safely parse timeEstimate as a number, defaulting to 0
  // Note: Drizzle's numeric type returns strings, so we need to parse them
  const currentEstimate = (() => {
    if (task.timeEstimate === null || task.timeEstimate === undefined) return 0;
    const parsed = typeof task.timeEstimate === 'string' 
      ? parseFloat(task.timeEstimate) 
      : Number(task.timeEstimate);
    return isNaN(parsed) ? 0 : parsed;
  })();

  const [inputValue, setInputValue] = useState(currentEstimate.toString());
  const [isEditing, setIsEditing] = useState(false);

  // Sync input when task changes
  useEffect(() => {
    setInputValue(currentEstimate.toString());
  }, [currentEstimate]);

  const updateMutation = useMutation({
    mutationFn: async (timeEstimate: number) => {
      console.log('[Time Estimate] Sending PATCH request with value:', timeEstimate);
      const response = await apiRequest("PATCH", `/api/tasks/${task.id}`, { timeEstimate });
      console.log('[Time Estimate] PATCH response:', response);
      return response;
    },
    onSuccess: async (data) => {
      console.log('[Time Estimate] Mutation succeeded, invalidating queries');
      // Invalidate and refetch the project data
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/agency/projects", projectId],
        refetchType: 'active'
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/staff/tasks"],
        refetchType: 'active'
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/staff/tasks/full"],
        refetchType: 'active'
      });
      
      console.log('[Time Estimate] Queries invalidated, hiding edit buttons');
      setIsEditing(false);
      
      toast({
        title: "Success",
        description: "Time estimate saved",
      });
    },
    onError: (error: Error) => {
      console.error('[Time Estimate] Mutation failed:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setInputValue(currentEstimate.toString());
    },
  });

  const handleSave = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('[Time Estimate] Save clicked, inputValue:', inputValue, 'currentEstimate:', currentEstimate);
    
    const value = parseFloat(inputValue);
    
    if (isNaN(value) || value < 0) {
      toast({
        title: "Invalid input",
        description: "Please enter a valid number (e.g., 1.5 for 1.5 hours)",
        variant: "destructive",
      });
      return;
    }

    // Check if it's in 0.5 hour increments
    if (value % 0.5 !== 0) {
      toast({
        title: "Invalid increment",
        description: "Time must be in 0.5 hour increments (e.g., 0.5, 1, 1.5, 2)",
        variant: "destructive",
      });
      return;
    }

    if (value !== currentEstimate) {
      console.log('[Time Estimate] Triggering mutation with value:', value);
      updateMutation.mutate(value);
    } else {
      console.log('[Time Estimate] No change, hiding buttons');
      setIsEditing(false);
    }
  };

  const handleCancel = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('[Time Estimate] Cancel clicked');
    setInputValue(currentEstimate.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Time Estimate] Enter pressed, preventing default');
      handleSave();
    }
  };

  return (
    <div data-testid={`control-time-estimate-${task.id}`} className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsEditing(true);
          }}
          onKeyDown={handleKeyDown}
          disabled={updateMutation.isPending}
          placeholder="0"
          className="h-9 text-center"
          data-testid={`input-time-estimate-${task.id}`}
        />
        <span className="text-sm text-muted-foreground">hours</span>
      </div>
      {isEditing && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-time-estimate"
          >
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={updateMutation.isPending}
            data-testid="button-cancel-time-estimate"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// Task Time Tracked Inline Editor
interface TaskTimeTrackedControlProps {
  task: Task;
  projectId: string;
}

export function TaskTimeTrackedControl({ task, projectId }: TaskTimeTrackedControlProps) {
  const { toast } = useToast();

  // Safely parse timeTracked as a number, defaulting to 0
  // Note: Drizzle's numeric type returns strings, so we need to parse them
  const currentTime = (() => {
    if (task.timeTracked === null || task.timeTracked === undefined) return 0;
    const parsed = typeof task.timeTracked === 'string' 
      ? parseFloat(task.timeTracked) 
      : Number(task.timeTracked);
    return isNaN(parsed) ? 0 : parsed;
  })();

  const [inputValue, setInputValue] = useState(currentTime.toString());
  const [isEditing, setIsEditing] = useState(false);

  // Sync input when task changes
  useEffect(() => {
    setInputValue(currentTime.toString());
  }, [currentTime]);

  const updateMutation = useMutation({
    mutationFn: async (timeTracked: number) => {
      console.log('[Time Tracked] Sending PATCH request with value:', timeTracked);
      const response = await apiRequest("PATCH", `/api/tasks/${task.id}`, { timeTracked });
      console.log('[Time Tracked] PATCH response:', response);
      return response;
    },
    onSuccess: async (data) => {
      console.log('[Time Tracked] Mutation succeeded, invalidating queries');
      // Invalidate and refetch the project data
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/agency/projects", projectId],
        refetchType: 'active'
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/staff/tasks"],
        refetchType: 'active'
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/staff/tasks/full"],
        refetchType: 'active'
      });
      
      console.log('[Time Tracked] Queries invalidated, hiding edit buttons');
      setIsEditing(false);
      
      toast({
        title: "Success",
        description: "Time tracked saved",
      });
    },
    onError: (error: Error) => {
      console.error('[Time Tracked] Mutation failed:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setInputValue(currentTime.toString());
    },
  });

  const handleSave = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('[Time Tracked] Save clicked, inputValue:', inputValue, 'currentTime:', currentTime);
    
    const value = parseFloat(inputValue);
    
    if (isNaN(value) || value < 0) {
      toast({
        title: "Invalid input",
        description: "Please enter a valid number (e.g., 1.5 for 1.5 hours)",
        variant: "destructive",
      });
      return;
    }

    // Check if it's in 0.5 hour increments
    if (value % 0.5 !== 0) {
      toast({
        title: "Invalid increment",
        description: "Time must be in 0.5 hour increments (e.g., 0.5, 1, 1.5, 2)",
        variant: "destructive",
      });
      return;
    }

    if (value !== currentTime) {
      console.log('[Time Tracked] Triggering mutation with value:', value);
      updateMutation.mutate(value);
    } else {
      console.log('[Time Tracked] No change, hiding buttons');
      setIsEditing(false);
    }
  };

  const handleCancel = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('[Time Tracked] Cancel clicked');
    setInputValue(currentTime.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Time Tracked] Enter pressed, preventing default');
      handleSave();
    }
  };

  return (
    <div data-testid={`control-time-tracked-${task.id}`} className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsEditing(true);
          }}
          onKeyDown={handleKeyDown}
          disabled={updateMutation.isPending}
          placeholder="0"
          className="h-9 text-center"
          data-testid={`input-time-tracked-${task.id}`}
        />
        <span className="text-sm text-muted-foreground">hours</span>
      </div>
      {isEditing && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-time-tracked"
          >
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={updateMutation.isPending}
            data-testid="button-cancel-time-tracked"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

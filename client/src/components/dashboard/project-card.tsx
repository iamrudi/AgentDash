import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectWithClient } from "@shared/schema";
import { FolderKanban } from "lucide-react";

interface ProjectCardProps {
  project: ProjectWithClient;
  onClick?: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const statusColors: Record<string, string> = {
    Active: "bg-accent text-accent-foreground",
    Pending: "bg-chart-3/20 text-chart-3",
    Completed: "bg-chart-1/20 text-chart-1",
  };

  return (
    <Card
      className="hover-elevate cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`card-project-${project.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-2 bg-primary/10 rounded-md">
              <FolderKanban className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate" data-testid={`text-project-name-${project.id}`}>
                {project.name}
              </h3>
              {project.client && (
                <p className="text-xs text-muted-foreground truncate">
                  {project.client.companyName}
                </p>
              )}
            </div>
          </div>
          <Badge
            variant="secondary"
            className={statusColors[project.status] || ""}
            data-testid={`badge-status-${project.id}`}
          >
            {project.status}
          </Badge>
        </div>
      </CardHeader>
      {project.description && (
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

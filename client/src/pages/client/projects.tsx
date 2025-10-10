import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Calendar, AlertCircle } from "lucide-react";
import { ProjectWithClient } from "@shared/schema";
import { format } from "date-fns";

export default function Projects() {
  const { data: projects = [], isLoading } = useQuery<ProjectWithClient[]>({
    queryKey: ["/api/client/projects"],
  });

  const activeProjects = projects.filter(p => p.status !== "Completed");
  const completedProjects = projects.filter(p => p.status === "Completed");

  const ProjectCard = ({ project }: { project: ProjectWithClient }) => (
    <Card data-testid={`project-card-${project.id}`} className="hover-elevate">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg" data-testid={`project-name-${project.id}`}>
              {project.name}
            </CardTitle>
            {project.description && (
              <CardDescription className="mt-1" data-testid={`project-description-${project.id}`}>
                {project.description}
              </CardDescription>
            )}
          </div>
          <Badge 
            variant={project.status === "Active" ? "default" : project.status === "Completed" ? "secondary" : "outline"}
            data-testid={`project-status-${project.id}`}
          >
            {project.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span data-testid={`project-date-${project.id}`}>
              {format(new Date(project.createdAt), "MMM d, yyyy")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-projects">Projects</h1>
        <p className="text-muted-foreground mt-1">View and track your active and completed projects</p>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList data-testid="tabs-projects">
          <TabsTrigger value="active" data-testid="tab-active">
            Active ({activeProjects.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completedProjects.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4" data-testid="tab-content-active">
          {isLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">Loading projects...</div>
              </CardContent>
            </Card>
          ) : activeProjects.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No active projects</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4" data-testid="tab-content-completed">
          {isLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">Loading projects...</div>
              </CardContent>
            </Card>
          ) : completedProjects.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No completed projects</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

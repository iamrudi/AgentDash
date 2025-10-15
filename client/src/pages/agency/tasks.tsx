import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Project, Client } from "@shared/schema";
import { FolderKanban, Building2, Plus, ListTodo } from "lucide-react";
import { ClientFilter } from "@/components/client-filter";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { useState } from "react";

export default function AgencyTasksPage() {
  const [, setLocation] = useLocation();
  const [selectedClientId, setSelectedClientId] = useState("ALL");
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/agency/projects"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  // Filter projects based on selected client
  const filteredProjects = selectedClientId === "ALL"
    ? projects
    : projects?.filter(p => p.clientId === selectedClientId);

  const activeProjects = filteredProjects?.filter(p => p.status === "Active") || [];
  const completedProjects = filteredProjects?.filter(p => p.status === "Completed") || [];

  return (
    <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Tasks & Projects</h1>
            <p className="text-muted-foreground">
              Manage all client projects and task assignments
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ClientFilter
              clients={clients}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
            />
            <Button 
              onClick={() => setShowCreateTask(true)}
              variant="outline"
              data-testid="button-create-task"
            >
              <ListTodo className="h-4 w-4 mr-2" />
              Create Task
            </Button>
            <Button 
              onClick={() => setShowCreateProject(true)}
              data-testid="button-create-project"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </div>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active-projects">
              Active Projects ({activeProjects.length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed-projects">
              Completed ({completedProjects.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeProjects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No active projects</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeProjects.map((project) => {
                  const client = clients?.find(c => c.id === project.clientId);
                  return (
                    <Card 
                      key={project.id} 
                      className="hover-elevate cursor-pointer" 
                      data-testid={`project-card-${project.id}`}
                      onClick={() => setLocation(`/agency/projects/${project.id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{project.name}</CardTitle>
                          <Badge variant="default">Active</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span>{client?.companyName || "Unknown Client"}</span>
                        </div>
                        {project.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedProjects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No completed projects</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedProjects.map((project) => {
                  const client = clients?.find(c => c.id === project.clientId);
                  return (
                    <Card 
                      key={project.id} 
                      className="hover-elevate cursor-pointer" 
                      data-testid={`project-card-${project.id}`}
                      onClick={() => setLocation(`/agency/projects/${project.id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{project.name}</CardTitle>
                          <Badge variant="secondary">Completed</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span>{client?.companyName || "Unknown Client"}</span>
                        </div>
                        {project.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <CreateProjectDialog 
          open={showCreateProject} 
          onOpenChange={setShowCreateProject} 
        />
        <CreateTaskDialog 
          open={showCreateTask} 
          onOpenChange={setShowCreateTask} 
        />
      </div>
  );
}

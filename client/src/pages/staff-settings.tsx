import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Settings as SettingsIcon,
  User,
  Palette,
  PanelLeft,
  X,
  Plus,
  Check,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Profile } from "@shared/schema";

type SidebarMode = 'expanded' | 'collapsed' | 'hover';

export default function StaffSettings() {
  const { toast } = useToast();
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(
    () => (localStorage.getItem('sidebarMode') as SidebarMode) || 'expanded'
  );
  const [newSkill, setNewSkill] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['/api/user/profile'],
  });

  useEffect(() => {
    if (profile?.fullName) {
      setEditedName(profile.fullName);
    }
  }, [profile?.fullName]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { fullName?: string; skills?: string[] }) => {
      const response = await apiRequest('PATCH', '/api/user/profile', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully",
      });
      setIsEditingName(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSidebarModeChange = (mode: SidebarMode) => {
    setSidebarMode(mode);
    localStorage.setItem('sidebarMode', mode);
    window.dispatchEvent(new CustomEvent('sidebarModeChange', { detail: mode }));
  };

  const handleSaveName = () => {
    if (editedName.trim() && editedName !== profile?.fullName) {
      updateProfileMutation.mutate({ fullName: editedName.trim() });
    } else {
      setIsEditingName(false);
    }
  };

  const handleAddSkill = () => {
    if (newSkill.trim()) {
      const currentSkills = profile?.skills || [];
      if (!currentSkills.includes(newSkill.trim())) {
        updateProfileMutation.mutate({ 
          skills: [...currentSkills, newSkill.trim()] 
        });
      }
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const currentSkills = profile?.skills || [];
    updateProfileMutation.mutate({ 
      skills: currentSkills.filter(skill => skill !== skillToRemove) 
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-lg font-semibold">Settings</h1>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                  <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
                  <p className="text-sm text-muted-foreground">
                    Manage your interface preferences and profile
                  </p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Interface Preferences</CardTitle>
                      <CardDescription>Customize your portal experience</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Theme</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Use the theme toggle in the top right corner to switch between light and dark modes
                    </p>
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                      <ThemeToggle />
                      <span className="text-sm text-muted-foreground">Toggle theme</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <PanelLeft className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Sidebar Behavior</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Choose how the sidebar should behave
                    </p>
                    <RadioGroup 
                      value={sidebarMode} 
                      onValueChange={(value) => handleSidebarModeChange(value as SidebarMode)}
                      className="space-y-2"
                      data-testid="radio-sidebar-mode"
                    >
                      <div className="flex items-center space-x-3 p-3 rounded-md hover-elevate">
                        <RadioGroupItem value="expanded" id="expanded" data-testid="radio-sidebar-expanded" />
                        <Label htmlFor="expanded" className="flex-1 cursor-pointer">
                          <div className="font-medium text-sm">Always Expanded</div>
                          <div className="text-xs text-muted-foreground">Sidebar stays open and visible</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 rounded-md hover-elevate">
                        <RadioGroupItem value="collapsed" id="collapsed" data-testid="radio-sidebar-collapsed" />
                        <Label htmlFor="collapsed" className="flex-1 cursor-pointer">
                          <div className="font-medium text-sm">Always Collapsed</div>
                          <div className="text-xs text-muted-foreground">Sidebar shows only icons</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 rounded-md hover-elevate">
                        <RadioGroupItem value="hover" id="hover" data-testid="radio-sidebar-hover" />
                        <Label htmlFor="hover" className="flex-1 cursor-pointer">
                          <div className="font-medium text-sm">Expand on Hover</div>
                          <div className="text-xs text-muted-foreground">Sidebar expands when you hover over it</div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Profile</CardTitle>
                      <CardDescription>Update your display name and skills</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Display Name</Label>
                        {isEditingName ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editedName}
                              onChange={(e) => setEditedName(e.target.value)}
                              className="flex-1"
                              placeholder="Enter your display name"
                              data-testid="input-display-name"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={handleSaveName}
                              disabled={updateProfileMutation.isPending}
                              data-testid="button-save-name"
                            >
                              {updateProfileMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setIsEditingName(false);
                                setEditedName(profile?.fullName || "");
                              }}
                              disabled={updateProfileMutation.isPending}
                              data-testid="button-cancel-name"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 p-2 bg-muted/50 rounded-md">
                              <span className="text-sm" data-testid="text-display-name">
                                {profile?.fullName || "Not set"}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsEditingName(true)}
                              data-testid="button-edit-name"
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Email</Label>
                        <div className="p-2 bg-muted/50 rounded-md">
                          <span className="text-sm text-muted-foreground" data-testid="text-email">
                            {profile?.email || "Not available"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Email cannot be changed
                        </p>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Skills</Label>
                        <p className="text-xs text-muted-foreground">
                          Add your skills and expertise areas
                        </p>
                        
                        <div className="flex items-center gap-2">
                          <Input
                            value={newSkill}
                            onChange={(e) => setNewSkill(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Add a skill..."
                            className="flex-1"
                            data-testid="input-new-skill"
                          />
                          <Button
                            size="icon"
                            onClick={handleAddSkill}
                            disabled={!newSkill.trim() || updateProfileMutation.isPending}
                            data-testid="button-add-skill"
                          >
                            {updateProfileMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2 min-h-[40px]" data-testid="skills-list">
                          {profile?.skills && profile.skills.length > 0 ? (
                            profile.skills.map((skill) => (
                              <Badge 
                                key={skill} 
                                variant="secondary" 
                                className="flex items-center gap-1 px-3 py-1"
                                data-testid={`badge-skill-${skill.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                {skill}
                                <button
                                  onClick={() => handleRemoveSkill(skill)}
                                  className="ml-1 hover:text-destructive transition-colors"
                                  disabled={updateProfileMutation.isPending}
                                  data-testid={`button-remove-skill-${skill.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              No skills added yet
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

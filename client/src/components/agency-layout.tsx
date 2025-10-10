import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AgencySidebar } from "@/components/agency-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

interface AgencyLayoutProps {
  children: React.ReactNode;
}

export function AgencyLayout({ children }: AgencyLayoutProps) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AgencySidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

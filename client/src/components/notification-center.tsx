import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Inbox, Archive, Check, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@shared/schema";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"inbox" | "archived">("inbox");

  // Fetch inbox notifications
  const { data: inboxNotifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", { archived: false }],
    queryFn: () => apiRequest("GET", "/api/notifications?archived=false").then(r => r.json()),
    enabled: open,
  });

  // Fetch archived notifications
  const { data: archivedNotifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", { archived: true }],
    queryFn: () => apiRequest("GET", "/api/notifications?archived=true").then(r => r.json()),
    enabled: open && activeTab === "archived",
  });

  // Fetch unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 10000,
  });

  const unreadCount = unreadData?.count || 0;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/notifications/${id}/mark-read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/notifications/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/mark-all-read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const notifications = activeTab === "inbox" ? inboxNotifications : archivedNotifications;
  const hasNotifications = notifications.length > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs"
              data-testid="notification-unread-badge"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            {activeTab === "inbox" && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                <Check className="h-4 w-4 mr-2" />
                Mark all as read
              </Button>
            )}
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "inbox" | "archived")} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="inbox" data-testid="tab-inbox">
                Inbox
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="archived" data-testid="tab-archived">
                Archived
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="inbox" className="mt-0">
              {!hasNotifications ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Inbox className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">All caught up</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    You will be notified here for any updates on your projects and initiatives
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={() => markAsReadMutation.mutate(notification.id)}
                      onArchive={() => archiveMutation.mutate(notification.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="archived" className="mt-0">
              {!hasNotifications ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Archive className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">No archived notifications</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Archived notifications will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={() => markAsReadMutation.mutate(notification.id)}
                      onArchive={() => archiveMutation.mutate(notification.id)}
                      isArchived
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: () => void;
  onArchive: () => void;
  isArchived?: boolean;
}

function NotificationItem({ notification, onMarkAsRead, onArchive, isArchived }: NotificationItemProps) {
  const isUnread = notification.isRead === "false";

  return (
    <div
      className={`p-4 hover-elevate ${isUnread ? "bg-muted/30" : ""}`}
      data-testid={`notification-${notification.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-medium text-sm line-clamp-1">{notification.title}</h4>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {notification.message}
          </p>
          {notification.link && (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => window.location.href = notification.link!}
              data-testid={`notification-link-${notification.id}`}
            >
              View details →
            </button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              data-testid={`notification-menu-${notification.id}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isUnread && (
              <DropdownMenuItem onClick={onMarkAsRead} data-testid={`mark-read-${notification.id}`}>
                <Check className="h-4 w-4 mr-2" />
                Mark as read
              </DropdownMenuItem>
            )}
            {!isArchived && (
              <DropdownMenuItem onClick={onArchive} data-testid={`archive-${notification.id}`}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isUnread && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
      )}
    </div>
  );
}

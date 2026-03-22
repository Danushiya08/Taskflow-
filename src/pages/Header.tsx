import { useEffect, useState } from "react";
import { Bell, Search, ChevronDown, LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  currentUser: any;
  onLogout: () => void;
}

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  relatedProject?: {
    _id: string;
    name: string;
  } | null;
  relatedTask?: {
    _id: string;
    title: string;
    status?: string;
    dueDate?: string | null;
  } | null;
};

export function Header({ currentUser, onLogout }: HeaderProps) {
  const displayName = currentUser?.name || "User";
  const displayRole = currentUser?.role?.replace("-", " ") || "user";
  const avatarSrc =
    currentUser?.avatar ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const res = await api.get("/notifications");
      setNotifications(res.data?.notifications || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markOneAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);

      setNotifications((prev) =>
        prev.map((item) =>
          item._id === id ? { ...item, isRead: true } : item
        )
      );

      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");

      setNotifications((prev) =>
        prev.map((item) => ({ ...item, isRead: true }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read", error);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  return (
    <header className="bg-card border-b border-border px-6 py-4 text-card-foreground">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search projects, tasks, or team members..."
              className="pl-10 pr-4 bg-background text-foreground"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-96">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {notifications.length > 0 && unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Mark all as read
                  </button>
                )}
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              {loadingNotifications ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  No notifications yet.
                </div>
              ) : (
                notifications.slice(0, 8).map((notification) => (
                  <DropdownMenuItem
                    key={notification._id}
                    className="flex flex-col items-start gap-1 whitespace-normal py-3 cursor-pointer"
                    onClick={() => {
                      if (!notification.isRead) {
                        markOneAsRead(notification._id);
                      }
                    }}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="text-sm font-medium">
                        {notification.title}
                      </span>
                      {!notification.isRead && (
                        <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {notification.message}
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleString()}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-auto py-2 px-2">
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className="w-8 h-8 rounded-full border border-border object-cover"
                />
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium text-foreground">{displayName}</div>
                  <div className="text-xs text-muted-foreground capitalize">{displayRole}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem>
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>

              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={onLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
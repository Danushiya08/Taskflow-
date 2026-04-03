import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Search,
  ChevronDown,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import socket from "@/lib/socket";
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
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const visibleNotifications = useMemo(() => {
    return notifications.slice(0, 8);
  }, [notifications]);

  const formatRelativeTime = (dateString: string) => {
    const now = new Date().getTime();
    const time = new Date(dateString).getTime();
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return "Just now";

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min${diffInMinutes > 1 ? "s" : ""} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
    }

    return new Date(dateString).toLocaleString();
  };

  const loadNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const res = await api.get("/notifications");

      const fetchedNotifications = res.data?.notifications || [];
      const fetchedUnreadCount = res.data?.unreadCount || 0;

      setNotifications(fetchedNotifications);
      setUnreadCount(fetchedUnreadCount);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markOneAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);

      let wasUnread = false;

      setNotifications((prev) =>
        prev.map((item) => {
          if (item._id === id && !item.isRead) {
            wasUnread = true;
            return { ...item, isRead: true };
          }
          return item;
        })
      );

      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
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

  useEffect(() => {
    const userId = currentUser?._id || currentUser?.id;

    if (!userId) return;

    const registerUser = () => {
      socket.emit("register", String(userId));
    };

    if (socket.connected) {
      registerUser();
    }

    socket.on("connect", registerUser);

    return () => {
      socket.off("connect", registerUser);
    };
  }, [currentUser]);

  useEffect(() => {
    const handleLiveNotification = (notification: NotificationItem) => {
      let addedUnread = false;

      setNotifications((prev) => {
        const exists = prev.some((item) => item._id === notification._id);
        if (exists) return prev;

        if (!notification.isRead) {
          addedUnread = true;
        }

        return [notification, ...prev].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      if (addedUnread) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socket.on("new_notification", handleLiveNotification);

    return () => {
      socket.off("new_notification", handleLiveNotification);
    };
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
          <DropdownMenu
            open={isNotifOpen}
            onOpenChange={(open) => {
              setIsNotifOpen(open);
              if (open) {
                loadNotifications();
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative transition-transform hover:scale-105"
              >
                <Bell className="w-5 h-5" />

                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center shadow">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-96 p-0">
              <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold">Notifications</span>

                {notifications.length > 0 && unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Mark all as read
                  </button>
                )}
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              {loadingNotifications ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Loading notifications...
                </div>
              ) : visibleNotifications.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                  You’re all caught up 🎉
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  {visibleNotifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification._id}
                      className="flex flex-col items-start gap-1 whitespace-normal px-4 py-3 cursor-pointer border-b last:border-b-0"
                      onClick={() => {
                        if (!notification.isRead) {
                          markOneAsRead(notification._id);
                        }
                      }}
                    >
                      <div className="flex w-full items-start justify-between gap-3">
                        <span className="text-sm font-semibold leading-snug">
                          {notification.title}
                        </span>

                        {!notification.isRead && (
                          <span className="mt-1 w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground leading-relaxed">
                        {notification.message}
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(notification.createdAt)}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}

              {notifications.length > 8 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-4 py-3 text-center">
                    <button className="text-xs font-medium text-blue-600 hover:underline">
                      View all notifications
                    </button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 h-auto py-2 px-2"
              >
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className="w-8 h-8 rounded-full border border-border object-cover"
                />
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium text-foreground">
                    {displayName}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {displayRole}
                  </div>
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

              <DropdownMenuItem
                onClick={onLogout}
                className="text-red-600 focus:text-red-600"
              >
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
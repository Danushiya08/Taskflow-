import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Bell,
  Lock,
  Globe,
  Palette,
  Shield,
  Mail,
  Smartphone,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

type ProfileState = {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  bio: string;
  avatar: string;
  role: string;
};

type NotificationsState = {
  emailNotifications: boolean;
  pushNotifications: boolean;
  taskUpdates: boolean;
  projectMilestones: boolean;
  teamMentions: boolean;
  weeklyReports: boolean;
};

type PreferencesState = {
  language: string;
  timezone: string;
  dateFormat: string;
  theme: string;
  defaultProjectView: string;
  compactMode: boolean;
  showCompletedTasks: boolean;
};

type SecurityState = {
  twoFactorEnabled: boolean;
};

type PasswordState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const applyTheme = (theme: string) => {
  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("dark");
    localStorage.setItem("theme", "dark");
    return;
  }

  if (theme === "light") {
    root.classList.remove("dark");
    localStorage.setItem("theme", "light");
    return;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle("dark", prefersDark);
  localStorage.setItem("theme", "auto");
};

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [saving2FA, setSaving2FA] = useState(false);

  const [profile, setProfile] = useState<ProfileState>({
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
    department: "",
    bio: "",
    avatar: "",
    role: "",
  });

  const [notifications, setNotifications] = useState<NotificationsState>({
    emailNotifications: true,
    pushNotifications: true,
    taskUpdates: true,
    projectMilestones: true,
    teamMentions: true,
    weeklyReports: false,
  });

  const [preferences, setPreferences] = useState<PreferencesState>({
    language: "en",
    timezone: "gmt",
    dateFormat: "mdy",
    theme: "light",
    defaultProjectView: "kanban",
    compactMode: false,
    showCompletedTasks: true,
  });

  const [security, setSecurity] = useState<SecurityState>({
    twoFactorEnabled: false,
  });

  const [passwordData, setPasswordData] = useState<PasswordState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/settings/me");

      setProfile({
        name: data?.profile?.name || "",
        firstName: data?.profile?.firstName || "",
        lastName: data?.profile?.lastName || "",
        email: data?.profile?.email || "",
        phone: data?.profile?.phone || "",
        jobTitle: data?.profile?.jobTitle || "",
        department: data?.profile?.department || "",
        bio: data?.profile?.bio || "",
        avatar: data?.profile?.avatar || "",
        role: data?.profile?.role || "",
      });

      setNotifications({
        emailNotifications: data?.notifications?.emailNotifications ?? true,
        pushNotifications: data?.notifications?.pushNotifications ?? true,
        taskUpdates: data?.notifications?.taskUpdates ?? true,
        projectMilestones: data?.notifications?.projectMilestones ?? true,
        teamMentions: data?.notifications?.teamMentions ?? true,
        weeklyReports: data?.notifications?.weeklyReports ?? false,
      });

      const loadedPreferences = {
        language: data?.preferences?.language || "en",
        timezone: data?.preferences?.timezone || "gmt",
        dateFormat: data?.preferences?.dateFormat || "mdy",
        theme: data?.preferences?.theme || "light",
        defaultProjectView: data?.preferences?.defaultProjectView || "kanban",
        compactMode: data?.preferences?.compactMode ?? false,
        showCompletedTasks: data?.preferences?.showCompletedTasks ?? true,
      };

      setPreferences(loadedPreferences);
      applyTheme(loadedPreferences.theme);

      setSecurity({
        twoFactorEnabled: data?.security?.twoFactorEnabled ?? false,
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);

      const payload = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        jobTitle: profile.jobTitle,
        department: profile.department,
        bio: profile.bio,
        avatar: profile.avatar,
      };

      const { data } = await api.put("/settings/profile", payload);

      setProfile((prev) => ({
        ...prev,
        ...data.profile,
      }));

      toast.success(data?.message || "Profile settings saved successfully!");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSavingNotifications(true);
      const { data } = await api.put("/settings/notifications", notifications);

      setNotifications(data.notifications);

      toast.success(data?.message || "Notification preferences updated!");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to save notification settings");
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleSaveSecurity = async () => {
    try {
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        toast.error("Please fill in all password fields");
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast.error("New password and confirm password do not match");
        return;
      }

      setSavingPassword(true);

      const { data } = await api.put("/settings/password", passwordData);

      toast.success(data?.message || "Password updated successfully");

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPreferences(true);
      const { data } = await api.put("/settings/preferences", preferences);

      setPreferences(data.preferences);
      applyTheme(data?.preferences?.theme || "light");

      toast.success(data?.message || "Preferences saved!");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to save preferences");
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleToggle2FA = async () => {
    try {
      setSaving2FA(true);

      const newValue = !security.twoFactorEnabled;

      const { data } = await api.put("/settings/2fa", {
        enabled: newValue,
      });

      setSecurity({
        twoFactorEnabled: data?.security?.twoFactorEnabled ?? newValue,
      });

      toast.success(data?.message || "2FA setting updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update 2FA");
    } finally {
      setSaving2FA(false);
    }
  };

  const displayName =
    `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.name || "User";

  const displayRole = profile.role
    ? profile.role
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "User";

  const avatarSeed = displayName || "TaskFlow";

  if (loading) {
    return (
      <div className="p-6 bg-background text-foreground">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background text-foreground">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Palette className="w-4 h-4 mr-2" />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information and profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <img
                    src={
                      profile.avatar ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`
                    }
                    alt="Profile"
                    className="w-24 h-24 rounded-full"
                  />
                  <Button
                    size="sm"
                    type="button"
                    className="absolute bottom-0 right-0 rounded-full"
                    onClick={() => toast.info("You can connect avatar upload later if needed")}
                  >
                    Change
                  </Button>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-card-foreground">{displayName}</h3>
                  <p className="text-sm text-muted-foreground">{displayRole}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input
                    id="first-name"
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input
                    id="last-name"
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-title">Job Title</Label>
                <Input
                  id="job-title"
                  value={profile.jobTitle}
                  onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={profile.department || ""}
                  onValueChange={(value) => setProfile({ ...profile, department: value })}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="engineering">Engineering</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  <Save className="w-4 h-4 mr-2" />
                  {savingProfile ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure how and when you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-card-foreground mb-4">Notification Channels</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-card-foreground">Email Notifications</p>
                        <p className="text-xs text-muted-foreground">Receive notifications via email</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.emailNotifications}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          emailNotifications: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-card-foreground">Push Notifications</p>
                        <p className="text-xs text-muted-foreground">Receive push notifications in browser</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.pushNotifications}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          pushNotifications: checked,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium text-card-foreground mb-4">Notification Types</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-card-foreground">Task Updates</p>
                      <p className="text-xs text-muted-foreground">Notifications when tasks are updated</p>
                    </div>
                    <Switch
                      checked={notifications.taskUpdates}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          taskUpdates: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-card-foreground">Project Milestones</p>
                      <p className="text-xs text-muted-foreground">Alerts for milestone completions</p>
                    </div>
                    <Switch
                      checked={notifications.projectMilestones}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          projectMilestones: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-card-foreground">Team Mentions</p>
                      <p className="text-xs text-muted-foreground">Notify when someone mentions you</p>
                    </div>
                    <Switch
                      checked={notifications.teamMentions}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          teamMentions: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-card-foreground">Weekly Reports</p>
                      <p className="text-xs text-muted-foreground">Receive weekly activity summaries</p>
                    </div>
                    <Switch
                      checked={notifications.weeklyReports}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          weeklyReports: checked,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} disabled={savingNotifications}>
                  <Save className="w-4 h-4 mr-2" />
                  {savingNotifications ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-6">
            <Card className="border-border bg-card text-card-foreground">
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSecurity} disabled={savingPassword}>
                    <Save className="w-4 h-4 mr-2" />
                    {savingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card text-card-foreground">
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>Add an extra layer of security to your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-card-foreground">Two-Factor Authentication</p>
                      <p className="text-xs text-muted-foreground">
                        {security.twoFactorEnabled
                          ? "Your account is protected with 2FA"
                          : "Protect your account with 2FA"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleToggle2FA}
                    disabled={saving2FA}
                  >
                    {saving2FA
                      ? "Saving..."
                      : security.twoFactorEnabled
                      ? "Disable 2FA"
                      : "Enable 2FA"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card text-card-foreground">
              <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>Manage your active login sessions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-card-foreground">Chrome on Windows</p>
                        <p className="text-xs text-muted-foreground">Current session • Colombo, Sri Lanka</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" disabled>
                      Active
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-card-foreground">Safari on iPhone</p>
                        <p className="text-xs text-muted-foreground">Last active 2 days ago • Colombo, Sri Lanka</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info("Session revoke can be connected later")}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>Application Preferences</CardTitle>
              <CardDescription>Customize your TaskFlow experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={preferences.language}
                  onValueChange={(value) =>
                    setPreferences({ ...preferences, language: value })
                  }
                >
                  <SelectTrigger id="language">
                    <Globe className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ta">Tamil</SelectItem>
                    <SelectItem value="si">Sinhala</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Time Zone</Label>
                <Select
                  value={preferences.timezone}
                  onValueChange={(value) =>
                    setPreferences({ ...preferences, timezone: value })
                  }
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="est">Eastern Time (ET)</SelectItem>
                    <SelectItem value="pst">Pacific Time (PT)</SelectItem>
                    <SelectItem value="cst">Central Time (CT)</SelectItem>
                    <SelectItem value="gmt">GMT</SelectItem>
                    <SelectItem value="ist">India Standard Time (IST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-format">Date Format</Label>
                <Select
                  value={preferences.dateFormat}
                  onValueChange={(value) =>
                    setPreferences({ ...preferences, dateFormat: value })
                  }
                >
                  <SelectTrigger id="date-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={preferences.theme}
                  onValueChange={(value) =>
                    setPreferences({ ...preferences, theme: value })
                  }
                >
                  <SelectTrigger id="theme">
                    <Palette className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="auto">Auto (System)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-view">Default Project View</Label>
                <Select
                  value={preferences.defaultProjectView}
                  onValueChange={(value) =>
                    setPreferences({ ...preferences, defaultProjectView: value })
                  }
                >
                  <SelectTrigger id="default-view">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kanban">Kanban Board</SelectItem>
                    <SelectItem value="list">List View</SelectItem>
                    <SelectItem value="calendar">Calendar</SelectItem>
                    <SelectItem value="timeline">Timeline/Gantt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-card-foreground">Display Options</h4>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-card-foreground">Compact Mode</p>
                    <p className="text-xs text-muted-foreground">Show more content in less space</p>
                  </div>
                  <Switch
                    checked={preferences.compactMode}
                    onCheckedChange={(checked) =>
                      setPreferences({ ...preferences, compactMode: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-card-foreground">Show Completed Tasks</p>
                    <p className="text-xs text-muted-foreground">Display completed tasks in task lists</p>
                  </div>
                  <Switch
                    checked={preferences.showCompletedTasks}
                    onCheckedChange={(checked) =>
                      setPreferences({
                        ...preferences,
                        showCompletedTasks: checked,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSavePreferences} disabled={savingPreferences}>
                  <Save className="w-4 h-4 mr-2" />
                  {savingPreferences ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
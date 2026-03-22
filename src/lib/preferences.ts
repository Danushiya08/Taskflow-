export type DateFormatPreference = "mdy" | "dmy" | "ymd";
export type ThemePreference = "light" | "dark" | "auto";

export type UserPreferences = {
  language: string;
  timezone: string;
  dateFormat: DateFormatPreference;
  theme: ThemePreference;
  defaultProjectView: string;
  compactMode: boolean;
  showCompletedTasks: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: "en",
  timezone: "gmt",
  dateFormat: "mdy",
  theme: "light",
  defaultProjectView: "kanban",
  compactMode: false,
  showCompletedTasks: true,
};
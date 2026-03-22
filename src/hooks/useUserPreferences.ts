import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";

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

const DEFAULT_PREFERENCES: UserPreferences = {
  language: "en",
  timezone: "gmt",
  dateFormat: "mdy",
  theme: "light",
  defaultProjectView: "kanban",
  compactMode: false,
  showCompletedTasks: true,
};

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loadingPreferences, setLoadingPreferences] = useState(true);

  const loadPreferences = useCallback(async (): Promise<UserPreferences> => {
    try {
      setLoadingPreferences(true);

      const res = await api.get("/settings/me");
      const prefs = res?.data?.preferences || {};

      const normalized: UserPreferences = {
        language: prefs.language || "en",
        timezone: prefs.timezone || "gmt",
        dateFormat: (prefs.dateFormat as DateFormatPreference) || "mdy",
        theme: (prefs.theme as ThemePreference) || "light",
        defaultProjectView: prefs.defaultProjectView || "kanban",
        compactMode: prefs.compactMode ?? false,
        showCompletedTasks: prefs.showCompletedTasks ?? true,
      };

      setPreferences(normalized);
      return normalized;
    } catch (error) {
      setPreferences(DEFAULT_PREFERENCES);
      return DEFAULT_PREFERENCES;
    } finally {
      setLoadingPreferences(false);
    }
  }, []);

  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>) => {
      const nextPreferences: UserPreferences = {
        ...preferences,
        ...updates,
      };

      setPreferences(nextPreferences);

      try {
        await api.put("/settings/me", nextPreferences);
        return nextPreferences;
      } catch (error) {
        await loadPreferences();
        throw error;
      }
    },
    [preferences, loadPreferences]
  );

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    loadingPreferences,
    reloadPreferences: loadPreferences,
    updatePreferences,
  };
}
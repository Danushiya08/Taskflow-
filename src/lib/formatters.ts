import type { DateFormatPreference } from "@/lib/preferences";

export const mapTimezonePreference = (tz?: string) => {
  switch ((tz || "").toLowerCase()) {
    case "gmt":
      return "Etc/GMT";
    case "ist":
      return "Asia/Colombo";
    case "est":
      return "America/New_York";
    case "pst":
      return "America/Los_Angeles";
    case "cst":
      return "America/Chicago";
    default:
      return "Etc/GMT";
  }
};

export const formatDateByPreference = (
  value: string | Date | null | undefined,
  dateFormat: DateFormatPreference = "mdy"
) => {
  if (!value) return "-";

  const d = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(d.getTime())) return String(value);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  if (dateFormat === "dmy") return `${day}/${month}/${year}`;
  if (dateFormat === "ymd") return `${year}-${month}-${day}`;

  return `${month}/${day}/${year}`;
};

export const formatDateTimeByPreference = (
  value: string | Date | null | undefined,
  dateFormat: DateFormatPreference = "mdy"
) => {
  if (!value) return "-";

  const d = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(d.getTime())) return String(value);

  const datePart = formatDateByPreference(d, dateFormat);

  const timePart = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${datePart} ${timePart}`;
};

export const getCompactClasses = (compactMode: boolean) => {
  return {
    page: compactMode ? "p-4 space-y-4" : "p-6 space-y-6",
    card: compactMode ? "p-3" : "p-4",
    gap: compactMode ? "gap-4" : "gap-6",
    section: compactMode ? "space-y-3" : "space-y-4",
  };
};
import type { DateFormatPreference } from "@/hooks/useUserPreferences";

export const formatDateByPreference = (
  value: string | null | undefined,
  dateFormat: DateFormatPreference,
  timezone?: string
) => {
  if (!value) return "";

  if (timezone) {
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return String(value);

    const formatter =
      dateFormat === "dmy"
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: timezone,
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : dateFormat === "ymd"
        ? new Intl.DateTimeFormat("sv-SE", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
        : new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          });

    return formatter.format(d);
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  if (dateFormat === "dmy") return `${day}/${month}/${year}`;
  if (dateFormat === "ymd") return `${year}-${month}-${day}`;
  return `${month}/${day}/${year}`;
};

export const formatTimeWithTimezone = (
  date: string,
  time: string | undefined,
  timezone: string
) => {
  if (!time) return "";

  const iso = `${date}T${time}:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return time;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
};
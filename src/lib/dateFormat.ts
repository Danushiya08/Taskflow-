import type { DateFormatPreference } from "@/hooks/useUserPreferences";

const parseDateSafely = (value: string) => {
  if (!value) return null;

  // Handle plain YYYY-MM-DD safely without timezone shifting
  const plainDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plainDateMatch) {
    const [, y, m, d] = plainDateMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
};

export const formatDateByPreference = (
  value: string | null | undefined,
  dateFormat: DateFormatPreference,
  timezone?: string
) => {
  if (!value) return "";

  const d = parseDateSafely(value);
  if (!d) return String(value);

  if (timezone) {
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

  const safeDate = parseDateSafely(date);
  if (!safeDate) return time;

  const [hours = "0", minutes = "0"] = time.split(":");

  const combined = new Date(
    safeDate.getFullYear(),
    safeDate.getMonth(),
    safeDate.getDate(),
    Number(hours),
    Number(minutes),
    0
  );

  if (Number.isNaN(combined.getTime())) return time;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(combined);
};
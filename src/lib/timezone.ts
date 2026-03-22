export const mapTimezonePreference = (tz: string) => {
  switch (tz) {
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
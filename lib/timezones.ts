/** Modern IANA names are aliases missing from some ICU enumeration versions. */
const modernNames: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Godthab": "America/Nuuk",
};

export function timezoneOptions(current: string, supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []) {
  return Array.from(new Set([current, "UTC", ...Object.values(modernNames), ...supported.map((zone) => modernNames[zone] ?? zone)]))
    .filter((zone) => { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; } });
}

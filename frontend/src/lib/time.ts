export function formatRelativeTime(
  value: string,
  now = Date.now(),
  locale = "en"
) {
  const date = new Date(value).getTime();
  const diff = date - now;
  const absSeconds = Math.abs(Math.round(diff / 1000));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (absSeconds < 60) return formatter.format(Math.round(diff / 1000), "second");
  if (absSeconds < 3600) return formatter.format(Math.round(diff / 60000), "minute");
  if (absSeconds < 86400) return formatter.format(Math.round(diff / 3600000), "hour");
  if (absSeconds < 604800) return formatter.format(Math.round(diff / 86400000), "day");
  return formatter.format(Math.round(diff / 604800000), "week");
}

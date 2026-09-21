const LOCAL_ORIGIN = "https://local.invalid";

export function safeNextPath(
  value: string | null | undefined,
  fallback = "/summary",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, LOCAL_ORIGIN);
    return parsed.origin === LOCAL_ORIGIN
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

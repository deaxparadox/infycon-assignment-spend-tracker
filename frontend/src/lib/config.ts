export function getApiBaseUrl(
  rawValue: string | undefined = process.env.NEXT_PUBLIC_API_URL,
): string {
  const value = rawValue?.trim();

  if (!value) {
    throw new Error("NEXT_PUBLIC_API_URL is required.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be an absolute URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("NEXT_PUBLIC_API_URL must use http or https.");
  }

  return url.toString().replace(/\/$/, "");
}

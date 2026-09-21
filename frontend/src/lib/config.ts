export function getApiBaseUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const value = environment.NEXT_PUBLIC_API_URL?.trim();

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

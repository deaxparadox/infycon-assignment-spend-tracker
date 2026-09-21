export type PageSearchParams = Record<string, string | string[] | undefined>;

export function serializeSearchParams(params: PageSearchParams): string {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => result.append(key, item));
    } else if (value !== undefined) {
      result.append(key, value);
    }
  }
  return result.toString();
}

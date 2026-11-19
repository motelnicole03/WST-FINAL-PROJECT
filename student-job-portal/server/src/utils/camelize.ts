/** Converts database column names (snake_case) to JSON keys (camelCase), recursively. */
export function camelize<T = unknown>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((item) => camelize(item)) as T;
  }
  if (input instanceof Date) {
    return input as T;
  }
  if (input !== null && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
        camelize(value),
      ]),
    ) as T;
  }
  return input as T;
}

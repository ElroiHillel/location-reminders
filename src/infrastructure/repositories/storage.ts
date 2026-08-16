export function isNullish(value: string | null): value is null {
  return value === null;
}

export function serializeDate(value: Date): string {
  return value.toISOString();
}

export function deserializeDate(value: string): Date {
  return new Date(value);
}
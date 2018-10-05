export function important<T>(from: T | null | undefined, message?: string): T {
  if (from) {
    return from;
  } else {
    throw new Error(message || 'Undefined variable error');
  }
}

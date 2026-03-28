interface ConcretePathThreadRules {
  host: string;
  concretePrefix: string;
}

export function resolvePathThreadId(url: string, fallbackThreadId: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || fallbackThreadId;
  } catch {
    return fallbackThreadId;
  }
}

export function isPlaceholderPathThreadId(threadId: string, placeholderThreadId: string): boolean {
  return threadId === placeholderThreadId;
}

export function isConcretePathThreadId(threadId: string, concretePrefix: string): boolean {
  return threadId.startsWith(concretePrefix) && threadId.length > concretePrefix.length;
}

export function resolveConcretePathThreadId(
  url: string | undefined,
  { host, concretePrefix }: ConcretePathThreadRules
): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.host !== host) return undefined;
    return isConcretePathThreadId(parsed.pathname, concretePrefix) ? parsed.pathname : undefined;
  } catch {
    return undefined;
  }
}

export type { ConcretePathThreadRules };

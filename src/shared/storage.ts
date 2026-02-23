export class StorageClient {
  async set<T>(key: string, value: T): Promise<void> {
    const localStorageApi = getChromeLocalStorage();
    if (!localStorageApi) return;
    await localStorageApi.set({ [key]: value });
  }

  async get<T>(key: string): Promise<T | undefined> {
    const localStorageApi = getChromeLocalStorage();
    if (!localStorageApi) return undefined;
    const result = await localStorageApi.get(key);
    return result[key] as T | undefined;
  }
}

interface ChromeLocalStorageApi {
  set(items: Record<string, unknown>): Promise<void> | void;
  get(key: string): Promise<Record<string, unknown>> | Record<string, unknown>;
}

function getChromeLocalStorage(): ChromeLocalStorageApi | undefined {
  const chromeApi = (globalThis as { chrome?: { storage?: { local?: ChromeLocalStorageApi } } }).chrome;
  return chromeApi?.storage?.local;
}

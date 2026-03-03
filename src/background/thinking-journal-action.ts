interface ActionApi {
  onClicked?: {
    addListener(listener: () => void): void;
  };
  setTitle?(details: { title: string }): Promise<void> | void;
}

interface TabsApi {
  create(details: { url: string }): Promise<unknown> | unknown;
}

interface RuntimeApi {
  getURL(path: string): string;
}

interface ChromeApi {
  action?: ActionApi;
  tabs?: TabsApi;
  runtime?: RuntimeApi;
}

export function registerThinkingJournalActionHandler(
  chromeApi: ChromeApi = (globalThis as { chrome?: ChromeApi }).chrome || {}
): void {
  const actionApi = chromeApi.action;
  const onClicked = actionApi?.onClicked;
  if (!onClicked) return;

  void actionApi?.setTitle?.({ title: 'Open Thinking Journal' });

  onClicked.addListener(() => {
    const url = chromeApi.runtime?.getURL('thinking-journal.html') ?? 'thinking-journal.html';
    void chromeApi.tabs?.create({ url });
  });
}

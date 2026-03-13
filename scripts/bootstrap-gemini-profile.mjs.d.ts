export function getChromeArgs(params: {
  cdpPort: string;
  extensionPath: string;
  userDataDir: string;
}): string[];

export function main(): void;

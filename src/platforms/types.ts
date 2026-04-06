import type { PlatformId } from '../shared/platform-id';

export type PlatformSkin = 'default' | 'claude';

export interface PlatformAppearance {
  skin: PlatformSkin;
}

export interface PlatformDefinition {
  id: PlatformId;
  appearance: PlatformAppearance;
  hosts: readonly string[];
  matches: readonly string[];
  resolveThreadId(url: string): string;
  isPlaceholderThreadId(threadId: string): boolean;
  isConcreteThreadId(threadId: string): boolean;
  resolveConcreteThreadId(url: string | undefined): string | undefined;
  findComposer(root?: ParentNode): HTMLElement | null;
  resolveComposerNear(element: Element | null): HTMLElement | null;
  findComposerAnchor(composer: HTMLElement): HTMLElement | null;
  isSendButton(button: HTMLButtonElement): boolean;
  readPrompt(composer: HTMLElement): string;
}

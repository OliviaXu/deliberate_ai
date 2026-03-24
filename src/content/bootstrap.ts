import './mode-modal.tokens.css';
import './mode-modal.css';
import './reflection-hint.css';
import './reflection-modal.css';
import type { PlatformDefinition } from '../platforms';
import { resolvePlatformFromUrl } from '../platforms';
import { startContentApp, type ContentAppDependencies } from './app';

export type BootContentAppDependencies = Omit<ContentAppDependencies, 'platform'> & {
  platform?: PlatformDefinition;
};

export function bootContentApp(dependencies: BootContentAppDependencies): void {
  const platform = dependencies.platform ?? resolvePlatformFromUrl(window.location.href);
  if (!platform) return;
  void startContentApp({ ...dependencies, platform });
}

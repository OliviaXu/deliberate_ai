import './mode-modal.tokens.css';
import './mode-modal.css';
import './reflection-hint.css';
import './reflection-modal.css';
import { startContentApp, type ContentAppDependencies } from './app';

export function bootContentApp(dependencies: ContentAppDependencies): void {
  void startContentApp(dependencies);
}

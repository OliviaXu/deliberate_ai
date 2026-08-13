import type { PlatformDefinition } from '../platforms';
import type { ResurfacingCandidate } from '../shared/types';
import { resolveDeliberateTheme } from './theme';

interface ResurfacingGlintOptions {
  onOpen: (learningCycleRecordId: string) => Promise<void> | void;
  platform: Pick<PlatformDefinition, 'appearance' | 'findComposer' | 'findComposerAnchor'>;
}

export class ResurfacingGlint {
  private root: HTMLButtonElement | null = null;
  private anchor: HTMLElement | null = null;
  private currentRecordId = '';
  private readonly onOpen: (learningCycleRecordId: string) => Promise<void> | void;

  constructor(private readonly options: ResurfacingGlintOptions) {
    this.onOpen = options.onOpen;
  }

  show(candidate: ResurfacingCandidate): void {
    this.currentRecordId = candidate.learningCycleRecordId;
    const root = this.getOrCreateRoot();
    root.setAttribute('data-deliberate-theme', resolveDeliberateTheme());
    const excerpt = root.querySelector('[data-testid="deliberate-resurfacing-glint-excerpt"]');
    if (excerpt) excerpt.textContent = candidate.excerpt;

    if (!this.attachToComposer(root)) {
      if (this.anchor) {
        this.anchor.classList.remove('deliberate-resurfacing-glint-anchor');
        this.anchor = null;
      }
      document.body.appendChild(root);
    }
  }

  refreshAnchor(): void {
    if (this.root) this.attachToComposer(this.root);
  }

  private attachToComposer(root: HTMLButtonElement): boolean {
    const composer = this.options.platform.findComposer();
    const anchor = composer ? this.options.platform.findComposerAnchor(composer) : null;
    if (!anchor) return false;

    if (this.anchor && this.anchor !== anchor) {
      this.anchor.classList.remove('deliberate-resurfacing-glint-anchor');
    }
    anchor.classList.add('deliberate-resurfacing-glint-anchor');
    anchor.appendChild(root);
    this.anchor = anchor;
    return true;
  }

  private getOrCreateRoot(): HTMLButtonElement {
    if (this.root) return this.root;

    const root = document.createElement('button');
    root.type = 'button';
    root.className = 'deliberate-resurfacing-glint';
    root.setAttribute('data-testid', 'deliberate-resurfacing-glint');
    root.setAttribute('data-deliberate-platform-skin', this.options.platform.appearance.skin);
    root.setAttribute('aria-label', 'Open a returned thought in the Thinking Journal');

    const label = document.createElement('span');
    label.className = 'deliberate-resurfacing-glint__label';
    label.textContent = 'A thought returned —';

    const excerpt = document.createElement('span');
    excerpt.className = 'deliberate-resurfacing-glint__excerpt';
    excerpt.setAttribute('data-testid', 'deliberate-resurfacing-glint-excerpt');

    const arrow = document.createElement('span');
    arrow.className = 'deliberate-resurfacing-glint__arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';

    root.append(label, excerpt, arrow);
    root.addEventListener('click', () => {
      void this.onOpen(this.currentRecordId);
    });
    this.root = root;
    return root;
  }
}

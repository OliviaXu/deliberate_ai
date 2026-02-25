import type { InteractionMode } from '../shared/types';

const MODAL_ROOT_ID = 'deliberate-mode-modal-root';

export class ModeSelectionModal {
  private pending: Promise<InteractionMode> | null = null;

  open(): Promise<InteractionMode> {
    if (this.pending) return this.pending;
    this.pending = this.render();
    return this.pending;
  }

  private render(): Promise<InteractionMode> {
    return new Promise<InteractionMode>((resolve) => {
      const existing = document.getElementById(MODAL_ROOT_ID);
      if (existing) existing.remove();

      const root = document.createElement('div');
      root.id = MODAL_ROOT_ID;
      root.setAttribute('data-testid', 'deliberate-mode-modal');
      root.style.position = 'fixed';
      root.style.inset = '0';
      root.style.zIndex = '2147483647';
      root.style.background = 'rgba(10, 10, 10, 0.35)';
      root.style.display = 'flex';
      root.style.alignItems = 'center';
      root.style.justifyContent = 'center';

      const panel = document.createElement('section');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.style.width = 'min(420px, calc(100vw - 24px))';
      panel.style.background = '#fff';
      panel.style.border = '1px solid #ddd';
      panel.style.borderRadius = '12px';
      panel.style.padding = '16px';
      panel.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.18)';
      panel.style.fontFamily = 'system-ui, -apple-system, sans-serif';

      const title = document.createElement('h2');
      title.textContent = 'What kind of thinking is this?';
      title.style.fontSize = '16px';
      title.style.margin = '0 0 12px';

      panel.appendChild(title);
      panel.appendChild(this.makeModeButton('delegation', 'Delegating a mundane task', resolve, root));
      panel.appendChild(this.makeModeButton('problem_solving', 'Solving a core problem', resolve, root));
      panel.appendChild(this.makeModeButton('learning', 'Learning / exploring', resolve, root));
      root.appendChild(panel);
      document.body.appendChild(root);
    });
  }

  private makeModeButton(
    mode: InteractionMode,
    label: string,
    resolve: (mode: InteractionMode) => void,
    root: HTMLDivElement
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-testid', `deliberate-mode-option-${mode}`);
    button.style.width = '100%';
    button.style.display = 'block';
    button.style.margin = '8px 0 0';
    button.style.padding = '10px 12px';
    button.style.textAlign = 'left';
    button.style.borderRadius = '8px';
    button.style.border = '1px solid #cfd3d8';
    button.style.background = '#f7f9fc';
    button.style.cursor = 'pointer';
    button.textContent = label;
    button.addEventListener('click', () => {
      root.remove();
      this.pending = null;
      resolve(mode);
    });
    return button;
  }
}

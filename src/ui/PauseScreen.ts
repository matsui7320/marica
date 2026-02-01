export class PauseScreen {
  private container: HTMLElement;
  private el: HTMLDivElement | null = null;
  private resumeCallback: (() => void) | null = null;
  private quitCallback: (() => void) | null = null;
  private onKey: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.container = document.getElementById('ui-overlay')!;
  }

  show(onResume: () => void, onQuit: () => void): void {
    if (this.el) return;

    this.resumeCallback = onResume;
    this.quitCallback = onQuit;

    this.el = document.createElement('div');
    this.el.className = 'pause-screen';
    this.el.innerHTML = `
      <div class="pause-title">PAUSED</div>
      <div class="pause-menu">
        <button class="pause-btn pause-resume-btn">RESUME</button>
        <button class="pause-btn pause-quit-btn">BACK TO MENU</button>
      </div>
      <div class="pause-hint">Press ESC or P to resume</div>
    `;

    this.el.querySelector('.pause-resume-btn')!
      .addEventListener('click', () => this.resume());
    this.el.querySelector('.pause-quit-btn')!
      .addEventListener('click', () => this.quit());

    this.onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        this.resume();
      }
    };
    document.addEventListener('keydown', this.onKey);

    this.container.appendChild(this.el);
  }

  private resume(): void {
    const cb = this.resumeCallback;
    this.hide();
    if (cb) cb();
  }

  private quit(): void {
    const cb = this.quitCallback;
    this.hide();
    if (cb) cb();
  }

  hide(): void {
    if (this.onKey) {
      document.removeEventListener('keydown', this.onKey);
      this.onKey = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.resumeCallback = null;
    this.quitCallback = null;
  }

  get isVisible(): boolean {
    return this.el !== null;
  }
}

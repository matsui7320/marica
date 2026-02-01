export class Debug {
  private el: HTMLDivElement;
  private visible = false;
  private data: Map<string, string> = new Map();

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: fixed; top: 5px; left: 5px;
      background: rgba(0,0,0,0.7); color: #0f0;
      font-family: monospace; font-size: 12px;
      padding: 8px; z-index: 100; pointer-events: none;
      white-space: pre; display: none;
    `;
    document.body.appendChild(this.el);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') {
        this.visible = !this.visible;
        this.el.style.display = this.visible ? 'block' : 'none';
      }
    });
  }

  set(key: string, value: string | number): void {
    this.data.set(key, String(typeof value === 'number' ? value.toFixed(2) : value));
  }

  update(): void {
    if (!this.visible) return;
    let text = '';
    for (const [k, v] of this.data) {
      text += `${k}: ${v}\n`;
    }
    this.el.textContent = text;
  }

  dispose(): void {
    this.el.remove();
  }
}

export class CountdownOverlay {
  private el: HTMLDivElement;
  private numberEl: HTMLDivElement;
  private lightsEl: HTMLDivElement;
  private lights: HTMLDivElement[] = [];
  private lastSec = -1;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'countdown-overlay';
    this.el.style.display = 'none';

    this.numberEl = document.createElement('div');
    this.numberEl.className = 'countdown-number';
    this.el.appendChild(this.numberEl);

    // Traffic lights
    this.lightsEl = document.createElement('div');
    this.lightsEl.className = 'countdown-lights';
    for (let i = 0; i < 3; i++) {
      const light = document.createElement('div');
      light.className = 'countdown-light';
      this.lightsEl.appendChild(light);
      this.lights.push(light);
    }
    this.el.appendChild(this.lightsEl);

    document.getElementById('ui-overlay')!.appendChild(this.el);
  }

  show(timer: number): void {
    this.el.style.display = 'flex';
    const sec = Math.ceil(timer);

    if (sec !== this.lastSec) {
      this.lastSec = sec;

      if (sec <= 0) {
        // GO!
        this.numberEl.textContent = 'GO!';
        this.numberEl.className = 'countdown-number go';
        // All lights green
        for (const l of this.lights) {
          l.className = 'countdown-light green';
        }
      } else if (sec <= 3) {
        this.numberEl.textContent = String(sec);
        // Class for color
        const cls = sec === 1 ? 'one' : sec === 2 ? 'two' : 'three';
        this.numberEl.className = `countdown-number ${cls}`;

        // Force animation restart
        void this.numberEl.offsetWidth;
        this.numberEl.style.animation = 'none';
        void this.numberEl.offsetWidth;
        this.numberEl.style.animation = '';

        // Light up red lights from right to left
        for (let i = 0; i < 3; i++) {
          this.lights[i].className = i >= (3 - sec) ? 'countdown-light red' : 'countdown-light';
        }
      } else {
        this.numberEl.textContent = '';
        for (const l of this.lights) {
          l.className = 'countdown-light';
        }
      }
    }
  }

  hide(): void {
    this.el.style.display = 'none';
    this.lastSec = -1;
  }

  destroy(): void {
    this.el.remove();
  }
}

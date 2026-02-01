export class LightningFlash {
  private timer = 0;
  private overlay: HTMLDivElement | null = null;
  private bolts: HTMLCanvasElement | null = null;

  trigger(): void {
    this.timer = 0.35;

    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;';
      document.body.appendChild(this.overlay);
    }

    // Create lightning bolt canvas
    if (this.bolts) this.bolts.remove();
    this.bolts = document.createElement('canvas');
    this.bolts.width = window.innerWidth;
    this.bolts.height = window.innerHeight;
    this.bolts.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    this.overlay.appendChild(this.bolts);

    this.drawBolts();
    this.overlay.style.background = 'rgba(200,220,255,0.3)';
    this.overlay.style.display = 'block';
    this.overlay.style.opacity = '1';
  }

  private drawBolts(): void {
    if (!this.bolts) return;
    const ctx = this.bolts.getContext('2d')!;
    const w = this.bolts.width;
    const h = this.bolts.height;
    ctx.clearRect(0, 0, w, h);

    // Draw 1 lightning bolt
    for (let b = 0; b < 1; b++) {
      const startX = w * 0.2 + Math.random() * w * 0.6;
      const segments = 12 + Math.floor(Math.random() * 8);

      // Main bolt
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#88aaff';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      let x = startX;
      let y = 0;
      ctx.moveTo(x, y);
      for (let i = 0; i < segments; i++) {
        x += (Math.random() - 0.5) * 80;
        y += h / segments + Math.random() * 20;
        ctx.lineTo(x, y);

        // Branch bolt
        if (Math.random() > 0.6) {
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
          const branchLen = 3 + Math.floor(Math.random() * 4);
          let bx = x, by = y;
          ctx.strokeStyle = 'rgba(200,220,255,0.5)';
          ctx.lineWidth = 1.5;
          for (let j = 0; j < branchLen; j++) {
            bx += (Math.random() - 0.5) * 60;
            by += h / segments * 0.5;
            ctx.lineTo(bx, by);
          }
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 3;
        }
      }
      ctx.stroke();

      // Glow pass
      ctx.strokeStyle = 'rgba(100,150,255,0.3)';
      ctx.lineWidth = 12;
      ctx.shadowBlur = 40;
      ctx.beginPath();
      x = startX;
      y = 0;
      ctx.moveTo(x, y);
      const rng2 = Math.random;
      for (let i = 0; i < segments; i++) {
        x += (rng2() - 0.5) * 80;
        y += h / segments + rng2() * 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  }

  update(dt: number): void {
    if (this.timer > 0) {
      this.timer -= dt;

      if (this.overlay) {
        const t = Math.max(0, this.timer / 0.35);
        // Subtle flicker
        const flicker = t > 0.7 ? 1 : (Math.random() > 0.4 ? t : t * 0.4);
        this.overlay.style.opacity = String(flicker * 0.5);
        this.overlay.style.background = `rgba(200,220,255,${flicker * 0.2})`;
      }

      if (this.timer <= 0) {
        if (this.overlay) this.overlay.style.display = 'none';
        if (this.bolts) { this.bolts.remove(); this.bolts = null; }
      }
    }
  }

  dispose(): void {
    if (this.bolts) { this.bolts.remove(); this.bolts = null; }
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }
}

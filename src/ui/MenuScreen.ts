import { TrackConfig } from '../track/TrackDefinition';
import { CircuitMeadow } from '../track/tracks/CircuitMeadow';
import { AudioManager } from '../core/AudioManager';

export type GameMode = 'grandprix' | 'vsrace' | 'timetrial' | '2player';

export interface MenuResult {
  mode: GameMode;
  track: TrackConfig;
}

const ENV_COLORS: Record<string, [string, string]> = {
  meadow: ['#2a6e2a', '#88cc44'],
  volcano: ['#6e2a2a', '#ff6644'],
  coastal: ['#1a4466', '#44aacc'],
  frozen: ['#3a5577', '#aaccee'],
  night: ['#060818', '#1a2255'],
};

export class MenuScreen {
  private container: HTMLElement;
  private el: HTMLDivElement | null = null;
  private resolve: ((result: MenuResult) => void) | null = null;
  private selectedMode: GameMode = 'vsrace';
  private selectedTrack: TrackConfig = CircuitMeadow;
  private tracks: TrackConfig[] = [];
  private phase: 'mode' | 'track' = 'mode';
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgAnimId = 0;
  private audio: AudioManager;

  constructor(tracks: TrackConfig[], audio: AudioManager) {
    this.container = document.getElementById('ui-overlay')!;
    this.tracks = tracks;
    this.audio = audio;
  }

  show(): Promise<MenuResult> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.phase = 'mode';
      this.render();
    });
  }

  private render(): void {
    if (this.el) this.el.remove();
    cancelAnimationFrame(this.bgAnimId);

    this.el = document.createElement('div');
    this.el.className = 'menu-screen';

    // Background
    const bg = document.createElement('div');
    bg.className = 'menu-bg';
    this.el.appendChild(bg);

    // Animated particle canvas
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.className = 'menu-bg-canvas';
    this.el.appendChild(this.bgCanvas);
    this.startBgAnimation();

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'menu-content';

    if (this.phase === 'mode') {
      content.innerHTML = `
        <div class="menu-title">MARICA</div>
        <div class="menu-tagline">ARCADE RACING</div>
        <div class="menu-buttons">
          <button class="menu-button" data-mode="grandprix">GRAND PRIX</button>
          <button class="menu-button" data-mode="vsrace">VS RACE</button>
          <button class="menu-button" data-mode="2player">2P SPLIT</button>
          <button class="menu-button" data-mode="timetrial">TIME TRIAL</button>
        </div>
        <div class="menu-subtitle">
          <b>P1</b> Arrows + <kbd>/</kbd> Drift + <kbd>\\</kbd> Item<br>
          <b>P2</b> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> + <kbd>2</kbd> Drift + <kbd>1</kbd> Item
        </div>
      `;

      content.querySelectorAll('.menu-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.selectedMode = (e.target as HTMLElement).dataset.mode as GameMode;
          this.phase = 'track';
          this.render();
        });
      });
    } else {
      const title = document.createElement('div');
      title.className = 'menu-title';
      title.textContent = 'MARICA';
      title.style.fontSize = '52px';
      title.style.marginBottom = '8px';
      content.appendChild(title);

      const subtitle = document.createElement('div');
      subtitle.className = 'course-select-title';
      subtitle.textContent = 'SELECT COURSE';
      content.appendChild(subtitle);

      const courseSelect = document.createElement('div');
      courseSelect.className = 'course-select';

      const ENV_ACCENT: Record<string, string> = {
        meadow: '100,200,80',
        volcano: '255,100,60',
        coastal: '70,180,220',
        frozen: '160,210,240',
        night: '120,130,220',
      };

      for (const track of this.tracks) {
        const card = document.createElement('div');
        card.className = 'course-card';

        const accent = ENV_ACCENT[track.environment] ?? '100,180,255';
        card.style.setProperty('--env-color', accent);

        // Preview canvas
        const previewDiv = document.createElement('div');
        previewDiv.className = 'course-card-preview';
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 240;
        previewCanvas.height = 150;
        this.drawTrackPreview(previewCanvas, track);
        previewDiv.appendChild(previewCanvas);
        card.appendChild(previewDiv);

        // Info
        const info = document.createElement('div');
        info.className = 'course-card-info';
        const envColor = `rgb(${accent})`;
        info.innerHTML = `<h3>${track.name}</h3><p style="color:${envColor}">${track.environment}</p>`;
        card.appendChild(info);

        card.addEventListener('click', () => {
          this.selectedTrack = track;
          this.hide();
          this.resolve?.({ mode: this.selectedMode, track: this.selectedTrack });
        });
        courseSelect.appendChild(card);
      }
      content.appendChild(courseSelect);

      const backBtn = document.createElement('button');
      backBtn.className = 'menu-back-btn';
      backBtn.textContent = '← BACK';
      backBtn.addEventListener('click', () => {
        this.phase = 'mode';
        this.render();
      });
      content.appendChild(backBtn);
    }

    this.el.appendChild(content);
    this.container.appendChild(this.el);
  }

  private drawTrackPreview(canvas: HTMLCanvasElement, track: TrackConfig): void {
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    // Background gradient
    const colors = ENV_COLORS[track.environment] ?? ['#333', '#666'];
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Environment-specific texture overlay
    this.drawEnvTexture(ctx, w, h, track.environment);

    // Draw track outline
    const pts = track.controlPoints;
    if (pts.length < 2) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.position[0]);
      maxX = Math.max(maxX, p.position[0]);
      minZ = Math.min(minZ, p.position[2]);
      maxZ = Math.max(maxZ, p.position[2]);
    }

    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;
    const scale = Math.min((w - 40) / rangeX, (h - 30) / rangeZ);
    const offX = (w - rangeX * scale) / 2;
    const offZ = (h - rangeZ * scale) / 2;

    const toX = (x: number) => (x - minX) * scale + offX;
    const toY = (z: number) => (z - minZ) * scale + offZ;

    // Track path with glow
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const x = toX(p.position[0]);
      const y = toY(p.position[2]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Start marker
    const s = pts[0];
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(toX(s.position[0]), toY(s.position[2]), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawEnvTexture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    env: string,
  ): void {
    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
    };

    if (env === 'frozen') {
      // Icy fog layer
      const fog = ctx.createLinearGradient(0, h * 0.5, 0, h);
      fog.addColorStop(0, 'rgba(180,210,240,0)');
      fog.addColorStop(1, 'rgba(180,210,240,0.15)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, w, h);

      // Blowing snow streaks
      const rand = rng(42);
      ctx.lineCap = 'round';
      for (let i = 0; i < 25; i++) {
        const x = rand() * w * 1.3 - w * 0.15;
        const y = rand() * h;
        const len = 20 + rand() * 40;
        const alpha = 0.04 + rand() * 0.08;
        ctx.strokeStyle = `rgba(220,240,255,${alpha})`;
        ctx.lineWidth = 0.5 + rand() * 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * 0.3, y + len);
        ctx.stroke();
      }

      // Snowflakes — layered sizes for depth
      for (let layer = 0; layer < 3; layer++) {
        const count = [30, 50, 80][layer];
        const maxR = [3.5, 2, 1][layer];
        const alpha = [0.7, 0.5, 0.3][layer];
        for (let i = 0; i < count; i++) {
          const x = rand() * w;
          const y = rand() * h;
          const r = rand() * maxR + 0.3;
          // Snowflake glow
          if (layer === 0 && rand() > 0.5) {
            const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
            glow.addColorStop(0, `rgba(200,230,255,${alpha * 0.5})`);
            glow.addColorStop(1, 'rgba(200,230,255,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
          }
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Frost crystals — small cross shapes
      ctx.strokeStyle = 'rgba(200,230,255,0.15)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 15; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const s = 2 + rand() * 4;
        ctx.beginPath();
        ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
        ctx.moveTo(x - s * 0.7, y - s * 0.7); ctx.lineTo(x + s * 0.7, y + s * 0.7);
        ctx.moveTo(x + s * 0.7, y - s * 0.7); ctx.lineTo(x - s * 0.7, y + s * 0.7);
        ctx.stroke();
      }

    } else if (env === 'night') {
      // Deep space nebula glow
      const nebula1 = ctx.createRadialGradient(w * 0.3, h * 0.4, 0, w * 0.3, h * 0.4, w * 0.5);
      nebula1.addColorStop(0, 'rgba(40,20,80,0.3)');
      nebula1.addColorStop(1, 'rgba(10,5,30,0)');
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, w, h);
      const nebula2 = ctx.createRadialGradient(w * 0.7, h * 0.6, 0, w * 0.7, h * 0.6, w * 0.4);
      nebula2.addColorStop(0, 'rgba(20,10,60,0.25)');
      nebula2.addColorStop(1, 'rgba(5,5,30,0)');
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, w, h);

      // Rainbow starfield
      const rand = rng(77);
      const rainbowHues = [0, 30, 60, 120, 180, 220, 270, 310]; // red, orange, yellow, green, cyan, blue, purple, pink
      for (let i = 0; i < 120; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const brightness = rand() * 0.5 + 0.5;
        const r = rand() * 1.5 + 0.2;
        const hue = rainbowHues[Math.floor(rand() * rainbowHues.length)];
        const sat = 70 + rand() * 30;
        ctx.fillStyle = `hsla(${hue},${sat}%,75%,${brightness})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Large rainbow glowing stars with cross flare
      for (let i = 0; i < 10; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const hue = rainbowHues[Math.floor(rand() * rainbowHues.length)];
        const glowR = 6 + rand() * 8;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        glow.addColorStop(0, `hsla(${hue},80%,80%,0.7)`);
        glow.addColorStop(0.4, `hsla(${hue},80%,60%,0.2)`);
        glow.addColorStop(1, `hsla(${hue},80%,50%,0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2);

        // Cross flare
        ctx.strokeStyle = `hsla(${hue},70%,80%,0.3)`;
        ctx.lineWidth = 0.5;
        const flareLen = glowR * 1.5;
        ctx.beginPath();
        ctx.moveTo(x - flareLen, y); ctx.lineTo(x + flareLen, y);
        ctx.moveTo(x, y - flareLen); ctx.lineTo(x, y + flareLen);
        ctx.stroke();
      }

      // Faint twinkling shimmer band (milky way)
      for (let i = 0; i < 60; i++) {
        const x = rand() * w;
        const y = h * 0.25 + (rand() - 0.5) * h * 0.35 + Math.sin(x * 0.03) * 15;
        const hue = rand() * 360;
        ctx.fillStyle = `hsla(${hue},60%,80%,${rand() * 0.25 + 0.05})`;
        ctx.beginPath();
        ctx.arc(x, y, rand() * 0.8 + 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (env === 'volcano') {
      // Bottom lava pool glow
      const lavaGlow = ctx.createRadialGradient(w * 0.5, h * 1.2, 0, w * 0.5, h * 1.2, h);
      lavaGlow.addColorStop(0, 'rgba(255,80,0,0.25)');
      lavaGlow.addColorStop(0.5, 'rgba(200,40,0,0.1)');
      lavaGlow.addColorStop(1, 'rgba(100,20,0,0)');
      ctx.fillStyle = lavaGlow;
      ctx.fillRect(0, 0, w, h);

      const rand = rng(33);

      // Rising embers — larger, brighter, with trails
      for (let i = 0; i < 50; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = rand() * 3 + 1;
        const alpha = rand() * 0.6 + 0.2;
        const green = Math.floor(60 + rand() * 140);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        glow.addColorStop(0, `rgba(255,${green},0,${alpha})`);
        glow.addColorStop(0.5, `rgba(255,${Math.floor(green * 0.5)},0,${alpha * 0.3})`);
        glow.addColorStop(1, 'rgba(200,30,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
      }

      // Bright ember cores
      for (let i = 0; i < 20; i++) {
        const x = rand() * w;
        const y = rand() * h;
        ctx.fillStyle = `rgba(255,${Math.floor(200 + rand() * 55)},${Math.floor(50 + rand() * 100)},${0.5 + rand() * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, y, rand() * 1.2 + 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lava cracks — branching lines from bottom
      for (let i = 0; i < 12; i++) {
        const x0 = rand() * w;
        const y0 = h * 0.55 + rand() * h * 0.45;
        const segments = 2 + Math.floor(rand() * 3);
        const alpha = 0.1 + rand() * 0.15;
        ctx.strokeStyle = `rgba(255,120,20,${alpha})`;
        ctx.lineWidth = 1 + rand() * 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        let cx = x0, cy = y0;
        for (let s = 0; s < segments; s++) {
          cx += (rand() - 0.5) * 35;
          cy += rand() * 15 + 5;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }

      // Heat haze overlay at top
      const haze = ctx.createLinearGradient(0, 0, 0, h * 0.4);
      haze.addColorStop(0, 'rgba(255,100,30,0.06)');
      haze.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, w, h * 0.4);

    } else if (env === 'meadow') {
      // Sky gradient overlay — blue to warm
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      sky.addColorStop(0, 'rgba(100,180,255,0.12)');
      sky.addColorStop(1, 'rgba(100,180,255,0)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Rolling hills silhouette
      ctx.fillStyle = 'rgba(60,140,40,0.12)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.75);
      ctx.quadraticCurveTo(w * 0.2, h * 0.6, w * 0.4, h * 0.72);
      ctx.quadraticCurveTo(w * 0.6, h * 0.82, w * 0.8, h * 0.68);
      ctx.quadraticCurveTo(w * 0.95, h * 0.6, w, h * 0.7);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Second hill layer darker
      ctx.fillStyle = 'rgba(50,120,35,0.15)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.85);
      ctx.quadraticCurveTo(w * 0.15, h * 0.75, w * 0.35, h * 0.82);
      ctx.quadraticCurveTo(w * 0.55, h * 0.9, w * 0.75, h * 0.78);
      ctx.quadraticCurveTo(w * 0.9, h * 0.72, w, h * 0.8);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Grass field at bottom
      const grassGrad = ctx.createLinearGradient(0, h * 0.85, 0, h);
      grassGrad.addColorStop(0, 'rgba(70,160,40,0.18)');
      grassGrad.addColorStop(1, 'rgba(50,130,30,0.25)');
      ctx.fillStyle = grassGrad;
      ctx.fillRect(0, h * 0.85, w, h * 0.15);

      // Dense grass blades
      const rand = rng(55);
      ctx.lineCap = 'round';
      for (let i = 0; i < 70; i++) {
        const x = rand() * w;
        const yBase = h - rand() * 12;
        const bladeH = 10 + rand() * 14;
        const lean = (rand() - 0.5) * 8;
        const green = Math.floor(140 + rand() * 80);
        ctx.strokeStyle = `rgba(${Math.floor(60 + rand() * 40)},${green},${Math.floor(30 + rand() * 30)},${0.25 + rand() * 0.15})`;
        ctx.lineWidth = 1 + rand() * 1;
        ctx.beginPath();
        ctx.moveTo(x, yBase);
        ctx.quadraticCurveTo(x + lean * 0.5, yBase - bladeH * 0.6, x + lean, yBase - bladeH);
        ctx.stroke();
      }

      // Floating pollen / dandelion seeds
      ctx.fillStyle = 'rgba(255,255,220,0.3)';
      for (let i = 0; i < 12; i++) {
        const x = rand() * w;
        const y = rand() * h * 0.7;
        ctx.beginPath();
        ctx.arc(x, y, rand() * 1 + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Small flowers
      const flowerColors = ['rgba(255,100,120,0.4)', 'rgba(255,220,80,0.4)', 'rgba(200,140,255,0.35)'];
      for (let i = 0; i < 8; i++) {
        const x = rand() * w;
        const y = h * 0.88 + rand() * h * 0.1;
        ctx.fillStyle = flowerColors[Math.floor(rand() * flowerColors.length)];
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + rand() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (env === 'coastal') {
      // Horizon glow
      const horizonGlow = ctx.createLinearGradient(0, h * 0.3, 0, h * 0.55);
      horizonGlow.addColorStop(0, 'rgba(255,200,120,0.08)');
      horizonGlow.addColorStop(1, 'rgba(100,180,220,0)');
      ctx.fillStyle = horizonGlow;
      ctx.fillRect(0, 0, w, h);

      // Layered wave bands
      for (let row = 0; row < 7; row++) {
        const y = h * 0.25 + row * (h * 0.1);
        const alpha = 0.06 + row * 0.02;
        ctx.strokeStyle = `rgba(120,210,240,${alpha})`;
        ctx.lineWidth = 1.5 + row * 0.3;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const wave = Math.sin(x * 0.035 + row * 1.8) * (4 + row) +
                       Math.sin(x * 0.07 + row * 0.7) * 2.5 +
                       Math.sin(x * 0.15 + row * 3) * 1;
          if (x === 0) ctx.moveTo(x, y + wave);
          else ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
      }

      // Foam highlights
      const rand = rng(88);
      for (let i = 0; i < 15; i++) {
        const x = rand() * w;
        const row = Math.floor(rand() * 5);
        const y = h * 0.28 + row * h * 0.1 + (rand() - 0.5) * 6;
        const fw = 8 + rand() * 20;
        ctx.fillStyle = `rgba(220,245,255,${0.06 + rand() * 0.06})`;
        ctx.beginPath();
        ctx.ellipse(x, y, fw, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Water sparkle
      for (let i = 0; i < 35; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const brightness = rand() * 0.3 + 0.1;
        ctx.fillStyle = `rgba(200,240,255,${brightness})`;
        ctx.beginPath();
        ctx.arc(x, y, rand() * 1 + 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Distant wave crest glow
      const crestGlow = ctx.createLinearGradient(0, h * 0.8, 0, h);
      crestGlow.addColorStop(0, 'rgba(60,160,200,0)');
      crestGlow.addColorStop(1, 'rgba(60,160,200,0.08)');
      ctx.fillStyle = crestGlow;
      ctx.fillRect(0, h * 0.8, w, h * 0.2);
    }
  }

  private startBgAnimation(): void {
    if (!this.bgCanvas) return;
    const canvas = this.bgCanvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d')!;

    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.45;

    // Floating sparks — small bright dots drifting upward
    interface Spark {
      x: number; y: number; vy: number; vx: number;
      size: number; alpha: number; life: number; maxLife: number;
      hue: number;
    }
    const sparks: Spark[] = [];
    const spawnSpark = (): Spark => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 20,
      vy: -(Math.random() * 1.5 + 0.5),
      vx: (Math.random() - 0.5) * 0.8,
      size: Math.random() * 1.7 + 0.8,
      alpha: Math.random() * 0.3 + 0.15,
      life: 0,
      maxLife: Math.random() * 200 + 100,
      hue: [210, 200, 215, 205][Math.floor(Math.random() * 4)],
    });
    for (let i = 0; i < 25; i++) {
      const s = spawnSpark();
      s.y = Math.random() * canvas.height;
      s.life = Math.random() * s.maxLife;
      sparks.push(s);
    }

    let pulseTimer = 0;
    const pulseInterval = 250; // ~4s at 60fps

    const animate = () => {
      // Motion blur: semi-transparent fill instead of clearRect
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Center pulse
      pulseTimer++;
      if (pulseTimer >= pulseInterval) {
        pulseTimer = 0;
      }
      if (pulseTimer < 30) {
        const pt = pulseTimer / 30;
        const pulseRadius = pt * Math.max(canvas.width, canvas.height) * 0.5;
        const pulseAlpha = (1 - pt) * 0.03;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseRadius);
        grad.addColorStop(0, `rgba(184,204,228,${pulseAlpha})`);
        grad.addColorStop(0.5, `rgba(184,204,228,${pulseAlpha * 0.25})`);
        grad.addColorStop(1, 'rgba(184,204,228,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // --- Floating sparks ---
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life++;

        if (s.life > s.maxLife || s.y < -10) {
          sparks[i] = spawnSpark();
          continue;
        }

        const lifeRatio = s.life / s.maxLife;
        const fade = lifeRatio < 0.1 ? lifeRatio / 0.1 : (lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1);
        const a = s.alpha * fade;

        ctx.fillStyle = `hsla(${s.hue},50%,80%,${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        if (s.size > 1.5) {
          ctx.fillStyle = `hsla(${s.hue},50%,80%,${a * 0.25})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      this.bgAnimId = requestAnimationFrame(animate);
    };
    animate();
  }

  hide(): void {
    cancelAnimationFrame(this.bgAnimId);
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.bgCanvas = null;
  }

  destroy(): void {
    this.hide();
  }
}

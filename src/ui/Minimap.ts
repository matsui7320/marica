import { Kart } from '../kart/Kart';
import { TrackSpline } from '../track/TrackSpline';
import { KART_COLORS } from '../constants';

export class Minimap {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trackPath: { x: number; z: number }[] = [];
  private bounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  private scale = 1;
  private offsetX = 0;
  private offsetZ = 0;
  private time = 0;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'hud-minimap';
    document.getElementById('ui-overlay')!.appendChild(this.container);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 170;
    this.canvas.height = 170;
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  buildTrackPath(spline: TrackSpline): void {
    this.trackPath = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < 200; i++) {
      const t = i / 200;
      const p = spline.getPointAt(t);
      this.trackPath.push({ x: p.position.x, z: p.position.z });
      minX = Math.min(minX, p.position.x);
      maxX = Math.max(maxX, p.position.x);
      minZ = Math.min(minZ, p.position.z);
      maxZ = Math.max(maxZ, p.position.z);
    }

    const padding = 15;
    this.bounds = { minX: minX - padding, maxX: maxX + padding, minZ: minZ - padding, maxZ: maxZ + padding };
    const rangeX = this.bounds.maxX - this.bounds.minX;
    const rangeZ = this.bounds.maxZ - this.bounds.minZ;
    this.scale = 158 / Math.max(rangeX, rangeZ);
    this.offsetX = (170 - rangeX * this.scale) / 2;
    this.offsetZ = (170 - rangeZ * this.scale) / 2;
  }

  update(karts: Kart[]): void {
    this.time += 1 / 60;
    const ctx = this.ctx;
    const w = 170, h = 170;
    ctx.clearRect(0, 0, w, h);

    // Track glow (wide, low opacity)
    ctx.strokeStyle = 'rgba(100,180,255,0.12)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < this.trackPath.length; i++) {
      const p = this.toScreen(this.trackPath[i].x, this.trackPath[i].z);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();

    // Track line
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw karts (NPCs first, player on top)
    const sortedKarts = [...karts].sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));

    for (const kart of sortedKarts) {
      const p = this.toScreen(kart.state.position.x, kart.state.position.z);
      const colorHex = '#' + KART_COLORS[kart.index].toString(16).padStart(6, '0');

      if (kart.isPlayer) {
        // Player glow ring
        const pulseAlpha = 0.2 + Math.sin(this.time * 4) * 0.1;
        ctx.fillStyle = `rgba(255,255,255,${pulseAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Player dot
        ctx.fillStyle = colorHex;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // White outline
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Direction indicator
        const heading = kart.state.heading;
        const dx = Math.sin(heading) * 8;
        const dz = Math.cos(heading) * 8;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + dz * this.scale * 0.04, p.y + dx * this.scale * 0.04);
        ctx.stroke();
      } else {
        // NPC dot
        ctx.fillStyle = colorHex;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  private toScreen(x: number, z: number): { x: number; y: number } {
    return {
      x: (x - this.bounds.minX) * this.scale + this.offsetX,
      y: (z - this.bounds.minZ) * this.scale + this.offsetZ,
    };
  }

  destroy(): void {
    this.container.remove();
  }
}

import { Kart } from '../kart/Kart';
import { ItemSlot } from '../items/ItemSlot';
import { TOTAL_LAPS, KART_MAX_SPEED, TOTAL_RACERS } from '../constants';
import { positionSuffix, formatTime } from '../utils/math';
import { ItemType } from '../items/ItemDistribution';
import { DriftStage } from '../kart/DriftSystem';

const ITEM_ICONS: Record<ItemType, string> = {
  mushroom: '🍄',
  banana: '🍌',
  greenShell: '🟢',
  redShell: '🔴',
  star: '⭐',
  lightning: '⚡',
};

const ITEM_NAMES: Record<ItemType, string> = {
  mushroom: 'MUSHROOM',
  banana: 'BANANA',
  greenShell: 'GREEN SHELL',
  redShell: 'RED SHELL',
  star: 'STAR',
  lightning: 'LIGHTNING',
};

export type HUDSide = 'full' | 'left' | 'right';

export class HUD {
  private container: HTMLElement;
  private side: HUDSide;

  // Position
  private positionEl!: HTMLDivElement;
  private lastPos = -1;

  // Lap
  private lapContainer!: HTMLDivElement;
  private lapEl!: HTMLDivElement;
  private lapBarFill!: HTMLDivElement;

  // Item
  private itemContainer!: HTMLDivElement;
  private itemEl!: HTMLDivElement;
  private itemNameEl!: HTMLDivElement;
  private lastDisplayCycle = -1;

  // Speed
  private speedContainer!: HTMLDivElement;
  private speedEl!: HTMLDivElement;
  private speedBarFill!: HTMLDivElement;
  private speedArc!: SVGCircleElement;
  private speedGlow!: SVGCircleElement;
  private speedNeedle!: SVGLineElement;

  // Boost
  private boostContainer!: HTMLDivElement;
  private boostBarFill!: HTMLDivElement;

  // Drift
  private driftIndicator!: HTMLDivElement;

  // Warning
  private warningEl!: HTMLDivElement;

  // Hit overlay
  private hitOverlay!: HTMLDivElement;

  // Item get flash
  private itemGetFlash!: HTMLDivElement;

  // Notifications
  private lapNotifyEl: HTMLDivElement | null = null;
  private posNotifyEl: HTMLDivElement | null = null;

  constructor(side: HUDSide = 'full') {
    this.container = document.getElementById('ui-overlay')!;
    this.side = side;
    this.create();
  }

  private create(): void {
    const s = this.side;
    const isSplit = s !== 'full';
    const scale = isSplit ? 0.85 : 1;

    // Position
    this.positionEl = document.createElement('div');
    this.positionEl.className = 'hud-position';
    if (isSplit) {
      this.positionEl.style.transform = `scale(${scale * 1.5})`;
      if (s === 'left') {
        this.positionEl.style.left = '12px';
      } else {
        this.positionEl.style.left = 'auto';
        this.positionEl.style.right = 'calc(50% + 12px)';
        // Mirror: position on the right half's left edge
        this.positionEl.style.left = 'calc(50% + 12px)';
        this.positionEl.style.right = 'auto';
      }
    }
    this.container.appendChild(this.positionEl);

    // Lap container
    this.lapContainer = document.createElement('div');
    this.lapContainer.className = 'hud-lap-container';
    if (isSplit) {
      this.lapContainer.style.transform = `scale(${scale * 1.5})`;
      if (s === 'left') {
        this.lapContainer.style.right = 'calc(50% + 12px)';
      } else {
        this.lapContainer.style.right = '12px';
      }
    }
    this.lapEl = document.createElement('div');
    this.lapEl.className = 'hud-lap';
    this.lapContainer.appendChild(this.lapEl);
    const lapBar = document.createElement('div');
    lapBar.className = 'hud-lap-bar';
    this.lapBarFill = document.createElement('div');
    this.lapBarFill.className = 'hud-lap-bar-fill';
    lapBar.appendChild(this.lapBarFill);
    this.lapContainer.appendChild(lapBar);
    this.container.appendChild(this.lapContainer);

    // Item container
    this.itemContainer = document.createElement('div');
    this.itemContainer.className = 'hud-item-container';
    if (isSplit) {
      if (s === 'left') {
        this.itemContainer.style.left = '25%';
      } else {
        this.itemContainer.style.left = '75%';
      }
      this.itemContainer.style.transform = `translateX(-50%) scale(${scale * 1.6})`;
    }
    this.itemEl = document.createElement('div');
    this.itemEl.className = 'hud-item';
    this.itemNameEl = document.createElement('div');
    this.itemNameEl.className = 'hud-item-name';
    this.itemContainer.appendChild(this.itemEl);
    this.itemContainer.appendChild(this.itemNameEl);
    this.container.appendChild(this.itemContainer);

    // Speed container — arc gauge
    this.speedContainer = document.createElement('div');
    this.speedContainer.className = 'hud-speed-container';
    if (isSplit) {
      this.speedContainer.style.transform = `scale(${scale * 0.7})`;
      this.speedContainer.style.transformOrigin = 'bottom right';
      if (s === 'left') {
        this.speedContainer.style.right = 'calc(50% + 10px)';
      } else {
        this.speedContainer.style.right = '10px';
      }
    }

    // SVG gauge
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'hud-speed-svg');
    svg.setAttribute('viewBox', '0 0 240 150');

    const cx = 120, cy = 135, r = 105;
    const circumference = 2 * Math.PI * r;
    const sweepFraction = 240 / 360;
    const arcLength = circumference * sweepFraction;

    // Background track
    const bgArc = document.createElementNS(svgNS, 'circle');
    bgArc.setAttribute('cx', String(cx));
    bgArc.setAttribute('cy', String(cy));
    bgArc.setAttribute('r', String(r));
    bgArc.setAttribute('class', 'hud-speed-arc-bg');
    bgArc.setAttribute('stroke-dasharray', `${arcLength} ${circumference}`);
    bgArc.setAttribute('stroke-dashoffset', String(-circumference * (210 / 360)));
    svg.appendChild(bgArc);

    // Fill arc
    this.speedArc = document.createElementNS(svgNS, 'circle');
    this.speedArc.setAttribute('cx', String(cx));
    this.speedArc.setAttribute('cy', String(cy));
    this.speedArc.setAttribute('r', String(r));
    this.speedArc.setAttribute('class', 'hud-speed-arc-fill');
    this.speedArc.setAttribute('stroke-dasharray', `0 ${circumference}`);
    this.speedArc.setAttribute('stroke-dashoffset', String(-circumference * (210 / 360)));
    svg.appendChild(this.speedArc);

    // Glow arc
    this.speedGlow = document.createElementNS(svgNS, 'circle');
    this.speedGlow.setAttribute('cx', String(cx));
    this.speedGlow.setAttribute('cy', String(cy));
    this.speedGlow.setAttribute('r', String(r));
    this.speedGlow.setAttribute('class', 'hud-speed-arc-glow');
    this.speedGlow.setAttribute('stroke-dasharray', `0 ${circumference}`);
    this.speedGlow.setAttribute('stroke-dashoffset', String(-circumference * (210 / 360)));
    svg.appendChild(this.speedGlow);

    // Tick marks
    const tickCount = 9;
    for (let i = 0; i <= tickCount; i++) {
      const angleDeg = 210 + (i / tickCount) * 240;
      const angleRad = (angleDeg * Math.PI) / 180;
      const isMajor = i % 3 === 0;
      const innerR = isMajor ? r - 15 : r - 9;
      const tick = document.createElementNS(svgNS, 'line');
      tick.setAttribute('x1', String(cx + Math.cos(angleRad) * innerR));
      tick.setAttribute('y1', String(cy + Math.sin(angleRad) * innerR));
      tick.setAttribute('x2', String(cx + Math.cos(angleRad) * (r - 3)));
      tick.setAttribute('y2', String(cy + Math.sin(angleRad) * (r - 3)));
      tick.setAttribute('class', isMajor ? 'hud-speed-tick-major' : 'hud-speed-tick');
      svg.appendChild(tick);
    }

    // Needle
    this.speedNeedle = document.createElementNS(svgNS, 'line');
    this.speedNeedle.setAttribute('x1', String(cx));
    this.speedNeedle.setAttribute('y1', String(cy));
    this.speedNeedle.setAttribute('x2', String(cx));
    this.speedNeedle.setAttribute('y2', String(cy - r + 18));
    this.speedNeedle.setAttribute('class', 'hud-speed-needle');
    svg.appendChild(this.speedNeedle);

    // Center dot
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', String(cx));
    dot.setAttribute('cy', String(cy));
    dot.setAttribute('r', '4.5');
    dot.setAttribute('class', 'hud-speed-dot');
    svg.appendChild(dot);

    this.speedContainer.appendChild(svg);

    // Number overlay
    this.speedEl = document.createElement('div');
    this.speedEl.className = 'hud-speed';
    this.speedContainer.appendChild(this.speedEl);
    const speedUnit = document.createElement('div');
    speedUnit.className = 'hud-speed-unit';
    speedUnit.textContent = 'KM/H';
    this.speedContainer.appendChild(speedUnit);

    // Hidden bar fill (keep for compatibility)
    this.speedBarFill = document.createElement('div');
    this.speedBarFill.style.display = 'none';

    this.container.appendChild(this.speedContainer);

    // Boost container
    this.boostContainer = document.createElement('div');
    this.boostContainer.className = 'hud-boost-container';
    if (isSplit) {
      if (s === 'left') {
        this.boostContainer.style.right = 'calc(50% + 24px)';
      } else {
        this.boostContainer.style.right = '24px';
      }
    }
    const boostLabel = document.createElement('div');
    boostLabel.className = 'hud-boost-label';
    boostLabel.textContent = 'BOOST';
    this.boostContainer.appendChild(boostLabel);
    const boostBar = document.createElement('div');
    boostBar.className = 'hud-boost-bar';
    this.boostBarFill = document.createElement('div');
    this.boostBarFill.className = 'hud-boost-bar-fill';
    boostBar.appendChild(this.boostBarFill);
    this.boostContainer.appendChild(boostBar);
    this.container.appendChild(this.boostContainer);

    // Drift indicator
    this.driftIndicator = document.createElement('div');
    this.driftIndicator.className = 'hud-drift-indicator';
    if (isSplit) {
      if (s === 'left') {
        this.driftIndicator.style.left = '25%';
      } else {
        this.driftIndicator.style.left = '75%';
      }
    }
    this.container.appendChild(this.driftIndicator);

    // Warning overlay
    this.warningEl = document.createElement('div');
    this.warningEl.className = 'hud-warning';
    if (isSplit) {
      if (s === 'left') {
        this.warningEl.style.width = '50%';
      } else {
        this.warningEl.style.left = '50%';
        this.warningEl.style.width = '50%';
      }
    }
    const warningInner = document.createElement('div');
    warningInner.className = 'hud-warning-inner';
    this.warningEl.appendChild(warningInner);
    this.container.appendChild(this.warningEl);

    // Hit overlay
    this.hitOverlay = document.createElement('div');
    this.hitOverlay.className = 'hud-hit-overlay';
    if (isSplit) {
      if (s === 'left') {
        this.hitOverlay.style.width = '50%';
      } else {
        this.hitOverlay.style.left = '50%';
        this.hitOverlay.style.width = '50%';
      }
    }
    this.container.appendChild(this.hitOverlay);

    // Item get flash
    this.itemGetFlash = document.createElement('div');
    this.itemGetFlash.className = 'item-get-flash';
    if (isSplit) {
      if (s === 'left') {
        this.itemGetFlash.style.width = '50%';
      } else {
        this.itemGetFlash.style.left = '50%';
        this.itemGetFlash.style.width = '50%';
      }
    }
    this.container.appendChild(this.itemGetFlash);
  }

  update(
    kart: Kart,
    itemSlot: ItemSlot,
    raceTime: number,
    driftStage: DriftStage = DriftStage.None,
    boostTimer: number = 0,
    boostMaxDuration: number = 1,
    isTargeted: boolean = false,
  ): void {
    // Position
    const pos = kart.racePosition;
    if (pos !== this.lastPos) {
      const oldPos = this.lastPos;
      this.lastPos = pos;
      this.positionEl.innerHTML =
        `${pos}<span class="suffix">${positionSuffix(pos)}</span>` +
        `<span class="total"> / ${TOTAL_RACERS}</span>`;

      this.positionEl.classList.add('pos-change');
      setTimeout(() => this.positionEl.classList.remove('pos-change'), 200);

      if (oldPos > 0 && oldPos !== pos) {
        this.showPosChange(pos < oldPos);
      }
    }

    // Lap
    const lap = Math.min(kart.currentLap + 1, TOTAL_LAPS);
    this.lapEl.innerHTML = `LAP <span class="current-lap">${lap}</span>/${TOTAL_LAPS}`;
    const lapProgress = (lap - 1) / TOTAL_LAPS * 100;
    this.lapBarFill.style.width = `${lapProgress}%`;

    // Item
    const displayItem = itemSlot.displayItem;
    if (displayItem) {
      this.itemEl.textContent = ITEM_ICONS[displayItem] ?? '?';
      if (itemSlot.isRolling) {
        this.itemEl.className = 'hud-item rolling';
        this.itemNameEl.textContent = '';
        this.itemNameEl.className = 'hud-item-name';
        // Trigger a micro-pulse on each item swap
        if (itemSlot.displayCycle !== this.lastDisplayCycle) {
          this.lastDisplayCycle = itemSlot.displayCycle;
          this.itemEl.classList.remove('tick');
          void this.itemEl.offsetWidth;
          this.itemEl.classList.add('tick');
        }
      } else if (itemSlot.justDecided) {
        this.itemEl.className = 'hud-item decided';
        this.itemNameEl.textContent = ITEM_NAMES[displayItem] ?? '';
        this.itemNameEl.className = 'hud-item-name visible';
      } else {
        this.itemEl.className = 'hud-item has-item';
        this.itemNameEl.textContent = ITEM_NAMES[displayItem] ?? '';
        this.itemNameEl.className = 'hud-item-name visible';
      }
    } else {
      this.itemEl.textContent = '';
      this.itemNameEl.textContent = '';
      this.itemEl.className = 'hud-item';
      this.itemNameEl.className = 'hud-item-name';
      this.lastDisplayCycle = -1;
    }

    // Speed — arc gauge
    const speed = Math.abs(kart.state.speed);
    const kmh = Math.floor(speed * 3.6);
    this.speedEl.textContent = String(kmh);
    const speedRatio = Math.min(speed / KART_MAX_SPEED, 1);

    const gaugeR = 105;
    const gaugeCircumference = 2 * Math.PI * gaugeR;
    const gaugeSweep = (240 / 360) * gaugeCircumference;
    const fillLen = speedRatio * gaugeSweep;
    this.speedArc.setAttribute('stroke-dasharray', `${fillLen} ${gaugeCircumference}`);
    this.speedGlow.setAttribute('stroke-dasharray', `${fillLen} ${gaugeCircumference}`);

    const needleAngle = 210 + speedRatio * 240;
    this.speedNeedle.setAttribute('transform', `rotate(${needleAngle}, 120, 135)`);

    const isBoosting = kart.state.boostTimer > 0 || kart.state.starTimer > 0;
    if (isBoosting) {
      this.speedEl.classList.add('boosting');
      this.speedArc.style.stroke = '#ff8844';
      this.speedGlow.style.stroke = '#ff6600';
      this.speedNeedle.style.stroke = '#ffaa44';
    } else if (speedRatio > 0.85) {
      this.speedEl.classList.remove('boosting');
      this.speedEl.classList.add('high-speed');
      this.speedArc.style.stroke = '#ff4444';
      this.speedGlow.style.stroke = '#ff2222';
      this.speedNeedle.style.stroke = '#ff6666';
    } else if (speedRatio > 0.5) {
      this.speedEl.classList.remove('boosting');
      this.speedEl.classList.remove('high-speed');
      this.speedArc.style.stroke = '#ffdd00';
      this.speedGlow.style.stroke = '#ffaa00';
      this.speedNeedle.style.stroke = '#ffdd44';
    } else {
      this.speedEl.classList.remove('boosting');
      this.speedEl.classList.remove('high-speed');
      this.speedArc.style.stroke = '#44ff88';
      this.speedGlow.style.stroke = '#22cc66';
      this.speedNeedle.style.stroke = '#66ffaa';
    }

    this.speedGlow.style.opacity = String(0.15 + speedRatio * 0.45);

    // Boost meter
    if (boostTimer > 0) {
      this.boostContainer.classList.add('active');
      this.boostBarFill.style.width = `${Math.min(boostTimer / boostMaxDuration, 1) * 100}%`;
    } else {
      this.boostContainer.classList.remove('active');
    }

    // Drift indicator
    if (driftStage > DriftStage.None) {
      const stageNames = ['', 'MINI', 'SUPER', 'ULTRA'];
      const stageClasses = ['', 'blue', 'orange', 'pink'];
      this.driftIndicator.textContent = stageNames[driftStage] ?? '';
      this.driftIndicator.className = `hud-drift-indicator active ${stageClasses[driftStage] ?? ''}`;
    } else {
      this.driftIndicator.className = 'hud-drift-indicator';
    }

    // Warning
    if (isTargeted) {
      this.warningEl.classList.add('active');
    } else {
      this.warningEl.classList.remove('active');
    }
  }

  showHit(): void {
    this.hitOverlay.classList.remove('active');
    void this.hitOverlay.offsetWidth;
    this.hitOverlay.classList.add('active');
    setTimeout(() => this.hitOverlay.classList.remove('active'), 500);
  }

  showItemGet(): void {
    this.itemGetFlash.classList.remove('active');
    void this.itemGetFlash.offsetWidth;
    this.itemGetFlash.classList.add('active');
    setTimeout(() => this.itemGetFlash.classList.remove('active'), 400);
  }

  showLapNotification(lap: number, isFinal: boolean): void {
    if (this.lapNotifyEl) this.lapNotifyEl.remove();
    this.lapNotifyEl = document.createElement('div');
    this.lapNotifyEl.className = `lap-notification${isFinal ? ' final-lap' : ''}`;
    this.lapNotifyEl.textContent = isFinal ? 'FINAL LAP' : `LAP ${lap}`;
    if (this.side !== 'full') {
      if (this.side === 'left') {
        this.lapNotifyEl.style.left = '25%';
      } else {
        this.lapNotifyEl.style.left = '75%';
      }
    }
    this.container.appendChild(this.lapNotifyEl);
    setTimeout(() => {
      this.lapNotifyEl?.remove();
      this.lapNotifyEl = null;
    }, 1500);
  }

  private showPosChange(wentUp: boolean): void {
    if (this.posNotifyEl) this.posNotifyEl.remove();
    this.posNotifyEl = document.createElement('div');
    this.posNotifyEl.className = `pos-change-notify ${wentUp ? 'up' : 'down'}`;
    this.posNotifyEl.textContent = wentUp ? '▲' : '▼';
    if (this.side === 'right') {
      this.posNotifyEl.style.left = 'calc(50% + 24px)';
    }
    this.container.appendChild(this.posNotifyEl);
    setTimeout(() => {
      this.posNotifyEl?.remove();
      this.posNotifyEl = null;
    }, 1000);
  }

  show(): void {
    this.positionEl.style.display = '';
    this.lapContainer.style.display = '';
    this.itemContainer.style.display = '';
    this.speedContainer.style.display = '';
    this.boostContainer.style.display = '';
    this.driftIndicator.style.display = '';
  }

  hide(): void {
    this.positionEl.style.display = 'none';
    this.lapContainer.style.display = 'none';
    this.itemContainer.style.display = 'none';
    this.speedContainer.style.display = 'none';
    this.boostContainer.style.display = 'none';
    this.driftIndicator.style.display = 'none';
    this.warningEl.classList.remove('active');
    this.hitOverlay.classList.remove('active');
    this.lastPos = -1;
  }

  destroy(): void {
    this.positionEl.remove();
    this.lapContainer.remove();
    this.itemContainer.remove();
    this.speedContainer.remove();
    this.boostContainer.remove();
    this.driftIndicator.remove();
    this.warningEl.remove();
    this.hitOverlay.remove();
    this.itemGetFlash.remove();
    this.lapNotifyEl?.remove();
    this.posNotifyEl?.remove();
  }
}

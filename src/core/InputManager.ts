export interface InputState {
  accelerate: number;   // 0..1
  brake: number;        // 0..1
  steer: number;        // -1..1 (negative=left, positive=right)
  drift: boolean;
  useItem: boolean;
  lookBack: boolean;
  pause: boolean;
  confirm: boolean;
}

export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  drift: string;
  useItem: string;
  lookBack: string;
}

export const P1_KEYS: KeyBindings = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  drift: 'Slash',
  useItem: 'Backslash',
  lookBack: 'Period',
};

export const P2_KEYS: KeyBindings = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  drift: 'Digit2',
  useItem: 'Digit1',
  lookBack: 'KeyQ',
};

// Shared key set across all InputManager instances
const sharedKeys = new Set<string>();
let sharedKeysInitialized = false;

function initSharedKeys(): void {
  if (sharedKeysInitialized) return;
  sharedKeysInitialized = true;
  window.addEventListener('keydown', (e) => {
    sharedKeys.add(e.code);
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    sharedKeys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    sharedKeys.clear();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sharedKeys.clear();
  });
}

// ── Touch controls (shared singleton) ──
interface TouchState {
  steer: number;       // -1..1
  accelerate: number;  // 0..1
  brake: number;       // 0..1
  drift: boolean;
  useItem: boolean;
  pause: boolean;
}

let touchState: TouchState = {
  steer: 0, accelerate: 0, brake: 0, drift: false, useItem: false, pause: false,
};
let touchOverlay: HTMLElement | null = null;
let touchInitialized = false;

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function initTouchControls(): void {
  if (touchInitialized) return;
  touchInitialized = true;
  if (!isTouchDevice()) return;

  // Prevent pinch-zoom and pull-to-refresh
  document.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });

  const overlay = document.createElement('div');
  overlay.id = 'touch-controls';
  overlay.innerHTML = `
    <div class="touch-steer-zone" id="touch-steer-zone">
      <div class="touch-steer-knob" id="touch-steer-knob"></div>
    </div>
    <div class="touch-buttons">
      <button class="touch-btn touch-btn-accel" id="touch-accel">▲</button>
      <button class="touch-btn touch-btn-brake" id="touch-brake">▼</button>
      <button class="touch-btn touch-btn-drift" id="touch-drift">D</button>
      <button class="touch-btn touch-btn-item" id="touch-item">★</button>
      <button class="touch-btn touch-btn-pause" id="touch-pause">II</button>
    </div>
  `;
  document.body.appendChild(overlay);
  touchOverlay = overlay;

  // ── Steering (left side) ──
  const steerZone = document.getElementById('touch-steer-zone')!;
  const knob = document.getElementById('touch-steer-knob')!;
  let steerTouchId: number | null = null;
  let steerCenterX = 0;

  steerZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    steerTouchId = t.identifier;
    steerCenterX = t.clientX;
    knob.style.opacity = '1';
    knob.style.transform = 'translate(-50%, -50%)';
  }, { passive: false });

  const handleSteerMove = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === steerTouchId) {
        const dx = t.clientX - steerCenterX;
        const maxDist = 60;
        const clamped = Math.max(-maxDist, Math.min(maxDist, dx));
        touchState.steer = clamped / maxDist;
        knob.style.transform = `translate(calc(-50% + ${clamped}px), -50%)`;
      }
    }
  };

  steerZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    handleSteerMove(e);
  }, { passive: false });

  const endSteer = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === steerTouchId) {
        steerTouchId = null;
        touchState.steer = 0;
        knob.style.opacity = '0.5';
        knob.style.transform = 'translate(-50%, -50%)';
      }
    }
  };
  steerZone.addEventListener('touchend', endSteer);
  steerZone.addEventListener('touchcancel', endSteer);

  // ── Buttons (right side) ──
  const setupBtn = (id: string, onDown: () => void, onUp: () => void) => {
    const btn = document.getElementById(id)!;
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); });
    btn.addEventListener('touchcancel', (e) => { e.preventDefault(); onUp(); });
  };

  setupBtn('touch-accel',
    () => { touchState.accelerate = 1; },
    () => { touchState.accelerate = 0; },
  );
  setupBtn('touch-brake',
    () => { touchState.brake = 1; },
    () => { touchState.brake = 0; },
  );
  setupBtn('touch-drift',
    () => { touchState.drift = true; },
    () => { touchState.drift = false; },
  );
  setupBtn('touch-item',
    () => { touchState.useItem = true; },
    () => { touchState.useItem = false; },
  );
  setupBtn('touch-pause',
    () => { touchState.pause = true; },
    () => { touchState.pause = false; },
  );
}

export function showTouchControls(visible: boolean): void {
  if (touchOverlay) touchOverlay.style.display = visible ? '' : 'none';
}

export class InputManager {
  private keys: Set<string>;
  private gamepadIndex = -1;
  private _useItemPressed = false;
  private _pausePressed = false;
  private _confirmPressed = false;
  private prevUseItem = false;
  private prevPause = false;
  private prevConfirm = false;
  private bindings: KeyBindings | null;
  private useGamepad: boolean;

  constructor(bindings?: KeyBindings) {
    initSharedKeys();
    initTouchControls();
    this.keys = sharedKeys;
    this.bindings = bindings ?? null;
    this.useGamepad = !bindings; // Only use gamepad when no explicit bindings (legacy / P1 default)

    if (this.useGamepad) {
      window.addEventListener('gamepadconnected', (e) => {
        this.gamepadIndex = e.gamepad.index;
      });
      window.addEventListener('gamepaddisconnected', () => {
        this.gamepadIndex = -1;
      });
    }
  }

  poll(): InputState {
    const kb = this.pollKeyboard();
    const gp = this.useGamepad ? this.pollGamepad() : null;

    const tc = touchState;

    const state: InputState = {
      accelerate: Math.max(kb.accelerate, gp?.accelerate ?? 0, tc.accelerate),
      brake: Math.max(kb.brake, gp?.brake ?? 0, tc.brake),
      steer: (Math.abs(tc.steer) > 0.1) ? tc.steer
           : (gp && Math.abs(gp.steer) > 0.1) ? gp.steer
           : kb.steer,
      drift: kb.drift || (gp?.drift ?? false) || tc.drift,
      useItem: false,
      lookBack: kb.lookBack || (gp?.lookBack ?? false),
      pause: false,
      confirm: false,
    };

    // Edge detection for item/pause/confirm
    const rawUseItem = kb.useItem || (gp?.useItem ?? false) || tc.useItem;
    const rawPause = kb.pause || (gp?.pause ?? false) || tc.pause;
    const rawConfirm = kb.confirm || (gp?.confirm ?? false);

    state.useItem = rawUseItem && !this.prevUseItem;
    state.pause = rawPause && !this.prevPause;
    state.confirm = rawConfirm && !this.prevConfirm;

    this.prevUseItem = rawUseItem;
    this.prevPause = rawPause;
    this.prevConfirm = rawConfirm;

    return state;
  }

  private pollKeyboard(): InputState {
    if (this.bindings) {
      const b = this.bindings;
      return {
        accelerate: this.keys.has(b.up) ? 1 : 0,
        brake: this.keys.has(b.down) ? 1 : 0,
        steer: (this.keys.has(b.left) ? -1 : 0) + (this.keys.has(b.right) ? 1 : 0),
        drift: this.keys.has(b.drift),
        useItem: this.keys.has(b.useItem),
        lookBack: this.keys.has(b.lookBack),
        pause: this.keys.has('Escape'),
        confirm: this.keys.has('Enter') || this.keys.has('Space'),
      };
    }

    // Legacy default (no bindings) — original behavior for backward compat
    return {
      accelerate: (this.keys.has('ArrowUp') || this.keys.has('KeyW')) ? 1 : 0,
      brake: (this.keys.has('ArrowDown') || this.keys.has('KeyS')) ? 1 : 0,
      steer: ((this.keys.has('ArrowLeft') || this.keys.has('KeyA')) ? -1 : 0) +
             ((this.keys.has('ArrowRight') || this.keys.has('KeyD')) ? 1 : 0),
      drift: this.keys.has('Space') || this.keys.has('ShiftLeft'),
      useItem: this.keys.has('KeyX') || this.keys.has('KeyZ'),
      lookBack: this.keys.has('KeyC'),
      pause: this.keys.has('Escape') || this.keys.has('KeyP'),
      confirm: this.keys.has('Enter') || this.keys.has('Space'),
    };
  }

  private pollGamepad(): InputState {
    const empty: InputState = {
      accelerate: 0, brake: 0, steer: 0,
      drift: false, useItem: false, lookBack: false,
      pause: false, confirm: false,
    };

    if (this.gamepadIndex < 0) return empty;
    const gp = navigator.getGamepads()[this.gamepadIndex];
    if (!gp) return empty;

    const deadzone = 0.15;
    let steer = gp.axes[0] ?? 0;
    if (Math.abs(steer) < deadzone) steer = 0;

    return {
      accelerate: gp.buttons[7]?.value ?? 0,     // RT
      brake: gp.buttons[6]?.value ?? 0,           // LT
      steer,
      drift: gp.buttons[0]?.pressed ?? false,     // A
      useItem: gp.buttons[2]?.pressed ?? false,   // X
      lookBack: gp.buttons[1]?.pressed ?? false,  // B
      pause: gp.buttons[9]?.pressed ?? false,     // Start
      confirm: gp.buttons[0]?.pressed ?? false,   // A
    };
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }
}

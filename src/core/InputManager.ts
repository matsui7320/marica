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

    const state: InputState = {
      accelerate: gp ? Math.max(kb.accelerate, gp.accelerate) : kb.accelerate,
      brake: gp ? Math.max(kb.brake, gp.brake) : kb.brake,
      steer: (gp && Math.abs(gp.steer) > 0.1) ? gp.steer : kb.steer,
      drift: kb.drift || (gp?.drift ?? false),
      useItem: false,
      lookBack: kb.lookBack || (gp?.lookBack ?? false),
      pause: false,
      confirm: false,
    };

    // Edge detection for item/pause/confirm
    const rawUseItem = kb.useItem || (gp?.useItem ?? false);
    const rawPause = kb.pause || (gp?.pause ?? false);
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

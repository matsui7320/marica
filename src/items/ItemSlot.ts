import { ItemType, rollItem } from './ItemDistribution';

export class ItemSlot {
  currentItem: ItemType | null = null;
  isRolling = false;
  rollTimer = 0;
  /** True for a short window after rolling finishes (for HUD pop animation) */
  justDecided = false;
  private justDecidedTimer = 0;
  private rollDuration = 2.0;
  private rollPosition = 0;
  displayItem: ItemType | null = null;
  /** Increments each time displayItem changes (for HUD to detect swaps) */
  displayCycle = 0;
  private lastDisplayIdx = -1;

  startRoll(racePosition: number): void {
    if (this.currentItem !== null || this.isRolling) return;
    this.isRolling = true;
    this.rollTimer = 0;
    this.rollPosition = racePosition;
    this.justDecided = false;
    this.justDecidedTimer = 0;
    this.lastDisplayIdx = -1;
  }

  update(dt: number): void {
    // Tick "just decided" timer
    if (this.justDecided) {
      this.justDecidedTimer += dt;
      if (this.justDecidedTimer >= 0.5) {
        this.justDecided = false;
      }
    }

    if (!this.isRolling) return;

    this.rollTimer += dt;

    // Visual cycling — exponential slowdown for slot-machine feel
    const allItems: ItemType[] = ['mushroom', 'banana', 'greenShell', 'redShell', 'star', 'lightning'];
    const t = this.rollTimer / this.rollDuration; // 0→1 normalized progress
    // Accumulated "phase" using integral of exponential decay speed
    // Fast at start (~12 items/sec), slows to near-stop at end
    const maxSpeed = 14;
    const decay = 3.5;
    const phase = (maxSpeed / decay) * (1 - Math.exp(-decay * t));
    const idx = Math.floor(phase * allItems.length) % allItems.length;
    if (idx !== this.lastDisplayIdx) {
      this.lastDisplayIdx = idx;
      this.displayCycle++;
    }
    this.displayItem = allItems[idx];

    if (this.rollTimer >= this.rollDuration) {
      this.isRolling = false;
      this.currentItem = rollItem(this.rollPosition);
      this.displayItem = this.currentItem;
      this.justDecided = true;
      this.justDecidedTimer = 0;
      this.displayCycle++;
    }
  }

  useItem(): ItemType | null {
    if (this.currentItem === null || this.isRolling) return null;
    const item = this.currentItem;
    this.currentItem = null;
    this.displayItem = null;
    return item;
  }

  hasItem(): boolean {
    return this.currentItem !== null;
  }

  reset(): void {
    this.currentItem = null;
    this.isRolling = false;
    this.rollTimer = 0;
    this.displayItem = null;
  }
}

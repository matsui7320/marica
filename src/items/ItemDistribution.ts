import { TOTAL_RACERS } from '../constants';

export type ItemType = 'mushroom' | 'banana' | 'greenShell' | 'redShell' | 'star' | 'lightning';

// Distribution table: row = position (0-indexed), columns = item probabilities
const distributionTable: Record<number, Record<ItemType, number>> = {
  0: { mushroom: 15, banana: 35, greenShell: 30, redShell: 0, star: 0, lightning: 0 },
  1: { mushroom: 20, banana: 30, greenShell: 25, redShell: 5, star: 0, lightning: 0 },
  2: { mushroom: 20, banana: 25, greenShell: 20, redShell: 15, star: 5, lightning: 0 },
  3: { mushroom: 25, banana: 10, greenShell: 15, redShell: 20, star: 20, lightning: 5 },
  4: { mushroom: 20, banana: 10, greenShell: 10, redShell: 20, star: 25, lightning: 10 },
  5: { mushroom: 15, banana: 5, greenShell: 10, redShell: 15, star: 25, lightning: 25 },
  6: { mushroom: 12, banana: 3, greenShell: 5, redShell: 12, star: 25, lightning: 35 },
  7: { mushroom: 10, banana: 0, greenShell: 5, redShell: 10, star: 25, lightning: 40 },
};

export function rollItem(position: number): ItemType {
  const row = distributionTable[Math.min(position, TOTAL_RACERS - 1)] ?? distributionTable[3];
  const total = Object.values(row).reduce((s, v) => s + v, 0);
  let roll = Math.random() * total;

  for (const [item, weight] of Object.entries(row)) {
    roll -= weight;
    if (roll <= 0) return item as ItemType;
  }

  return 'mushroom';
}

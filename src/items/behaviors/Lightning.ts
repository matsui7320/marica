import { Kart } from '../../kart/Kart';
import { LIGHTNING_SHRINK_DURATION, LIGHTNING_SPEED_PENALTY } from '../../constants';

export function useLightning(user: Kart, allKarts: Kart[]): void {
  for (const kart of allKarts) {
    if (kart.index === user.index) continue;
    if (kart.state.starTimer > 0) continue;

    // Shrink and slow
    kart.state.shrinkTimer = LIGHTNING_SHRINK_DURATION;
    kart.state.speed *= (1 - LIGHTNING_SPEED_PENALTY);

    // Drop held items
    kart.heldItem = null;
  }
}

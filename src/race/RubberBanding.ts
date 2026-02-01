import { Kart } from '../kart/Kart';
import { RUBBER_BAND_LAST_BONUS, RUBBER_BAND_FIRST_PENALTY, TOTAL_RACERS, KART_MAX_SPEED } from '../constants';

export class RubberBanding {
  apply(karts: Kart[]): void {
    for (const kart of karts) {
      if (kart.isPlayer) continue;

      const pos = kart.racePosition;
      const normalized = (pos - 1) / (TOTAL_RACERS - 1); // 0 = first, 1 = last

      // Rubber band: boost slow karts, slow fast karts
      const bonus = normalized * RUBBER_BAND_LAST_BONUS;
      const penalty = (1 - normalized) * RUBBER_BAND_FIRST_PENALTY;
      const factor = 1 + bonus - penalty;

      // Apply as speed cap modifier
      const maxSpeed = KART_MAX_SPEED * factor;
      if (Math.abs(kart.state.speed) > maxSpeed) {
        kart.state.speed *= 0.995;
      }
    }
  }
}

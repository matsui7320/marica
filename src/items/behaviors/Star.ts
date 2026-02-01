import { Kart } from '../../kart/Kart';
import { STAR_DURATION, STAR_SPEED_BONUS } from '../../constants';

export function useStar(kart: Kart): void {
  kart.state.starTimer = STAR_DURATION;
  // Star makes kart invincible and faster
}

export function updateStar(kart: Kart, dt: number): boolean {
  if (kart.state.starTimer > 0) {
    kart.state.starTimer -= dt;
    // Rainbow flash effect handled elsewhere
    return true;
  }
  return false;
}

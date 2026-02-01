import { Kart } from '../../kart/Kart';
import { applyBoost } from '../../kart/KartPhysics';
import { MUSHROOM_BOOST_POWER, MUSHROOM_BOOST_DURATION } from '../../constants';

export function useMushroom(kart: Kart): void {
  applyBoost(kart.state, MUSHROOM_BOOST_POWER, MUSHROOM_BOOST_DURATION);
}

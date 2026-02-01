import { KartState } from './KartPhysics';
import { applyBoost } from './KartPhysics';
import {
  DRIFT_MIN_SPEED, DRIFT_STEER_MIN, DRIFT_CHARGE_RATE,
  DRIFT_STAGE_1_TIME, DRIFT_STAGE_2_TIME, DRIFT_STAGE_3_TIME,
  DRIFT_BOOST_1_DURATION, DRIFT_BOOST_1_POWER,
  DRIFT_BOOST_2_DURATION, DRIFT_BOOST_2_POWER,
  DRIFT_BOOST_3_DURATION, DRIFT_BOOST_3_POWER,
} from '../constants';

export enum DriftStage {
  None = 0,
  Blue = 1,
  Orange = 2,
  Pink = 3,
}

export class DriftSystem {
  stage = DriftStage.None;
  charge = 0;
  active = false;
  smartSteering = false;

  update(state: KartState, steerInput: number, driftHeld: boolean, dt: number): void {
    if (this.active) {
      if (!driftHeld || Math.abs(state.speed) < DRIFT_MIN_SPEED * 0.5) {
        this.endDrift(state);
        return;
      }

      // Accumulate charge based on steering input
      this.charge += DRIFT_CHARGE_RATE * dt * Math.abs(steerInput);

      // Update stage
      if (this.charge >= DRIFT_STAGE_3_TIME && !this.smartSteering) {
        this.stage = DriftStage.Pink;
      } else if (this.charge >= DRIFT_STAGE_2_TIME) {
        this.stage = DriftStage.Orange;
      } else if (this.charge >= DRIFT_STAGE_1_TIME) {
        this.stage = DriftStage.Blue;
      }
    } else {
      // Check if drift should start
      if (driftHeld && Math.abs(state.speed) >= DRIFT_MIN_SPEED && Math.abs(steerInput) >= DRIFT_STEER_MIN) {
        this.startDrift(state, steerInput);
      }
    }
  }

  private startDrift(state: KartState, steerInput: number): void {
    this.active = true;
    this.charge = 0;
    this.stage = DriftStage.None;
    state.isDrifting = true;
    state.driftDirection = steerInput > 0 ? 1 : -1;
  }

  private endDrift(state: KartState): void {
    // Apply boost based on stage
    if (this.stage >= DriftStage.Pink) {
      applyBoost(state, DRIFT_BOOST_3_POWER, DRIFT_BOOST_3_DURATION);
    } else if (this.stage >= DriftStage.Orange) {
      applyBoost(state, DRIFT_BOOST_2_POWER, DRIFT_BOOST_2_DURATION);
    } else if (this.stage >= DriftStage.Blue) {
      applyBoost(state, DRIFT_BOOST_1_POWER, DRIFT_BOOST_1_DURATION);
    }

    this.active = false;
    this.stage = DriftStage.None;
    this.charge = 0;
    state.isDrifting = false;
    state.driftDirection = 0;
  }

  cancel(): void {
    this.active = false;
    this.stage = DriftStage.None;
    this.charge = 0;
  }

  reset(): void {
    this.cancel();
  }
}

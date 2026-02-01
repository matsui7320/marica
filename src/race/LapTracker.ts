import { Kart } from '../kart/Kart';
import { CheckpointSystem } from '../track/CheckpointSystem';
import { TOTAL_LAPS } from '../constants';

export class LapTracker {
  private checkpointSystem: CheckpointSystem;
  private lapTimes: Map<number, number[]> = new Map();
  private lapStartTimes: Map<number, number> = new Map();

  constructor(checkpointSystem: CheckpointSystem) {
    this.checkpointSystem = checkpointSystem;
  }

  update(karts: Kart[], raceTime: number): { kartIndex: number; lap: number; finished: boolean }[] {
    const events: { kartIndex: number; lap: number; finished: boolean }[] = [];

    for (const kart of karts) {
      if (kart.finished) continue;

      const currentT = kart.state.lapProgress;
      const result = this.checkpointSystem.updateKart(kart, currentT);

      if (result.crossedFinish) {
        const startTime = this.lapStartTimes.get(kart.index) ?? 0;
        const lapTime = raceTime - startTime;

        if (!this.lapTimes.has(kart.index)) this.lapTimes.set(kart.index, []);
        this.lapTimes.get(kart.index)!.push(lapTime);
        this.lapStartTimes.set(kart.index, raceTime);

        const finished = kart.currentLap >= TOTAL_LAPS;
        if (finished) {
          kart.finished = true;
          kart.finishTime = raceTime;
        }

        events.push({ kartIndex: kart.index, lap: kart.currentLap, finished });
      }
    }

    return events;
  }

  getLapTimes(kartIndex: number): number[] {
    return this.lapTimes.get(kartIndex) ?? [];
  }

  reset(): void {
    this.lapTimes.clear();
    this.lapStartTimes.clear();
  }
}

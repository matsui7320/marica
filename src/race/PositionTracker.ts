import { Kart } from '../kart/Kart';

export class PositionTracker {
  update(karts: Kart[]): void {
    // Sort by: finished (earlier), then laps (more), then progress (higher)
    const sorted = [...karts].sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;

      if (a.currentLap !== b.currentLap) return b.currentLap - a.currentLap;

      // Same lap: compare checkpoint progress
      const aCP = a.checkpointsThisLap.size;
      const bCP = b.checkpointsThisLap.size;
      if (aCP !== bCP) return bCP - aCP;

      // Same checkpoints: compare spline t
      return b.state.lapProgress - a.state.lapProgress;
    });

    for (let i = 0; i < sorted.length; i++) {
      sorted[i].racePosition = i + 1;
    }
  }
}

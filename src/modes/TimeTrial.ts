import { TrackConfig } from '../track/TrackDefinition';

export class TimeTrial {
  private track: TrackConfig;
  bestLapTime = Infinity;
  bestTotalTime = Infinity;

  constructor(track: TrackConfig) {
    this.track = track;
  }

  getTrack(): TrackConfig {
    return this.track;
  }

  recordLapTime(time: number): void {
    if (time < this.bestLapTime) {
      this.bestLapTime = time;
    }
  }

  recordTotalTime(time: number): void {
    if (time < this.bestTotalTime) {
      this.bestTotalTime = time;
    }
  }
}

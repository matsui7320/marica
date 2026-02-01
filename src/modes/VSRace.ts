import { TrackConfig } from '../track/TrackDefinition';

export class VSRace {
  private track: TrackConfig;

  constructor(track: TrackConfig) {
    this.track = track;
  }

  getTrack(): TrackConfig {
    return this.track;
  }
}

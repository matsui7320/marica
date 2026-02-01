import { TrackConfig } from '../track/TrackDefinition';
import { GP_POINTS } from '../constants';

export interface GPStanding {
  kartIndex: number;
  points: number;
}

export class GrandPrix {
  private tracks: TrackConfig[];
  private standings: GPStanding[] = [];
  private currentRaceIndex = 0;

  constructor(tracks: TrackConfig[]) {
    this.tracks = tracks;
    for (let i = 0; i < 8; i++) {
      this.standings.push({ kartIndex: i, points: 0 });
    }
  }

  getCurrentTrack(): TrackConfig {
    return this.tracks[this.currentRaceIndex % this.tracks.length];
  }

  recordResults(finishPositions: { kartIndex: number; position: number }[]): void {
    for (const fp of finishPositions) {
      const standing = this.standings.find(s => s.kartIndex === fp.kartIndex);
      if (standing) {
        standing.points += GP_POINTS[fp.position - 1] ?? 0;
      }
    }
    this.currentRaceIndex++;
  }

  isComplete(): boolean {
    return this.currentRaceIndex >= this.tracks.length;
  }

  getStandings(): GPStanding[] {
    return [...this.standings].sort((a, b) => b.points - a.points);
  }

  getCurrentRaceNumber(): number {
    return this.currentRaceIndex + 1;
  }

  getTotalRaces(): number {
    return this.tracks.length;
  }

  reset(): void {
    this.currentRaceIndex = 0;
    for (const s of this.standings) s.points = 0;
  }
}

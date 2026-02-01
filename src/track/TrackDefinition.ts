import { SurfaceType } from '../kart/KartPhysics';

export interface TrackControlPoint {
  position: [number, number, number];
  width?: number;
  bank?: number;        // radians
  surface?: SurfaceType;
}

export interface TrackConfig {
  name: string;
  controlPoints: TrackControlPoint[];
  checkpointIndices: number[];  // indices into control points
  itemBoxPositions?: [number, number, number][];
  startHeading: number;
  environment: 'meadow' | 'volcano' | 'coastal' | 'frozen' | 'night';
}

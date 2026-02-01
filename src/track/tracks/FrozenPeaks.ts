import { TrackConfig } from '../TrackDefinition';

// Alpine switchback — zigzag ascent through mountain valley then descent
// NOT circular: the track snakes back and forth at different elevations
// ~1200m total length, elevation range 0–30m
//
// Parallel sections kept 50m+ apart in Z to avoid road overlap:
//   Phase 2 (west)   : z ≈ -195
//   Phase 3 (east)   : z ≈ -75
//   Phase 4 (plateau): z ≈ -115
//
export const FrozenPeaks: TrackConfig = {
  name: 'Frozen Peaks',
  environment: 'frozen',
  startHeading: Math.PI, // facing -Z (south)
  controlPoints: [
    // ── Phase 1: Start straight heading south ──
    { position: [0, 0, 0], width: 14 },
    { position: [0, 0, -35], width: 14 },
    { position: [0, 0, -70], width: 14 },
    { position: [0, 0, -110], width: 14 },

    // ── Turn 1: sweeping right to heading west ──
    { position: [-12, 0, -140], width: 13, bank: 0.12 },
    { position: [-32, 0, -162], width: 13, bank: 0.18 },
    { position: [-58, 0, -178], width: 13, bank: 0.12 },

    // ── Phase 2: west-northwest, pushed SOUTH to z≈-195 ──
    { position: [-92, 1, -192], width: 13 },
    { position: [-125, 3, -198], width: 13 },
    { position: [-160, 5, -198], width: 12 },
    { position: [-192, 7, -192], width: 12 },

    // ── Hairpin 1: right 180° wrapping around giant iceberg, climbing ──
    // Pushed west so road hugs the iceberg base (center at ~(-205, -1.5, -130))
    { position: [-240, 9, -185], width: 11, bank: 0.15 },
    { position: [-280, 11, -160], width: 11, bank: 0.20 },
    { position: [-300, 13, -130], width: 11, bank: 0.22 },
    { position: [-285, 14, -100], width: 11, bank: 0.18 },
    { position: [-245, 15, -78], width: 11, bank: 0.08 },

    // ── Phase 3: east heading back, still climbing — z≈-72 ──
    { position: [-185, 16, -72], width: 12 },
    { position: [-155, 17, -68], width: 12 },
    { position: [-125, 18, -68], width: 12 },
    { position: [-95, 19, -72], width: 12 },

    // ── Hairpin 2: left 180° to head west — steep climb to elevated plateau ──
    { position: [-72, 21, -80], width: 11, bank: -0.2 },
    { position: [-60, 23, -95], width: 11, bank: -0.25 },
    { position: [-62, 28, -112], width: 11, bank: -0.2 },
    { position: [-72, 29, -125], width: 11, bank: -0.12 },

    // ── Phase 4: west on high plateau — z≈-118, raised to clear Phase 3 below ──
    { position: [-95, 30, -118], width: 12 },
    { position: [-125, 30, -115], width: 12 },
    { position: [-155, 30, -115], width: 12 },

    // ── Turn 3: sweeping right heading north, descent begins ──
    { position: [-178, 29, -108], width: 13, bank: 0.15 },
    { position: [-195, 27, -92], width: 13, bank: 0.18 },
    { position: [-202, 25, -70], width: 13, bank: 0.12 },

    // ── Phase 5: northeast descent ──
    { position: [-200, 22, -48], width: 13 },
    { position: [-190, 16, -28], width: 13 },
    { position: [-172, 11, -10], width: 13 },

    // ── Phase 6: east, continuing descent ──
    { position: [-148, 7, 2], width: 14 },
    { position: [-120, 5, 10], width: 14 },
    { position: [-90, 3, 12], width: 14 },

    // ── Phase 7: sweeping right back to start — approach from north, heading south ──
    { position: [-60, 2, 10], width: 14 },
    { position: [-35, 1, 8], width: 14, bank: 0.06 },
    { position: [-14, 0.5, 8], width: 14, bank: 0.04 },
    { position: [-4, 0.2, 6], width: 14, bank: 0.02 },
  ],
  checkpointIndices: [3, 7, 12, 17, 21, 25, 29, 33, 37],
  itemBoxPositions: [
    [0, 1, -55],
    [0, 1, -100],
    [-45, 1, -175],
    [-150, 5, -198],
    [-300, 13, -130],
    [-195, 16, -74],
    [-110, 18, -70],
    [-62, 24, -100],
    [-140, 31, -116],
    [-198, 27, -80],
    [-180, 14, -18],
    [-100, 4, 10],
  ],
};

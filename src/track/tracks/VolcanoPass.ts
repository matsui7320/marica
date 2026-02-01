import { TrackConfig } from '../TrackDefinition';

// Volcanic mountain pass — dramatic elevation, lava field, wide sweeping curves
// No hairpins: all turns are wide arcs
// Clockwise heading south: S plateau descent → WSW into valley →
//   NW valley run → lava S-curve → NE uphill → ESE summit → approach from NE
// ~1250m total length, elevation range 0–12m
// Footprint ~250×310m
export const VolcanoPass: TrackConfig = {
  name: 'Volcano Pass',
  environment: 'volcano',
  startHeading: Math.PI, // facing -Z (south)
  controlPoints: [
    // ── Phase 1: Start/finish on plateau heading south ──
    { position: [0, 12, 0], width: 12 },
    { position: [0, 12, -40], width: 12 },
    { position: [0, 12, -82], width: 12 },
    { position: [0, 12, -125], width: 12 },

    // ── Turn 1: wide right heading WSW, descending ──
    { position: [-15, 11, -155], width: 11, bank: 0.15 },
    { position: [-38, 10, -178], width: 11, bank: 0.20 },
    { position: [-65, 9, -192], width: 11, bank: 0.15 },

    // ── Phase 2: WSW steep downhill ──
    { position: [-100, 7, -198], width: 11 },
    { position: [-138, 4, -195], width: 11 },
    { position: [-170, 2, -185], width: 11 },

    // ── Turn 2: wide right heading NNW into valley ──
    { position: [-192, 1, -168], width: 11, bank: 0.18 },
    { position: [-205, 0, -145], width: 11, bank: 0.20 },
    { position: [-210, 0, -118], width: 11, bank: 0.12 },

    // ── Phase 3: N valley run ──
    { position: [-208, 0, -85], width: 11 },
    { position: [-202, 0, -52], width: 11 },

    // ── S-curve through lava field ──
    { position: [-195, 0, -22], width: 10, bank: -0.10 },
    { position: [-185, 1, 5], width: 10, bank: 0.10 },
    { position: [-178, 1, 32], width: 10 },

    // ── Turn 3: wide right heading ENE, begin climb ──
    { position: [-165, 2, 55], width: 10, bank: 0.15 },
    { position: [-145, 3, 72], width: 11, bank: 0.18 },
    { position: [-120, 4, 82], width: 11, bank: 0.12 },

    // ── Phase 4: ENE uphill ──
    { position: [-90, 6, 85], width: 11 },
    { position: [-62, 8, 82], width: 11, bank: -0.06 },
    { position: [-35, 10, 75], width: 12, bank: 0.06 },

    // ── Turn 4: wide right heading ESE on summit ──
    { position: [-15, 11, 60], width: 12, bank: 0.12 },
    { position: [-5, 12, 42], width: 12, bank: 0.14 },
    { position: [-2, 12, 22], width: 12, bank: 0.10 },

    // ── Approach: heading SSE back to start ──
    { position: [-2, 12, 8], width: 12 },
  ],
  checkpointIndices: [3, 7, 11, 15, 19, 23, 27],
  itemBoxPositions: [
    [0, 12, -62],
    [0, 12, -110],
    [-52, 10, -188],
    [-152, 3, -190],
    [-205, 0, -132],
    [-200, 0, -65],
    [-188, 1, 12],
    [-148, 3, 70],
    [-72, 7, 82],
    [-18, 11, 55],
  ],
};

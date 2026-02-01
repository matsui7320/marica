import { TrackConfig } from '../TrackDefinition';

// Rolling meadow circuit — elongated loop with S-curves and hilltop esses
// Clockwise: south → WSW → NW climb → NE plateau esses → ESE descent → back
// ~1200m total length, elevation range 0–15m
// Footprint ~320×280m
export const CircuitMeadow: TrackConfig = {
  name: 'Circuit Meadow',
  environment: 'meadow',
  startHeading: Math.PI, // facing -Z (south)
  controlPoints: [
    // ── Phase 1: Start/finish straight heading south ──
    { position: [0, 0, 0], width: 14 },
    { position: [0, 0, -45], width: 14 },
    { position: [0, 0, -90], width: 14 },
    { position: [0, 0, -135], width: 14 },
    { position: [0, 0, -178], width: 14 },

    // ── Turn 1: gentle right heading WSW ──
    { position: [-15, 0, -208], width: 13, bank: 0.12 },
    { position: [-38, 0, -230], width: 13, bank: 0.18 },
    { position: [-65, 0, -245], width: 13, bank: 0.12 },

    // ── Phase 2: WSW with rolling hills ──
    { position: [-100, 1, -255], width: 13 },
    { position: [-138, 3, -260], width: 13 },
    { position: [-172, 5, -258], width: 12 },

    // ── Turn 2: sweeping right heading NW, climbing ──
    { position: [-202, 7, -248], width: 12, bank: 0.15 },
    { position: [-225, 9, -230], width: 12, bank: 0.18 },
    { position: [-242, 11, -208], width: 12, bank: 0.15 },

    // ── Phase 3: NW climb with hilltop S-curve ──
    { position: [-252, 12, -180], width: 12 },
    { position: [-258, 13, -150], width: 12, bank: -0.08 },
    { position: [-256, 14, -120], width: 12, bank: 0.08 },
    { position: [-250, 15, -92], width: 12 },

    // ── Turn 3: right heading NE on hilltop ──
    { position: [-240, 15, -68], width: 12, bank: 0.14 },
    { position: [-222, 14, -48], width: 13, bank: 0.18 },
    { position: [-202, 13, -35], width: 13, bank: 0.12 },

    // ── Phase 4: NE → E plateau with gentle esses ──
    { position: [-175, 12, -28], width: 13 },
    { position: [-145, 11, -25], width: 13, bank: -0.06 },
    { position: [-115, 10, -28], width: 13, bank: 0.06 },
    { position: [-88, 9, -25], width: 13 },

    // ── Phase 5: ESE descent ──
    { position: [-62, 7, -18], width: 14 },
    { position: [-40, 5, -8], width: 14 },

    // ── Smooth return curve — approach start from north, heading south ──
    { position: [-22, 3, 8], width: 14, bank: 0.06 },
    { position: [-8, 1.5, 16], width: 14, bank: 0.04 },
    { position: [0, 0.5, 14], width: 14 },
    { position: [0, 0.1, 6], width: 14 },
  ],
  checkpointIndices: [3, 8, 12, 16, 20, 24, 28],
  itemBoxPositions: [
    [0, 1, -68],
    [0, 1, -155],
    [-52, 1, -240],
    [-152, 4, -258],
    [-235, 10, -220],
    [-255, 13, -135],
    [-230, 14, -55],
    [-160, 12, -26],
    [-100, 10, -26],
    [-48, 6, -12],
    [-4, 1, 15],
  ],
};

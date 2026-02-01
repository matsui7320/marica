import { TrackConfig } from '../TrackDefinition';

// Coastal highway — wide sweeping turns, cliff section, scenic S-curves
// No hairpins: all turns are wide arcs
// Clockwise: south → WSW coast → NW cliff → N scenic S-curves → NE → ESE return
// ~1350m total length, elevation range 1–11m
// Footprint ~330×340m
export const CoastalDrift: TrackConfig = {
  name: 'Coastal Drift',
  environment: 'coastal',
  startHeading: Math.PI, // facing -Z (south)
  controlPoints: [
    // ── Phase 1: Start/finish straight heading south, seaside ──
    { position: [0, 2, 0], width: 15 },
    { position: [0, 2, -50], width: 15 },
    { position: [0, 2, -100], width: 15 },
    { position: [0, 2, -150], width: 15 },
    { position: [0, 2, -200], width: 14 },

    // ── Turn 1: banked right heading WSW ──
    { position: [-18, 2, -232], width: 14, bank: 0.14 },
    { position: [-45, 2, -258], width: 14, bank: 0.20 },
    { position: [-78, 2, -272], width: 14, bank: 0.14 },

    // ── Phase 2: WSW coastal highway with gentle climb ──
    { position: [-115, 3, -280], width: 14 },
    { position: [-155, 4, -282], width: 13 },
    { position: [-192, 5, -278], width: 13 },

    // ── Cliffside sweeper ──
    { position: [-222, 6, -268], width: 13, bank: 0.10 },
    { position: [-248, 7, -252], width: 13, bank: -0.08 },
    { position: [-268, 8, -230], width: 13 },

    // ── Turn 2: right heading NNW along cliff ──
    { position: [-282, 9, -205], width: 13, bank: 0.16 },
    { position: [-290, 10, -175], width: 13, bank: 0.18 },
    { position: [-292, 10, -145], width: 13 },

    // ── Phase 3: North cliff section with scenic S-curves ──
    { position: [-290, 10, -112], width: 13 },
    { position: [-285, 10, -80], width: 13 },
    { position: [-282, 9, -50], width: 13, bank: -0.08 },
    { position: [-288, 10, -22], width: 13, bank: 0.08 },
    { position: [-285, 9, 5], width: 13 },
    { position: [-278, 8, 30], width: 13 },

    // ── Turn 3: right heading ESE ──
    { position: [-262, 7, 48], width: 13, bank: 0.14 },
    { position: [-238, 6, 58], width: 13, bank: 0.16 },
    { position: [-212, 5, 60], width: 14, bank: 0.10 },

    // ── Phase 4: ESE return, descent ──
    { position: [-180, 4, 55], width: 14 },
    { position: [-148, 3, 48], width: 14 },
    { position: [-115, 3, 38], width: 14 },
    { position: [-82, 2, 30], width: 15 },

    // ── Sweeping S approach ──
    { position: [-52, 2, 25], width: 15, bank: -0.06 },
    { position: [-28, 2, 22], width: 15, bank: 0.08 },

    // ── Turn 4: right back to start ──
    { position: [-12, 2, 18], width: 15, bank: 0.08 },
    { position: [-4, 2, 8], width: 15, bank: 0.06 },
  ],
  checkpointIndices: [3, 8, 13, 17, 22, 26, 30, 34],
  itemBoxPositions: [
    [0, 3, -75],
    [0, 3, -175],
    [-62, 2, -268],
    [-175, 5, -280],
    [-258, 8, -240],
    [-290, 10, -145],
    [-286, 10, -65],
    [-285, 9, 15],
    [-242, 6, 55],
    [-155, 3, 48],
    [-90, 2, 30],
    [-35, 2, 22],
  ],
};

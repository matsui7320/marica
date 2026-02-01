import { TrackConfig } from '../TrackDefinition';

// Long technical circuit — large loop with flowing S-curves
// No hairpins: all turns are wide sweeping arcs
// ~1900m total length, elevation range 1–141m
// Footprint ~380×420m
// Main straight climbs steadily; vertical loop after Turn 2; barrel roll on east return
//
// Shape viewed from above:
//
//        ┌─── Turn4 (right back to start) ──────────────────────┐
//        │                                                       │
//   East │                                                       │ Start
//  return│       Wide S-curves                                   │ straight
//   leg  │       on descent                                      │ (south)
//        │                                                       │
//  Turn3 │     Technical esses                                   │
// (right)│     heading north                                     │
//        │                                                       │
//        └─── Turn2 (wide right, climbing) ─── Turn1 (right) ───┘
//                    West-NW diagonal
//
export const StarlightHighway: TrackConfig = {
  name: 'Starlight Highway',
  environment: 'night',
  startHeading: Math.PI, // facing -Z (south)
  controlPoints: [
    // ── Phase 1: Main straight heading south — steady uphill climb ──
    { position: [0, 1, 0], width: 15 },
    { position: [0, 1, -55], width: 15 },
    { position: [0, 3, -110], width: 15 },
    { position: [0, 6, -165], width: 15 },
    { position: [0, 9, -220], width: 15 },
    { position: [0, 13, -270], width: 14 },
    { position: [0, 17, -320], width: 14 },

    // ── Turn 1: wide right heading west, still climbing ──
    { position: [-20, 19, -348], width: 14, bank: 0.15 },
    { position: [-48, 22, -368], width: 14, bank: 0.20 },
    { position: [-80, 24, -378], width: 14, bank: 0.15 },

    // ── Phase 2: west-northwest diagonal, steep climb to summit ──
    { position: [-118, 27, -386], width: 13 },
    // ── Vertical loop: parametric circle, R=57, 17 points for smooth curvature ──
    //   Center Y=85, top Y=142. Entry/exit separated by ~45m horizontal, 16m in Z.
    //   Surface gravity: kart sticks to road, world gravity affects speed on slopes.
    { position: [-130, 28, -384], width: 12, surface: 'antigravity' },    // 0°   bottom entry
    { position: [-155, 32, -383], width: 12, surface: 'antigravity' },    // 22.5° ascending
    { position: [-176, 45, -382], width: 12, surface: 'antigravity' },    // 45°
    { position: [-191, 63, -381], width: 12, surface: 'antigravity' },    // 67.5°
    { position: [-198, 85, -380], width: 12, surface: 'antigravity' },    // 90°  left side
    { position: [-197, 107, -379], width: 12, surface: 'antigravity' },   // 112.5°
    { position: [-187, 125, -378], width: 12, surface: 'antigravity' },   // 135°
    { position: [-172, 138, -377], width: 12, surface: 'antigravity' },   // 157.5°
    { position: [-153, 142, -376], width: 12, surface: 'antigravity' },   // 180° top
    { position: [-134, 138, -375], width: 12, surface: 'antigravity' },   // 202.5°
    { position: [-118, 125, -374], width: 12, surface: 'antigravity' },   // 225°
    { position: [-108, 107, -373], width: 12, surface: 'antigravity' },   // 247.5°
    { position: [-107, 85, -372], width: 12, surface: 'antigravity' },    // 270° right side
    { position: [-114, 63, -371], width: 12, surface: 'antigravity' },    // 292.5°
    { position: [-129, 45, -370], width: 12, surface: 'antigravity' },    // 315°
    { position: [-150, 32, -369], width: 12, surface: 'antigravity' },    // 337.5° descending
    { position: [-175, 28, -368], width: 12, surface: 'antigravity' },    // 360° bottom exit

    // ── Transition: resume climb toward Turn 2 ──
    { position: [-205, 30, -358], width: 13 },
    { position: [-225, 33, -348], width: 13 },

    // ── Turn 2: sweeping right heading north, cresting ──
    { position: [-250, 35, -330], width: 13, bank: 0.15 },
    { position: [-272, 35, -305], width: 12, bank: 0.20 },
    { position: [-285, 35, -275], width: 12, bank: 0.18 },
    { position: [-292, 35, -245], width: 12, bank: 0.12 },

    // ── Phase 3: Technical esses heading north on high plateau ──
    { position: [-295, 34, -212], width: 12, bank: -0.12 },
    { position: [-288, 33, -180], width: 12, bank: 0.12 },
    { position: [-282, 31, -150], width: 12, bank: -0.10 },
    { position: [-285, 29, -120], width: 12, bank: 0.08 },

    // ── Phase 3b: continue through long esses, descending ──
    { position: [-280, 26, -90], width: 12, bank: -0.08 },
    { position: [-275, 23, -62], width: 12, bank: 0.10 },
    { position: [-278, 20, -35], width: 12 },

    // ── Turn 3: sweeping right heading east, climbing to barrel roll ──
    { position: [-275, 17, -10], width: 12, bank: 0.15 },
    { position: [-265, 22, 8], width: 13, bank: 0.18 },
    { position: [-248, 28, 22], width: 13, bank: 0.15 },
    { position: [-225, 35, 30], width: 13 },

    // ── Anti-gravity barrel roll (road twists 360°) ──
    { position: [-210, 35, 31], width: 12, surface: 'antigravity' },
    { position: [-198, 35, 31], width: 12, bank: Math.PI * 0.5, surface: 'antigravity' },
    { position: [-186, 35, 30], width: 12, bank: Math.PI, surface: 'antigravity' },
    { position: [-174, 35, 29], width: 12, bank: Math.PI * 1.5, surface: 'antigravity' },
    { position: [-162, 35, 28], width: 12, bank: Math.PI * 2, surface: 'antigravity' },

    // ── Resume descent after barrel roll ──
    { position: [-148, 28, 26], width: 13 },
    { position: [-135, 16, 23], width: 14 },

    // ── Wide S-curves on descent ──
    { position: [-108, 2.5, 15], width: 14, bank: -0.10 },
    { position: [-85, 2, 0], width: 14, bank: 0.10 },
    { position: [-68, 1.5, -15], width: 14, bank: -0.08 },
    { position: [-55, 1, 0], width: 14, bank: 0.08 },

    // ── Turn 4: gentle right back to start, flat approach ──
    { position: [-38, 1, 10], width: 15, bank: 0.08 },
    { position: [-22, 1, 8], width: 15, bank: 0.06 },
    { position: [-10, 1, 5], width: 15, bank: 0.04 },
  ],
  // Indices: 0-6 Phase1, 7-9 Turn1, 10 Phase2, 11-27 VerticalLoop(17pts),
  // 28-29 Transition, 30-33 Turn2, 34-37 Phase3, 38-40 Phase3b,
  // 41-44 Turn3, 45-49 BarrelRoll, 50-51 Descent, 52-55 S-curves, 56-58 Turn4
  checkpointIndices: [3, 8, 19, 31, 36, 40, 43, 47, 54],
  itemBoxPositions: [
    [0, 3, -82],
    [0, 8, -195],
    [0, 16, -295],
    [-62, 23, -376],
    [-215, 31, -355],
    [-268, 35, -310],
    [-292, 35, -238],
    [-294, 34, -225],
    [-284, 31, -155],
    [-278, 22, -48],
    [-248, 11, 22],
    [-186, 9, 30],
    [-140, 5, 24],
    [-95, 2, 5],
    [-62, 2, -8],
    [-30, 1, 8],
  ],
};

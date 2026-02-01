// Physics
export const PHYSICS_HZ = 120;
export const PHYSICS_DT = 1 / PHYSICS_HZ;
export const MAX_PHYSICS_STEPS = 4;

// Kart
export const KART_MAX_SPEED = 24;
export const KART_ACCELERATION = 14;
export const KART_BRAKE_DECEL = 25;
export const KART_COAST_DECEL = 12;
export const KART_REVERSE_MAX_SPEED = 7;
export const KART_REVERSE_ACCEL = 10;
export const KART_STEER_RATE = 2.8;
export const KART_STEER_SPEED_FACTOR = 0.6;
export const KART_GRIP = 0.92;
export const KART_DRIFT_GRIP = 0.75;
export const KART_COLLISION_RADIUS = 1.8;
export const KART_BOUNCE_FACTOR = 0.5;
export const KART_MASS = 1.0;

// Gravity & Jump
export const GRAVITY = 30;
export const JUMP_VELOCITY = 12;
export const SUSPENSION_BOUNCE = 0.3;

// Drift
export const DRIFT_MIN_SPEED = 10;
export const DRIFT_STEER_MIN = 0.3;
export const DRIFT_CHARGE_RATE = 1.0;
export const DRIFT_STAGE_1_TIME = 0.5;
export const DRIFT_STAGE_2_TIME = 1.2;
export const DRIFT_STAGE_3_TIME = 2.0;
export const DRIFT_BOOST_1_DURATION = 0.5;
export const DRIFT_BOOST_1_POWER = 0.20;
export const DRIFT_BOOST_2_DURATION = 1.0;
export const DRIFT_BOOST_2_POWER = 0.30;
export const DRIFT_BOOST_3_DURATION = 1.5;
export const DRIFT_BOOST_3_POWER = 0.40;
export const DRIFT_ANGLE_ADDITION = 0.6;
export const DRIFT_INNER_STEER_FACTOR = 0.4;

// Track
export const TRACK_DEFAULT_WIDTH = 12;
export const TRACK_SPLINE_SEGMENTS = 1000;
export const OFFROAD_SPEED_FACTOR = 0.4;
export const BOOST_PAD_SPEED_BONUS = 0.3;
export const BOOST_PAD_DURATION = 1.0;
export const WALL_PUSH_FORCE = 60;
export const WALL_SPEED_LOSS = 0.7;

// Camera
export const CAM_DISTANCE = 5;
export const CAM_HEIGHT = 2.2;
export const CAM_LOOK_AHEAD = 8;
export const CAM_FOV_NORMAL = 80;
export const CAM_FOV_BOOST = 100;
export const CAM_FOV_LERP_SPEED = 5;

// Items
export const ITEM_BOX_RESPAWN_TIME = 5;
export const MUSHROOM_BOOST_POWER = 0.35;
export const MUSHROOM_BOOST_DURATION = 1.5;
export const BANANA_SPIN_DURATION = 1.2;
export const GREEN_SHELL_SPEED = 100;
export const RED_SHELL_SPEED = 90;
export const RED_SHELL_TURN_RATE = 4;
export const STAR_DURATION = 8;
export const STAR_SPEED_BONUS = 0.25;
export const LIGHTNING_SHRINK_DURATION = 5;
export const LIGHTNING_SPEED_PENALTY = 0.4;
export const SHELL_HIT_SPIN_DURATION = 1.5;

// AI
export const AI_LOOKAHEAD_DISTANCE = 30;
export const AI_PATH_NOISE_EASY = 3.0;
export const AI_PATH_NOISE_HARD = 0.5;
export const AI_REACTION_DELAY_EASY = 0.4;
export const AI_REACTION_DELAY_HARD = 0.05;
export const RUBBER_BAND_LAST_BONUS = 0.15;
export const RUBBER_BAND_FIRST_PENALTY = 0.05;

// Race
export const TOTAL_LAPS = 3;
export const TOTAL_RACERS = 8;
export const COUNTDOWN_DURATION = 4;

// Particles
export const PARTICLE_POOL_SIZE = 1024;
export const SPARK_LIFETIME = 0.4;
export const DUST_LIFETIME = 0.8;
export const FLAME_LIFETIME = 0.3;

// Colors
export const DRIFT_COLOR_BLUE = 0x4488ff;
export const DRIFT_COLOR_ORANGE = 0xff8800;
export const DRIFT_COLOR_PINK = 0xff44aa;
export const BOOST_FLAME_COLOR = 0xff6600;
export const STAR_COLOR = 0xffdd00;

// Kart colors (for 8 racers)
export const KART_COLORS = [
  0xff0000, // Player - Red
  0x0066ff, // Blue
  0x00cc44, // Green
  0xffcc00, // Yellow
  0xff66cc, // Pink
  0x8844ff, // Purple
  0xff8800, // Orange
  0x00cccc, // Cyan
];

// Grand Prix points
export const GP_POINTS = [15, 12, 10, 8, 6, 4, 2, 1];

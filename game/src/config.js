// NIGHTJAR — a tiny game of shadows and keycards.
// Every tuning number, colour and level layout lives in this one file. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule depends on screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  size: 26,
  radius: 13,
  walkSpeed: 152,
  sneakSpeed: 82,
  noiseRadius: 74,
  startCoins: 3,
};

export const GUARD = {
  size: 28,
  radius: 14,
  chaseSpeed: 132,
  investigateSpeed: 96,
  turnRate: 3.4,
  viewRange: 178,
  viewHalfAngle: 0.62, // radians, ~35.5 degrees each side
  nearRadius: 44, // inside this ring a guard feels you even outside the cone
  catchRadius: 27,
  loseSightAfter: 3.2, // seconds without line of sight before an alert guard gives up
};

export const SCORE = {
  loot: 100,
  levelClear: 500,
  ghostBonus: 300, // per level: never fully spotted
  secondBonus: 4, // per second left on the level par, times level number
};

export const PALETTE = {
  backdrop: '#070a12',
  floorA: '#161c2b',
  floorB: '#141a28',
  rug: '#1f2a44',
  rugEdge: '#2c3c5e',
  wall: '#39445e',
  wallTop: '#4d5c7d',
  wallSide: '#232c42',
  crate: '#7a5a34',
  crateDark: '#5d4426',
  crateLine: '#97753f',
  exit: '#39d98a',
  exitDark: '#14532d',
  keycard: '#f2c94c',
  gem: '#7ee0ff',
  player: '#2dd4bf',
  playerDark: '#0f766e',
  scarf: '#f59e0b',
  guard: '#64748b',
  guardDark: '#334155',
  guardCap: '#1e293b',
  coneCalm: 'rgba(250, 204, 21, 0.14)',
  coneWarn: 'rgba(251, 146, 60, 0.20)',
  coneAlert: 'rgba(248, 113, 113, 0.26)',
  text: '#eef1f5',
  muted: '#93a0b4',
  danger: '#f87171',
  panel: 'rgba(10, 14, 24, 0.72)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nightjar.best';

// Level data. Walls and crates are solid rectangles that also block sight. Guards patrol their
// waypoints in order; a guard with a single waypoint stands there and slowly sweeps its gaze.
// The exit stays locked until the player carries the keycard.
export const LEVELS = [
  {
    name: 'Level 1 — The Lobby',
    objective: 'Take the keycard, then slip out through the green exit. Unseen.',
    parSeconds: 75,
    walls: [
      { x: 600, y: 24, w: 26, h: 246 },
      { x: 600, y: 436, w: 26, h: 260 },
      { x: 150, y: 452, w: 300, h: 26 },
      { x: 902, y: 170, w: 26, h: 300 },
    ],
    crates: [
      { x: 300, y: 170, w: 48, h: 48 },
      { x: 356, y: 170, w: 48, h: 48 },
      { x: 760, y: 540, w: 48, h: 48 },
      { x: 470, y: 560, w: 48, h: 48 },
      { x: 1010, y: 330, w: 48, h: 48 },
      { x: 240, y: 300, w: 48, h: 48 },
    ],
    guards: [
      { waypoints: [[330, 130], [520, 130], [520, 330], [330, 330]], speed: 62 },
      { waypoints: [[1010, 560], [760, 560], [760, 380], [1010, 380]], speed: 58 },
    ],
    playerStart: [84, 624],
    keycard: [1150, 118],
    loot: [
      [352, 566],
      [700, 118],
    ],
    exit: { x: 1176, y: 560, w: 80, h: 110 },
  },
  {
    name: 'Level 2 — The Archive',
    objective: 'The archive keycard is watched. Use the shelves. Use the coins.',
    parSeconds: 95,
    walls: [
      { x: 300, y: 24, w: 26, h: 420 },
      { x: 300, y: 560, w: 26, h: 136 },
      { x: 640, y: 150, w: 26, h: 420 },
      { x: 640, y: 640, w: 26, h: 56 },
      { x: 950, y: 24, w: 26, h: 300 },
      { x: 950, y: 440, w: 26, h: 256 },
      { x: 326, y: 300, w: 314, h: 24 },
    ],
    crates: [
      { x: 130, y: 170, w: 48, h: 48 },
      { x: 130, y: 226, w: 48, h: 48 },
      { x: 470, y: 470, w: 48, h: 48 },
      { x: 760, y: 240, w: 48, h: 48 },
      { x: 1080, y: 540, w: 48, h: 48 },
      { x: 520, y: 96, w: 48, h: 48 },
      { x: 1080, y: 130, w: 48, h: 48 },
    ],
    guards: [
      { waypoints: [[170, 620], [170, 120], [520, 120]], speed: 68 },
      { waypoints: [[800, 620], [800, 420], [520, 420], [520, 620]], speed: 66 },
      { waypoints: [[1100, 380]], speed: 0, sweep: 1.1 },
    ],
    playerStart: [84, 96],
    keycard: [1130, 620],
    loot: [
      [480, 520],
      [800, 110],
      [120, 420],
    ],
    exit: { x: 24, y: 560, w: 80, h: 110 },
  },
  {
    name: 'Level 3 — The Vault',
    objective: 'Four guards. One vault card. Everything you have learned.',
    parSeconds: 120,
    walls: [
      { x: 420, y: 120, w: 26, h: 480 },
      { x: 420, y: 24, w: 26, h: 40 },
      { x: 800, y: 120, w: 26, h: 480 },
      { x: 800, y: 24, w: 26, h: 40 },
      { x: 120, y: 330, w: 300, h: 26 },
      { x: 826, y: 330, w: 300, h: 26 },
      { x: 560, y: 470, w: 160, h: 26 },
    ],
    crates: [
      { x: 200, y: 130, w: 48, h: 48 },
      { x: 200, y: 540, w: 48, h: 48 },
      { x: 1030, y: 130, w: 48, h: 48 },
      { x: 1030, y: 540, w: 48, h: 48 },
      { x: 616, y: 200, w: 48, h: 48 },
      { x: 616, y: 560, w: 48, h: 48 },
      { x: 90, y: 440, w: 48, h: 48 },
      { x: 1140, y: 240, w: 48, h: 48 },
    ],
    guards: [
      { waypoints: [[220, 220], [340, 220], [340, 560], [220, 560]], speed: 74 },
      { waypoints: [[1060, 470], [920, 470], [920, 180], [1060, 180]], speed: 72 },
      { waypoints: [[620, 620], [620, 380], [700, 380], [700, 620]], speed: 70 },
      { waypoints: [[620, 110]], speed: 0, sweep: 1.4 },
    ],
    playerStart: [84, 624],
    keycard: [624, 90],
    loot: [
      [240, 400],
      [1040, 400],
      [624, 660],
    ],
    exit: { x: 1176, y: 300, w: 80, h: 120 },
  },
];

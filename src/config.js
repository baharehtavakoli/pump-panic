// ─────────────────────────────────────────────────────────────
// config.js — every number that changes how the game FEELS.
// Tweak these to make the game easier, harder, longer or shorter.
// ─────────────────────────────────────────────────────────────

export const CONFIG = {
  shiftSeconds: 90, // length of one shift (one game)
  maxExplosions: 3, // this many explosions = station down, game over

  // The shift starts with Hall A (3 pumps). Hall B (3 more) powers on here.
  hallBOnlineAt: 30, // seconds into the shift

  // How often a new problem appears (seconds). Starts slow, ends fast.
  // (Tuned with a simulated player: fast players finish clean, average
  //  players survive with 1–2 booms, slow players lose the station ~80s.)
  spawnEvery: { start: 3.5, end: 1.15 },
  firstTroubleAt: 1.2, // seconds after start

  // How fast a problem gets worse (danger % per second).
  // 20 means a pump explodes ~5 seconds after its problem starts.
  dangerPerSecond: { start: 13, end: 27 },

  repairSeconds: 6, // how long an exploded pump is out of service

  // Tool gestures
  coolHoldSeconds: 1, // hold COOL this long
  fixTaps: 4, // tap FIX this many times
  noTargetLockout: 0.5, // seconds the buttons rest after pressing one nobody needs

  // Points
  pointsPerSave: 100,
  maxCombo: 4, // saves in a row multiply points, up to this
  waterPerPumpSecond: 4, // m³ delivered per working pump per second
};

// The three kinds of trouble and the tool that fixes each one
export const TROUBLES = {
  heat: {
    label: 'Overheating',
    tool: 'cool',
    hint: 'Press COOL, then hold to spray',
  },
  pressure: {
    label: 'Pressure spike',
    tool: 'vent',
    hint: 'Press VENT, then drag the lever up',
  },
  clog: {
    label: 'Clogged',
    tool: 'fix',
    hint: 'Press FIX, then tap to tighten 4 bolts',
  },
};

// Funny lines when the player presses a tool no pump needs right now
export const NO_TARGET = {
  cool: "Everyone's chill. Nobody needs COOL.",
  vent: 'No pressure! (Literally.) Nobody needs VENT.',
  fix: 'Nothing to fix… yet.',
};

// Verb shown above the gesture, e.g. "Cooling Pump 2"
export const TOOL_VERB = { cool: 'Cooling', vent: 'Venting', fix: 'Fixing' };

export const SAVE_LINES = ['Saved!', 'Crisis averted!', 'Smooth.', 'Like a pro.', 'Nice save!'];
export const BOOM_LINES = [
  'That one is going in the incident report.',
  'Well… that was loud.',
  'Maintenance has been notified. Again.',
];

// Rank titles at the end, by score
export const RANKS = [
  { min: 0, title: 'Panicked Intern' },
  { min: 7000, title: 'Junior Operator' },
  { min: 12000, title: 'Shift Supervisor' },
  { min: 16000, title: 'Control Room Pro' },
  { min: 19000, title: 'Pump Whisperer' },
];

// The world: player, guards, keycard, loot, coins and the rules that bind them. Pure simulation,
// no drawing and no DOM — the renderer reads state, the loop feeds it input, and the screenshot
// scenes drive it with a pilot. Guards see through a vision cone that walls and crates block;
// being seen fills their suspicion, a full meter means a chase, and a chase that touches you
// ends the run.

import { FIELD, GUARD, LEVELS, PLAYER, SCORE } from './config.js';

export const EV_PICKUP = 1;
export const EV_KEY = 2;
export const EV_CAUGHT = 4;
export const EV_CLEAR = 8;
export const EV_SPOTTED = 16;
export const EV_COIN = 32;
export const EV_LOCKED = 64;

const BORDER = 24;

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Does the segment (x1,y1)-(x2,y2) cross this rectangle? Slab test over t in [0,1]. */
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

/** Distance along the ray (ox,oy)+t*(dx,dy) to this rectangle, or Infinity. Slab test. */
function rayHitsRect(ox, oy, dx, dy, r) {
  let tmin = 0;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ox < r.x || ox > r.x + r.w) return Infinity;
  } else {
    let t1 = (r.x - ox) / dx;
    let t2 = (r.x + r.w - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < r.y || oy > r.y + r.h) return Infinity;
  } else {
    let t1 = (r.y - oy) / dy;
    let t2 = (r.y + r.h - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

function angleLerp(a, b, t) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * Math.min(1, t);
}

function angleDiff(a, b) {
  let diff = Math.abs((a - b) % (Math.PI * 2));
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    solids: [],
    sightBlockers: [],
    player: null,
    guards: [],
    keycard: null,
    loot: [],
    coins: [],
    rings: [],
    particles: [],
    coinsLeft: PLAYER.startCoins,
    score: 0,
    levelTime: 0,
    totalTime: 0,
    hasKey: false,
    spottedEver: false,
    caught: false,
    cleared: false,
    hint: '',
    hintT: 0,
    coinCooldown: 0,
    alarm: 0, // 0 calm, >0 the loudest current suspicion, 1 = chase in progress
  };

  function buildSolids(level) {
    const solids = [...level.walls, ...level.crates];
    const exit = level.exit;
    // Border walls block sight; the side the exit sits on gets a gap where the door is.
    const borders = [
      { x: 0, y: 0, w: FIELD.width, h: BORDER },
      { x: 0, y: FIELD.height - BORDER, w: FIELD.width, h: BORDER },
    ];
    if (exit.x <= BORDER) {
      borders.push({ x: 0, y: 0, w: BORDER, h: exit.y });
      borders.push({ x: 0, y: exit.y + exit.h, w: BORDER, h: FIELD.height - exit.y - exit.h });
      borders.push({ x: FIELD.width - BORDER, y: 0, w: BORDER, h: FIELD.height });
    } else {
      borders.push({ x: 0, y: 0, w: BORDER, h: FIELD.height });
      borders.push({ x: FIELD.width - BORDER, y: 0, w: BORDER, h: exit.y });
      borders.push({ x: FIELD.width - BORDER, y: exit.y + exit.h, w: BORDER, h: FIELD.height - exit.y - exit.h });
    }
    state.solids = solids;
    state.sightBlockers = [...solids, ...borders];
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    buildSolids(level);
    state.player = {
      x: level.playerStart[0],
      y: level.playerStart[1],
      facing: -Math.PI / 2,
      moving: false,
      sneaking: false,
    };
    state.guards = level.guards.map((g) => ({
      x: g.waypoints[0][0],
      y: g.waypoints[0][1],
      facing: Math.atan2(FIELD.height / 2 - g.waypoints[0][1], FIELD.width / 2 - g.waypoints[0][0]),
      waypoints: g.waypoints,
      wp: 1 % Math.max(1, g.waypoints.length),
      speed: g.speed,
      sweep: g.sweep || 0,
      baseFacing: Math.atan2(FIELD.height / 2 - g.waypoints[0][1], FIELD.width / 2 - g.waypoints[0][0]),
      mode: 'patrol',
      suspicion: 0,
      wait: 0,
      scanT: 0,
      target: null,
      lastSeen: null,
      timeSinceSeen: 99,
    }));
    state.keycard = { x: level.keycard[0], y: level.keycard[1], taken: false };
    state.loot = level.loot.map(([x, y]) => ({ x, y, taken: false }));
    state.coins = [];
    state.rings = [];
    state.particles = [];
    state.coinsLeft = PLAYER.startCoins;
    state.levelTime = 0;
    state.hasKey = false;
    state.spottedEver = false;
    state.caught = false;
    state.cleared = false;
    state.hint = '';
    state.hintT = 0;
    state.coinCooldown = 0;
    state.alarm = 0;
  }

  function moveBody(body, half, vx, vy, dt) {
    body.x += vx * dt;
    for (const s of state.solids) {
      if (rectsOverlap({ x: body.x - half, y: body.y - half, w: half * 2, h: half * 2 }, s)) {
        if (vx > 0) body.x = s.x - half;
        else if (vx < 0) body.x = s.x + s.w + half;
      }
    }
    body.x = Math.max(BORDER + half, Math.min(FIELD.width - BORDER - half, body.x));
    body.y += vy * dt;
    for (const s of state.solids) {
      if (rectsOverlap({ x: body.x - half, y: body.y - half, w: half * 2, h: half * 2 }, s)) {
        if (vy > 0) body.y = s.y - half;
        else if (vy < 0) body.y = s.y + s.h + half;
      }
    }
    body.y = Math.max(BORDER + half, Math.min(FIELD.height - BORDER - half, body.y));
  }

  function lineBlocked(x1, y1, x2, y2) {
    for (const s of state.sightBlockers) {
      if (segmentHitsRect(x1, y1, x2, y2, s)) return true;
    }
    return false;
  }

  /** Cast one vision ray; returns the distance it travels before a wall, capped at the range. */
  function castRay(ox, oy, angle, range) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let best = range;
    for (const s of state.sightBlockers) {
      const t = rayHitsRect(ox, oy, dx, dy, s);
      if (t < best) best = t;
    }
    return best;
  }

  function spawnParticles(x, y, colour, count) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const sp = 30 + random() * 90;
      state.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t: 0,
        ttl: 0.45 + random() * 0.3,
        colour,
      });
    }
  }

  function guardInvestigate(guard, x, y, minSuspicion) {
    if (guard.mode === 'chase') return;
    guard.mode = 'investigate';
    guard.target = { x, y };
    guard.scanT = 0;
    guard.suspicion = Math.max(guard.suspicion, minSuspicion);
  }

  function stepGuard(guard, dt) {
    const player = state.player;
    let events = 0;
    const dxp = player.x - guard.x;
    const dyp = player.y - guard.y;
    const distP = Math.hypot(dxp, dyp);

    // --- seeing ---
    const seen =
      distP < GUARD.viewRange &&
      (angleDiff(guard.facing, Math.atan2(dyp, dxp)) < GUARD.viewHalfAngle || distP < GUARD.nearRadius) &&
      !lineBlocked(guard.x, guard.y, player.x, player.y);
    if (seen) {
      guard.lastSeen = { x: player.x, y: player.y };
      guard.timeSinceSeen = 0;
      const rate = (player.sneaking ? 0.55 : 1) * (1.75 - distP / GUARD.viewRange);
      guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
      if (guard.suspicion >= 1 && guard.mode !== 'chase') {
        guard.mode = 'chase';
        state.spottedEver = true;
        events |= EV_SPOTTED;
      }
    } else {
      guard.timeSinceSeen += dt;
      if (guard.mode !== 'chase') guard.suspicion = Math.max(0, guard.suspicion - 0.22 * dt);
    }

    // --- hearing: a running player is loud ---
    if (player.moving && !player.sneaking && distP < PLAYER.noiseRadius && guard.mode === 'patrol') {
      guardInvestigate(guard, player.x, player.y, 0.35);
    }

    // --- acting ---
    let moveTarget = null;
    let speed = guard.speed;
    if (guard.mode === 'chase') {
      moveTarget = guard.lastSeen;
      speed = GUARD.chaseSpeed;
      if (guard.timeSinceSeen > GUARD.loseSightAfter) {
        guard.mode = 'investigate';
        guard.target = guard.lastSeen;
        guard.scanT = 0;
        guard.suspicion = 0.55;
      }
      if (distP < GUARD.catchRadius) state.caught = true;
    } else if (guard.mode === 'investigate') {
      moveTarget = guard.target;
      speed = GUARD.investigateSpeed;
      if (moveTarget && Math.hypot(moveTarget.x - guard.x, moveTarget.y - guard.y) < 10) {
        guard.scanT += dt;
        guard.facing += Math.sin(state.totalTime * 2.2 + guard.wp) * 1.9 * dt;
        if (guard.scanT > 1.7) {
          guard.mode = 'return';
          guard.suspicion = Math.min(guard.suspicion, 0.3);
        }
        moveTarget = null;
      }
    } else if (guard.mode === 'return') {
      const wp = guard.waypoints[guard.wp];
      moveTarget = { x: wp[0], y: wp[1] };
      speed = 88;
      if (Math.hypot(moveTarget.x - guard.x, moveTarget.y - guard.y) < 8) guard.mode = 'patrol';
    } else {
      // patrol
      if (guard.waypoints.length === 1) {
        if (guard.sweep) {
          guard.facing = guard.baseFacing + Math.sin(state.totalTime * guard.sweep) * 1.05;
        }
        moveTarget = null;
      } else if (guard.wait > 0) {
        guard.wait -= dt;
        moveTarget = null;
      } else {
        const wp = guard.waypoints[guard.wp];
        moveTarget = { x: wp[0], y: wp[1] };
        if (Math.hypot(moveTarget.x - guard.x, moveTarget.y - guard.y) < 7) {
          guard.wp = (guard.wp + 1) % guard.waypoints.length;
          guard.wait = 0.65;
          moveTarget = null;
        }
      }
    }

    if (distP < 21) state.caught = true; // walked straight into a guard

    if (moveTarget) {
      const dx = moveTarget.x - guard.x;
      const dy = moveTarget.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        const wanted = Math.atan2(dy, dx);
        guard.facing = angleLerp(guard.facing, wanted, GUARD.turnRate * dt);
        // Move along facing (not straight at the target) so turns look like turns, not strafes.
        // moveBody adds velocity * dt, so a one-step displacement is passed with dt = 1.
        const stepLen = Math.min(speed * dt, dist);
        moveBody(guard, GUARD.radius, Math.cos(guard.facing) * stepLen, Math.sin(guard.facing) * stepLen, 1);
      }
    }
    return events;
  }

  function step(dt, input) {
    if (state.caught || state.cleared) return 0;
    let events = 0;
    state.totalTime += dt;
    state.levelTime += dt;
    if (state.hintT > 0) state.hintT -= dt;
    if (state.coinCooldown > 0) state.coinCooldown -= dt;

    const player = state.player;

    // --- player movement ---
    const mag = Math.hypot(input.x, input.y);
    player.sneaking = !!input.sneak;
    player.moving = mag > 0;
    if (mag > 0) {
      const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      const vx = (input.x / mag) * speed;
      const vy = (input.y / mag) * speed;
      player.facing = Math.atan2(vy, vx);
      moveBody(player, PLAYER.radius, vx, vy, dt);
    }

    // --- throwing a coin ---
    if (input.throwTo && state.coinsLeft > 0 && state.coinCooldown <= 0) {
      let tx = input.throwTo.x - player.x;
      let ty = input.throwTo.y - player.y;
      const d = Math.hypot(tx, ty);
      const maxThrow = 165;
      if (d > maxThrow) {
        tx = (tx / d) * maxThrow;
        ty = (ty / d) * maxThrow;
      }
      state.coins.push({ sx: player.x, sy: player.y, x: player.x + tx, y: player.y + ty, t: 0, landed: false });
      state.coinsLeft -= 1;
      state.coinCooldown = 0.45;
      events |= EV_COIN;
    }

    // --- coins in flight / landed ---
    for (const coin of state.coins) {
      coin.t += dt;
      if (!coin.landed && coin.t >= 0.35) {
        coin.landed = true;
        state.rings.push({ x: coin.x, y: coin.y, t: 0 });
        for (const guard of state.guards) {
          if (Math.hypot(guard.x - coin.x, guard.y - coin.y) < 205) {
            guardInvestigate(guard, coin.x, coin.y, 0.3);
          }
        }
      }
    }
    state.coins = state.coins.filter((c) => c.t < 2.6);
    for (const ring of state.rings) ring.t += dt;
    state.rings = state.rings.filter((r) => r.t < 0.8);

    // --- guards ---
    state.alarm = 0;
    for (const guard of state.guards) {
      events |= stepGuard(guard, dt);
      state.alarm = Math.max(state.alarm, guard.mode === 'chase' ? 1 : guard.suspicion);
    }
    if (state.caught) {
      events |= EV_CAUGHT;
      return events;
    }

    // --- pickups ---
    if (!state.keycard.taken && Math.hypot(player.x - state.keycard.x, player.y - state.keycard.y) < 27) {
      state.keycard.taken = true;
      state.hasKey = true;
      spawnParticles(state.keycard.x, state.keycard.y, '#f2c94c', 12);
      events |= EV_KEY;
    }
    for (const gem of state.loot) {
      if (!gem.taken && Math.hypot(player.x - gem.x, player.y - gem.y) < 25) {
        gem.taken = true;
        state.score += SCORE.loot;
        spawnParticles(gem.x, gem.y, '#7ee0ff', 9);
        events |= EV_PICKUP;
      }
    }

    // --- exit ---
    const exit = state.level.exit;
    if (rectsOverlap({ x: player.x - PLAYER.radius, y: player.y - PLAYER.radius, w: PLAYER.radius * 2, h: PLAYER.radius * 2 }, exit)) {
      if (state.hasKey) {
        state.cleared = true;
        let gained = SCORE.levelClear;
        if (!state.spottedEver) gained += SCORE.ghostBonus;
        gained += Math.max(0, Math.round((state.level.parSeconds - state.levelTime) * SCORE.secondBonus * (state.levelIndex + 1)));
        state.score += gained;
        state.lastGained = gained;
        events |= EV_CLEAR;
      } else if (state.hintT <= 0) {
        state.hint = 'LOCKED — the exit wants the keycard first';
        state.hintT = 1.6;
        events |= EV_LOCKED;
      }
    }

    // --- particles ---
    for (const p of state.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    state.particles = state.particles.filter((p) => p.t < p.ttl);

    return events;
  }

  loadLevel(0);

  return {
    state,
    loadLevel,
    step,
    castRay,
    lineBlocked,
  };
}

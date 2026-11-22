// The screenshot scenes behind ?shot=start|play|end|win. Each one drives the real world with a
// simple pilot from a fresh level, so the frame is what the game really looks like in that
// moment, and the same seed always gives the same frame. start shows the title over a patrolling
// lobby, play catches the infiltrator mid-sneak between two cones, end is a caught run, and win
// is the vault door opening on the last level.

import { STEP } from './config.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

function steer(world, tx, ty, sneak = false) {
  const p = world.state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 6) return { x: 0, y: 0, sneak };
  return { x: dx / d, y: dy / d, sneak };
}

function run(world, seconds, pilot) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, pilot(world));
    if (world.state.caught || world.state.cleared) break;
  }
}

const IDLE = () => ({ x: 0, y: 0, sneak: false });

export function stageShot(name, world) {
  if (name === 'play') {
    world.loadLevel(0);
    const path = [
      [330, 624, false],
      [330, 520, false],
      [520, 420, true],
      [560, 360, true],
    ];
    let leg = 0;
    let elapsed = 0;
    let thrown = false;
    run(world, 5.5, (w) => {
      elapsed += STEP;
      // Late in the scene the infiltrator tosses a coin toward the patrolling guard: the
      // landing ring and the guard's turned head show the distraction in the still frame.
      if (!thrown && elapsed > 4.6) {
        thrown = true;
        const base = leg >= path.length ? IDLE() : steer(w, path[leg][0], path[leg][1], path[leg][2]);
        return { ...base, throwTo: { x: 468, y: 296 } };
      }
      if (leg >= path.length) return IDLE();
      const [tx, ty, sneak] = path[leg];
      const p = w.state.player;
      if (Math.hypot(tx - p.x, ty - p.y) < 10) leg += 1;
      return steer(w, tx, ty, sneak);
    });
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    world.loadLevel(0);
    // A reckless run straight at the nearest guard: seen, chased, caught. The end screen.
    run(world, 40, (w) => {
      let nearest = null;
      let best = Infinity;
      for (const g of w.state.guards) {
        const d = Math.hypot(g.x - w.state.player.x, g.y - w.state.player.y);
        if (d < best) {
          best = d;
          nearest = g;
        }
      }
      return nearest ? steer(w, nearest.x, nearest.y) : IDLE();
    });
    return { screen: world.state.caught ? SCREEN_CAUGHT : SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    world.loadLevel(2);
    // Staged as the last seconds of a real run: card in hand, two gems banked, exit in reach.
    world.state.keycard.taken = true;
    world.state.hasKey = true;
    world.state.loot[0].taken = true;
    world.state.loot[1].taken = true;
    world.state.score = 1450;
    world.state.player.x = 1100;
    world.state.player.y = 420;
    const exit = world.state.level.exit;
    run(world, 12, (w) => steer(w, exit.x + exit.w / 2, exit.y + exit.h / 2));
    return { screen: world.state.cleared ? SCREEN_VICTORY : SCREEN_PLAY, best: 0 };
  }
  // start (and anything else): the lobby alive behind the title.
  world.loadLevel(0);
  run(world, 5, IDLE);
  return { screen: SCREEN_TITLE, best: 0 };
}

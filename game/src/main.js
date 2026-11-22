// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps,
// and the renderer paints what is there. Screens: title, play, paused, caught, level clear and
// victory. A caught run retries the level with the score it had when the level began; clearing
// the vault (level 3) wins the night.
//
// ?seed=N fixes the particle randomness. ?shot=start|play|end|win (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.

import { BEST_KEY, LEVELS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EV_CAUGHT, EV_CLEAR, EV_COIN, EV_KEY, EV_LOCKED, EV_PICKUP, EV_SPOTTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_THROW, createInput } from './input.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, world.castRay);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  input.setScale(renderer.getScale());
  window.addEventListener('resize', () => input.setScale(renderer.getScale()));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let scoreAtLevelStart = 0;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    world.state.score = 0;
    scoreAtLevelStart = 0;
    world.loadLevel(0);
    screen = SCREEN_PLAY;
    announce('Level 1. Take the keycard and reach the exit unseen.');
  }

  function retryLevel() {
    world.state.score = scoreAtLevelStart;
    world.loadLevel(world.state.levelIndex);
    screen = SCREEN_PLAY;
    announce(`${world.state.level.name}. Again, quieter.`);
  }

  function nextLevel() {
    scoreAtLevelStart = world.state.score;
    world.loadLevel(world.state.levelIndex + 1);
    screen = SCREEN_PLAY;
    announce(world.state.level.name);
  }

  function finish() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function handleEvents(events) {
    if (events & EV_KEY) {
      audio.pickup();
      announce('Keycard taken. The exit is open.');
    } else if (events & EV_PICKUP) {
      audio.pickup();
    }
    if (events & EV_COIN) audio.coin();
    if (events & EV_LOCKED) audio.locked();
    if (events & EV_SPOTTED) {
      audio.spotted();
      announce('Spotted! Break line of sight!');
    }
    if (events & EV_CAUGHT) {
      audio.caught();
      finish();
      screen = SCREEN_CAUGHT;
      announce(`Caught. Score ${world.state.score}.`);
    } else if (events & EV_CLEAR) {
      audio.clear();
      finish();
      if (world.state.levelIndex >= LEVELS.length - 1) {
        screen = SCREEN_VICTORY;
        announce(`Victory. Final score ${world.state.score}.`);
      } else {
        screen = SCREEN_CLEAR;
        announce(`Level clear. Score ${world.state.score}.`);
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startRun();
      else if (screen === SCREEN_CAUGHT) retryLevel();
      else if (screen === SCREEN_CLEAR) nextLevel();
      else if (screen === SCREEN_VICTORY) startRun();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
      }
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE) {
      // The lobby stays alive behind the title: guards patrol, the infiltrator waits.
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0, sneak: false });
        accumulator -= STEP;
      }
      // A staged title world must never end: if a guard somehow catches the idle player, reset.
      if (world.state.caught) world.loadLevel(0);
    } else if (screen === SCREEN_PLAY) {
      const dir = input.direction();
      const throwTo = actions & ACTION_THROW ? input.aim() : null;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        const events = world.step(STEP, {
          x: dir.x,
          y: dir.y,
          sneak: input.sneaking(),
          throwTo: accumulator < STEP * 2 ? throwTo : null,
        });
        handleEvents(events);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.isMuted());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Nightjar. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

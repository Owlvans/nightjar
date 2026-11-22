// The renderer: everything the player sees, drawn on one canvas in a fixed 1280x720 logical
// space that is scaled and centred on whatever window it gets. Floors and rugs first, then the
// exit, pickups, walls and crates, then the guards' vision cones (raycast against the real
// walls, so what you see is exactly what the guard can see), then the characters, then the HUD
// and whichever screen overlay is up.

import { FIELD, FONT, GUARD, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_VICTORY = 'victory';

const CONE_RAYS = 26;

export function createRenderer(canvas, castRay) {
  const ctx = canvas.getContext('2d');
  let scale = { x: 1, y: 1, ox: 0, oy: 0 };
  let vignette = null;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const s = Math.min(w / FIELD.width, h / FIELD.height);
    scale = { x: s * dpr, y: s * dpr, ox: ((w - FIELD.width * s) / 2) * dpr, oy: ((h - FIELD.height * s) / 2) * dpr };
    vignette = null;
  }
  window.addEventListener('resize', resize);
  resize();

  function drawCone(guard) {
    const range = GUARD.viewRange;
    const half = GUARD.viewHalfAngle;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const angle = guard.facing - half + (2 * half * i) / CONE_RAYS;
      const d = castRay(guard.x, guard.y, angle, range);
      ctx.lineTo(guard.x + Math.cos(angle) * d, guard.y + Math.sin(angle) * d);
    }
    ctx.closePath();
    ctx.fillStyle = guard.mode === 'chase' ? PALETTE.coneAlert : guard.suspicion > 0.3 ? PALETTE.coneWarn : PALETTE.coneCalm;
    ctx.fill();
  }

  function drawGuard(guard, state) {
    const fx = Math.cos(guard.facing);
    const fy = Math.sin(guard.facing);
    // shadow, then the uniform: a light slate ring over a dark body so the guard reads as a
    // person from above, not a coin.
    ctx.beginPath();
    ctx.arc(guard.x, guard.y + 2.5, 15.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#8fa3c0';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.guardDark;
    ctx.fill();
    // cap toward facing, with a pale visor line so the facing is unmistakable
    ctx.beginPath();
    ctx.arc(guard.x + fx * 4, guard.y + fy * 4, 7, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.guardCap;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(guard.x + fx * 3, guard.y + fy * 3);
    ctx.lineTo(guard.x + fx * 12.5, guard.y + fy * 12.5);
    ctx.strokeStyle = '#e8eef7';
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    ctx.stroke();
    // flashlight dot at the cone's origin
    ctx.beginPath();
    ctx.arc(guard.x + fx * 13, guard.y + fy * 13, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = '#fde68a';
    ctx.fill();
    // suspicion arc: the meter, worn on the guard, so a still frame shows how close
    // this guard is to raising the alarm
    if (guard.suspicion > 0.03 && guard.mode !== 'chase') {
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 20, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      ctx.strokeStyle = guard.suspicion > 0.6 ? '#f87171' : '#fbbf24';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    // state mark
    if (guard.mode === 'chase') {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `bold 26px ${FONT}`;
      ctx.textAlign = 'center';
      const bob = Math.sin(state.totalTime * 10) * 2;
      ctx.fillText('!', guard.x, guard.y - 24 + bob);
    } else if (guard.suspicion > 0.25) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, guard.y - 22);
    }
  }

  function drawPlayer(player, state) {
    if (player.moving && !player.sneaking) {
      ctx.beginPath();
      ctx.arc(player.x, player.y, 74, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(238, 241, 245, 0.07)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    const r = player.sneaking ? 11.5 : 13.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y + 2, r + 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.playerDark;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(player.x, player.y, r - 4, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.player;
    ctx.fill();
    // hood point toward facing
    const fx = Math.cos(player.facing);
    const fy = Math.sin(player.facing);
    ctx.beginPath();
    ctx.moveTo(player.x + fx * (r + 4), player.y + fy * (r + 4));
    ctx.lineTo(player.x - fy * 5 - fx * 2, player.y + fx * 5 - fy * 2);
    ctx.lineTo(player.x + fy * 5 - fx * 2, player.y - fx * 5 - fy * 2);
    ctx.closePath();
    ctx.fillStyle = PALETTE.playerDark;
    ctx.fill();
    // scarf
    ctx.beginPath();
    ctx.arc(player.x - fx * 3, player.y - fy * 3, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.scarf;
    ctx.fill();
  }

  function drawScene(state) {
    // floor tiles
    const tile = 64;
    for (let ty = 0; ty < FIELD.height / tile; ty += 1) {
      for (let tx = 0; tx < FIELD.width / tile; tx += 1) {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(tx * tile, ty * tile, tile, tile);
      }
    }
    // a rug in the middle room of every level, for warmth
    ctx.fillStyle = PALETTE.rug;
    ctx.fillRect(500, 250, 280, 220);
    ctx.strokeStyle = PALETTE.rugEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(512, 262, 256, 196);

    const exit = state.level.exit;
    // exit door
    const pulse = 0.72 + Math.sin(state.totalTime * 3) * 0.28;
    ctx.fillStyle = state.hasKey ? PALETTE.exit : PALETTE.exitDark;
    ctx.globalAlpha = state.hasKey ? pulse : 0.85;
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = state.hasKey ? '#bbf7d0' : '#4d5c7d';
    ctx.lineWidth = 3;
    ctx.strokeRect(exit.x + 2, exit.y + 2, exit.w - 4, exit.h - 4);
    ctx.fillStyle = state.hasKey ? '#052e16' : '#93a0b4';
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'center';
    const vertical = exit.w < exit.h;
    if (vertical) {
      ctx.save();
      ctx.translate(exit.x + exit.w / 2, exit.y + exit.h / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(state.hasKey ? 'EXIT' : 'EXIT · LOCKED', 0, 6);
      ctx.restore();
    } else {
      ctx.fillText(state.hasKey ? 'EXIT' : 'EXIT · LOCKED', exit.x + exit.w / 2, exit.y + exit.h / 2 + 6);
    }

    // keycard
    if (!state.keycard.taken) {
      const bob = Math.sin(state.totalTime * 2.6) * 4;
      const kx = state.keycard.x;
      const ky = state.keycard.y + bob;
      ctx.beginPath();
      ctx.arc(kx, ky, 17 + Math.sin(state.totalTime * 3.2) * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(242, 201, 76, 0.16)';
      ctx.fill();
      ctx.save();
      ctx.translate(kx, ky);
      ctx.rotate(Math.sin(state.totalTime * 1.8) * 0.35);
      ctx.fillStyle = PALETTE.keycard;
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#7c5e10';
      ctx.fillRect(-11, -3, 22, 4);
      ctx.restore();
    }

    // loot gems
    for (const gem of state.loot) {
      if (gem.taken) continue;
      const bob = Math.sin(state.totalTime * 2.2 + gem.x) * 3;
      ctx.save();
      ctx.translate(gem.x, gem.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.gem;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(-7, -7, 6, 6);
      ctx.restore();
    }

    // walls and crates
    for (const wall of state.level.walls) {
      ctx.fillStyle = PALETTE.wallSide;
      ctx.fillRect(wall.x, wall.y + 5, wall.w, wall.h);
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(wall.x, wall.y, wall.w, 5);
    }
    for (const crate of state.level.crates) {
      ctx.fillStyle = PALETTE.crate;
      ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
      ctx.strokeStyle = PALETTE.crateLine;
      ctx.lineWidth = 3;
      ctx.strokeRect(crate.x + 2, crate.y + 2, crate.w - 4, crate.h - 4);
      ctx.beginPath();
      ctx.moveTo(crate.x + 3, crate.y + 3);
      ctx.lineTo(crate.x + crate.w - 3, crate.y + crate.h - 3);
      ctx.moveTo(crate.x + crate.w - 3, crate.y + 3);
      ctx.lineTo(crate.x + 3, crate.y + crate.h - 3);
      ctx.strokeStyle = PALETTE.crateDark;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // thrown coins
    for (const coin of state.coins) {
      const t = Math.min(1, coin.t / 0.35);
      const x = coin.sx + (coin.x - coin.sx) * t;
      const y = coin.sy + (coin.y - coin.sy) * t - Math.sin(t * Math.PI) * 34;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.keycard;
      ctx.fill();
    }
    for (const ring of state.rings) {
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 12 + ring.t * 90, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(242, 201, 76, ${0.5 * (1 - ring.t / 0.8)})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // vision cones, then bodies
    for (const guard of state.guards) drawCone(guard);
    for (const guard of state.guards) drawGuard(guard, state);
    drawPlayer(state.player, state);

    // particles
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.ttl);
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    }
    ctx.globalAlpha = 1;

    // vignette
    if (!vignette) {
      vignette = ctx.createRadialGradient(640, 360, 330, 640, 360, 780);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawHud(state, muted) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, 46);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(state.level.name, 18, 29);
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.textAlign = 'center';
    ctx.fillText(state.level.objective, FIELD.width / 2, 29);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`Score ${state.score}`, FIELD.width - 18, 29);

    // bottom-left: keycard and coins
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, FIELD.height - 42, 252, 42);
    ctx.fillStyle = state.hasKey ? PALETTE.keycard : 'rgba(147,160,180,0.4)';
    ctx.fillRect(16, FIELD.height - 30, 24, 17);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(state.hasKey ? 'Keycard' : 'No keycard', 48, FIELD.height - 16);
    for (let i = 0; i < state.coinsLeft; i += 1) {
      ctx.beginPath();
      ctx.arc(150 + i * 26, FIELD.height - 21, 8, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.keycard;
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('coins', 150 + state.coinsLeft * 26 + 8, FIELD.height - 16);
    if (muted) {
      ctx.textAlign = 'right';
      ctx.fillText('muted (M)', FIELD.width - 16, FIELD.height - 16);
    }

    // alarm meter
    if (state.alarm > 0.02) {
      const w = 240;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(FIELD.width / 2 - w / 2, 56, w, 12);
      ctx.fillStyle = state.alarm >= 1 ? PALETTE.danger : '#fbbf24';
      ctx.fillRect(FIELD.width / 2 - w / 2 + 2, 58, (w - 4) * Math.min(1, state.alarm), 8);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(state.alarm >= 1 ? 'SPOTTED — RUN' : 'someone is suspicious…', FIELD.width / 2, 86);
    }

    if (state.hintT > 0 && state.hint) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `bold 19px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(state.hint, FIELD.width / 2, FIELD.height - 64);
    }
  }

  function overlay(alpha) {
    ctx.fillStyle = `rgba(4, 6, 12, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function centre(lines, startY, gap) {
    lines.forEach((line, i) => {
      ctx.font = line.font;
      ctx.fillStyle = line.colour || PALETTE.text;
      ctx.textAlign = 'center';
      ctx.fillText(line.text, FIELD.width / 2, startY + i * gap);
    });
  }

  function draw(state, screen, best, muted) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale.x, 0, 0, scale.y, scale.ox, scale.oy);
    drawScene(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, muted);
    if (screen === SCREEN_TITLE) {
      overlay(0.62);
      centre([
        { text: 'N I G H T J A R', font: `bold 84px ${FONT}`, colour: PALETTE.player },
        { text: 'a tiny game of shadows and keycards', font: `21px ${FONT}`, colour: PALETTE.muted },
        { text: '', font: `20px ${FONT}` },
        { text: 'Slip past the guards. Take the keycard. Reach the exit unseen.', font: `19px ${FONT}` },
        { text: 'WASD / arrows — move      Shift — sneak (quiet, slow)', font: `17px ${FONT}`, colour: PALETTE.muted },
        { text: 'Click, then Space — throw a coin to pull a guard away      P — pause      M — sound', font: `17px ${FONT}`, colour: PALETTE.muted },
        { text: 'Yellow cones are what guards can see. Crates and walls break their gaze.', font: `17px ${FONT}`, colour: PALETTE.muted },
        { text: '', font: `20px ${FONT}` },
        { text: 'Press Enter or click to begin', font: `bold 22px ${FONT}`, colour: PALETTE.keycard },
        { text: best > 0 ? `Best score ${best}` : '', font: `16px ${FONT}`, colour: PALETTE.muted },
      ], 168, 40);
    } else if (screen === SCREEN_PAUSED) {
      overlay(0.55);
      centre([{ text: 'Paused', font: `bold 44px ${FONT}` }, { text: 'P or Enter to keep going', font: `18px ${FONT}`, colour: PALETTE.muted }], 330, 46);
    } else if (screen === SCREEN_CAUGHT) {
      overlay(0.6);
      centre([
        { text: 'SPOTTED', font: `bold 64px ${FONT}`, colour: PALETTE.danger },
        { text: `Caught in ${state.level.name}. The night keeps your score: ${state.score}.`, font: `19px ${FONT}` },
        { text: 'Press Enter to try the level again', font: `bold 20px ${FONT}`, colour: PALETTE.keycard },
      ], 300, 48);
    } else if (screen === SCREEN_CLEAR) {
      overlay(0.6);
      centre([
        { text: 'LEVEL CLEAR', font: `bold 54px ${FONT}`, colour: PALETTE.exit },
        { text: `+${state.lastGained || 0} points${state.spottedEver ? '' : ' — including the ghost bonus, never spotted'}. Score ${state.score}.`, font: `19px ${FONT}` },
        { text: 'Press Enter for the next level', font: `bold 20px ${FONT}`, colour: PALETTE.keycard },
      ], 300, 48);
    } else if (screen === SCREEN_VICTORY) {
      overlay(0.66);
      centre([
        { text: 'THE VAULT IS EMPTY', font: `bold 56px ${FONT}`, colour: PALETTE.keycard },
        { text: 'Three buildings, no witnesses. You are a ghost with a keycard.', font: `20px ${FONT}` },
        { text: `Final score ${state.score}${best > 0 ? ` · Best ${Math.max(best, state.score)}` : ''}`, font: `bold 22px ${FONT}`, colour: PALETTE.player },
        { text: 'Press Enter to play again', font: `bold 20px ${FONT}`, colour: PALETTE.keycard },
      ], 280, 50);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return {
    draw,
    getScale() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      return { x: scale.x / dpr, y: scale.y / dpr, ox: scale.ox / dpr, oy: scale.oy / dpr };
    },
  };
}

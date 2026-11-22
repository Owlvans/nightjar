// Keyboard and mouse input. Movement is a held direction (WASD or arrow keys), Shift sneaks,
// Space throws a coin toward the last mouse position (or straight ahead), P or Esc pauses,
// M mutes, and Enter / Space on a menu screen confirms. Actions are edge-triggered: takeActions
// returns what was pressed since the last call and clears the queue.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_THROW = 4;
export const ACTION_MUTE = 8;

const HELD = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let sneak = false;
  let mouse = { x: 640, y: 360 };
  let scale = { x: 1, y: 1, ox: 0, oy: 0 };

  function onKeyDown(event) {
    if (event.repeat) return;
    const name = HELD[event.code];
    if (name) {
      held.add(name);
      event.preventDefault();
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sneak = true;
    if (event.code === 'Space') {
      actions |= ACTION_CONFIRM | ACTION_THROW;
      event.preventDefault();
    }
    if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    const name = HELD[event.code];
    if (name) held.delete(name);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sneak = false;
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse = {
      x: (event.clientX - rect.left - scale.ox) / scale.x,
      y: (event.clientY - rect.top - scale.oy) / scale.y,
    };
  }

  function onMouseDown() {
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** The held movement direction as a unit-ish vector (diagonals are normalised by the world). */
    direction() {
      let x = 0;
      let y = 0;
      if (held.has('left')) x -= 1;
      if (held.has('right')) x += 1;
      if (held.has('up')) y -= 1;
      if (held.has('down')) y += 1;
      return { x, y };
    },
    sneaking() {
      return sneak;
    },
    aim() {
      return mouse;
    },
    setScale(next) {
      scale = next;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

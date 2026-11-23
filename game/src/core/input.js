// Keyboard and mouse: held keys, one-shot presses consumed per frame, mouse look deltas while the
// pointer is locked, and the mouse buttons for shooting and aiming.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, wheel: 0 };
  let locked = false;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    held.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => { held.clear(); mouse.left = mouse.right = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (!locked && input.wantLock) canvas.requestPointerLock?.();
    if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; }
    if (e.button === 2) mouse.right = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    if (!locked) return;
    mouse.dx += e.movementX;
    mouse.dy += e.movementY;
  });
  window.addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });

  const input = {
    mouse,
    wantLock: false,
    get locked() { return locked; },
    down(code) { return held.has(code); },
    /** True once per key press; the press is consumed. */
    hit(code) {
      if (pressed.has(code)) { pressed.delete(code); return true; }
      return false;
    },
    axis(neg, pos) { return (held.has(pos) ? 1 : 0) - (held.has(neg) ? 1 : 0); },
    endFrame() {
      pressed.clear();
      mouse.dx = 0; mouse.dy = 0; mouse.leftPressed = false; mouse.wheel = 0;
    },
    releaseLock() { if (locked) document.exitPointerLock?.(); },
  };
  return input;
}

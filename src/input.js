/* =========================================================================
   NORBERT, UNFINISHED  --  input.js
   Keyboard, gamepad and (for phones) a set of on-screen clay buttons.
   ========================================================================= */

const Input = {
  held: {}, pressed: {}, released: {},
  touch: false,
  pointer: { x: 0, y: 0, down: false },
  zones: [],          // on-screen buttons, filled in by ui.js
  anyKey: false,
};

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump',
  KeyJ: 'lob', KeyZ: 'lob',
  KeyK: 'slurp', KeyX: 'slurp',
  KeyE: 'talk', Enter: 'talk',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
  KeyF: 'fullscreen',
};

Input.attach = function (canvas) {
  addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    Input.anyKey = true;
    if (!a) return;
    if (!Input.held[a]) Input.pressed[a] = true;
    Input.held[a] = true;
  });
  addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    Input.held[a] = false;
    Input.released[a] = true;
  });
  addEventListener('blur', () => { Input.held = {}; });

  const pt = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  };

  const hit = (p) => {
    for (const z of Input.zones) {
      if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) return z;
    }
    return null;
  };

  const activeTouches = new Map();

  const onDown = (e) => {
    Input.anyKey = true;
    for (const t of (e.changedTouches || [e])) {
      const p = pt(t);
      const z = hit(p);
      if (z) {
        activeTouches.set(t.identifier === undefined ? 'm' : t.identifier, z.a);
        if (!Input.held[z.a]) Input.pressed[z.a] = true;
        Input.held[z.a] = true;
      } else {
        Input.pointer.down = true;
        Input.pointer.x = p.x; Input.pointer.y = p.y;
        if (!Input.held.talk) Input.pressed.talk = true;
        Input.held.talk = true;
        activeTouches.set(t.identifier === undefined ? 'm' : t.identifier, 'talk');
      }
    }
    if (e.cancelable) e.preventDefault();
  };
  const onUp = (e) => {
    for (const t of (e.changedTouches || [e])) {
      const k = t.identifier === undefined ? 'm' : t.identifier;
      const a = activeTouches.get(k);
      if (a) { Input.held[a] = false; Input.released[a] = true; activeTouches.delete(k); }
    }
    Input.pointer.down = false;
    if (e.cancelable) e.preventDefault();
  };
  const onMove = (e) => {
    for (const t of (e.changedTouches || [e])) {
      const k = t.identifier === undefined ? 'm' : t.identifier;
      if (!activeTouches.has(k)) continue;
      const p = pt(t);
      const z = hit(p);
      const cur = activeTouches.get(k);
      const want = z ? z.a : null;
      if (want !== cur) {
        if (cur) { Input.held[cur] = false; Input.released[cur] = true; }
        if (want) { if (!Input.held[want]) Input.pressed[want] = true; Input.held[want] = true; }
        activeTouches.set(k, want);
      }
    }
    if (e.cancelable) e.preventDefault();
  };

  canvas.addEventListener('touchstart', (e) => { Input.touch = true; onDown(e); }, { passive: false });
  canvas.addEventListener('touchend', onUp, { passive: false });
  canvas.addEventListener('touchcancel', onUp, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('mousedown', onDown);
  addEventListener('mouseup', onUp);
  canvas.addEventListener('mousemove', (e) => {
    const p = pt(e);
    Input.pointer.x = p.x; Input.pointer.y = p.y;
  });
};

Input.gamepad = function () {
  if (!navigator.getGamepads) return;
  const gps = navigator.getGamepads();
  for (const g of gps) {
    if (!g) continue;
    const set = (a, v) => {
      if (v && !Input.held[a]) Input.pressed[a] = true;
      if (!v && Input.held[a]) Input.released[a] = true;
      if (v) Input.held[a] = true;
      else if (Input.held[a] && !Input._kb) Input.held[a] = false;
    };
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    const b = g.buttons;
    set('left', ax < -0.4 || (b[14] && b[14].pressed));
    set('right', ax > 0.4 || (b[15] && b[15].pressed));
    set('up', ay < -0.5 || (b[12] && b[12].pressed));
    set('down', ay > 0.5 || (b[13] && b[13].pressed));
    set('jump', b[0] && b[0].pressed);
    set('lob', b[2] && b[2].pressed);
    set('slurp', b[1] && b[1].pressed);
    set('talk', (b[3] && b[3].pressed) || (b[0] && b[0].pressed));
    set('pause', b[9] && b[9].pressed);
    break;
  }
};

Input.endFrame = function () {
  Input.pressed = {}; Input.released = {}; Input.anyKey = false;
};

Input.axis = function () {
  return (Input.held.right ? 1 : 0) - (Input.held.left ? 1 : 0);
};

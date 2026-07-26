/* =========================================================================
   NORBERT, UNFINISHED  --  input.js
   Keyboard, gamepad, and the on-screen controls.

   The touch pad is real DOM buttons rather than rectangles painted into the
   canvas. That gets safe-area insets, crisp text and correct hit testing for
   free, and it means the d-pad can live below the picture in portrait and
   float over the corners in landscape without the game knowing anything
   about it.

   Touches are resolved with elementFromPoint on every move rather than with
   pointer capture, so you can roll your thumb from LEFT to RIGHT without
   lifting it -- which is how people actually play platformers on a phone.
   ========================================================================= */

const Input = {
  held: {}, pressed: {}, released: {},
  touch: false,
  anyKey: false,
  _btns: {},
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
};

Input.press = function (a) {
  if (!a) return;
  if (!Input.held[a]) Input.pressed[a] = true;
  Input.held[a] = true;
  Input._paint(a, true);
};

Input.release = function (a) {
  if (!a) return;
  if (Input.held[a]) Input.released[a] = true;
  Input.held[a] = false;
  Input._paint(a, false);
};

Input._paint = function (a, on) {
  const list = Input._btns[a];
  if (list) for (const el of list) el.classList.toggle('on', on);
};

/* ---------------------------------------------------------------------- */

Input.attach = function (canvas) {
  /* ---- keyboard ---- */
  addEventListener('keydown', (e) => {
    Input.anyKey = true;
    const a = KEYMAP[e.code];
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (a) Input.press(a);
  });
  addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) Input.release(a);
  });
  addEventListener('blur', () => {
    for (const a in Input.held) Input.release(a);
  });

  /* ---- on-screen buttons ---- */
  for (const el of document.querySelectorAll('[data-act]')) {
    const a = el.dataset.act;
    (Input._btns[a] || (Input._btns[a] = [])).push(el);
  }

  const actAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const hit = el && el.closest ? el.closest('[data-act]') : null;
    return hit ? hit.dataset.act : null;
  };

  /* which action each live finger is currently over */
  const fingers = new Map();

  const refresh = (touches) => {
    for (const t of touches) {
      const want = actAt(t.clientX, t.clientY) || (t.onCanvas ? 'talk' : null);
      const have = fingers.get(t.identifier);
      if (want === have) continue;
      if (have) Input.release(have);
      if (want) Input.press(want);
      if (want) fingers.set(t.identifier, want); else fingers.delete(t.identifier);
    }
  };

  const onStart = (e) => {
    Input.touch = true;
    Input.anyKey = true;
    document.body.classList.add('touch');
    for (const t of e.changedTouches) {
      const a = actAt(t.clientX, t.clientY);
      /* a tap anywhere that isn't a button means "go on, then" */
      const act = a || 'talk';
      Input.press(act);
      fingers.set(t.identifier, act);
    }
    if (e.cancelable) e.preventDefault();
  };

  const onMove = (e) => {
    /* only re-target fingers that started on the pad; a finger that began on
       the picture keeps meaning "advance", however far it wanders */
    for (const t of e.changedTouches) {
      if (!fingers.has(t.identifier)) continue;
      const cur = fingers.get(t.identifier);
      if (cur === 'talk') continue;
      const want = actAt(t.clientX, t.clientY);
      if (want === cur) continue;
      Input.release(cur);
      if (want) { Input.press(want); fingers.set(t.identifier, want); }
      else fingers.delete(t.identifier);
    }
    if (e.cancelable) e.preventDefault();
  };

  const onEnd = (e) => {
    for (const t of e.changedTouches) {
      const a = fingers.get(t.identifier);
      if (a) { Input.release(a); fingers.delete(t.identifier); }
    }
    if (e.cancelable) e.preventDefault();
  };

  document.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd, { passive: false });
  document.addEventListener('touchcancel', onEnd, { passive: false });

  /* mouse, so the pad is testable on a desktop and the canvas is clickable */
  let mouseAct = null;
  document.addEventListener('mousedown', (e) => {
    if (Input.touch) return;
    Input.anyKey = true;
    mouseAct = actAt(e.clientX, e.clientY) || 'talk';
    Input.press(mouseAct);
    e.preventDefault();
  });
  addEventListener('mouseup', () => {
    if (mouseAct) { Input.release(mouseAct); mouseAct = null; }
  });

  /* context menu on long-press is never what you wanted mid-jump */
  document.addEventListener('contextmenu', (e) => e.preventDefault());
};

/* Show the pad up front on anything without a keyboard, rather than waiting
   for the first touch and popping the layout about. */
Input.detectTouch = function () {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const noHover = matchMedia('(hover: none)').matches;
  if (coarse || noHover || navigator.maxTouchPoints > 0) {
    Input.touch = true;
    document.body.classList.add('touch');
  }
};

Input.gamepad = function () {
  if (!navigator.getGamepads) return;
  let gp = null;
  for (const g of navigator.getGamepads()) if (g) { gp = g; break; }
  if (!gp) return;
  const b = gp.buttons, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  const set = (a, on) => { if (on) Input.press(a); else if (Input._gp && Input._gp[a]) Input.release(a); };
  const st = Input._gp || (Input._gp = {});
  const map = {
    left: ax < -0.4 || (b[14] && b[14].pressed),
    right: ax > 0.4 || (b[15] && b[15].pressed),
    up: ay < -0.5 || (b[12] && b[12].pressed),
    down: ay > 0.5 || (b[13] && b[13].pressed),
    jump: b[0] && b[0].pressed,
    lob: b[2] && b[2].pressed,
    slurp: b[1] && b[1].pressed,
    talk: (b[3] && b[3].pressed) || (b[0] && b[0].pressed),
    pause: b[9] && b[9].pressed,
  };
  for (const a in map) { set(a, !!map[a]); st[a] = !!map[a]; }
};

Input.endFrame = function () {
  Input.pressed = {}; Input.released = {};
  Input.anyKey = false;
};

Input.axis = function () {
  return (Input.held.right ? 1 : 0) - (Input.held.left ? 1 : 0);
};

// Keyboard + mouse + touch. Read move each frame; take() consumes one-shot actions and look deltas.
export function createInput(canvas, touchUi) {
  const keys = new Set();
  const state = { move: { x: 0, z: 0 }, jump: false, wave: false, look: { x: 0, y: 0 }, zoom: 0, enabled: true };
  const stick = { id: null, x: 0, z: 0 };
  const typing = e => e.target.closest?.('input, textarea, select');

  const onKey = down => e => {
    if (typing(e)) return;
    const k = e.code;
    if (down && (k === 'Space') && !keys.has(k)) state.jump = true;
    if (down && k === 'Digit1') state.wave = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    down ? keys.add(k) : keys.delete(k);
  };
  const kd = onKey(true), ku = onKey(false), blur = () => keys.clear();
  addEventListener('keydown', kd);
  addEventListener('keyup', ku);
  addEventListener('blur', blur);

  // drag on the canvas orbits the camera (mouse or finger)
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    state.look.x += e.clientX - drag.x; state.look.y += e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = e => { if (drag?.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', e => { state.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

  // touch joystick + buttons
  const pad = touchUi.querySelector('.stick'), knob = touchUi.querySelector('.knob');
  pad.addEventListener('pointerdown', e => { stick.id = e.pointerId; pad.setPointerCapture(e.pointerId); moveStick(e); });
  pad.addEventListener('pointermove', e => e.pointerId === stick.id && moveStick(e));
  const endStick = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.z = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', endStick);
  pad.addEventListener('pointercancel', endStick);
  function moveStick(e) {
    const r = pad.getBoundingClientRect(), max = r.width / 2;
    let dx = e.clientX - (r.left + max), dy = e.clientY - (r.top + max);
    const len = Math.hypot(dx, dy);
    if (len > max) { dx *= max / len; dy *= max / len; }
    stick.x = dx / max; stick.z = -dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  touchUi.querySelector('.jump').addEventListener('pointerdown', () => { state.jump = true; });
  touchUi.querySelector('.wave').addEventListener('pointerdown', () => { state.wave = true; });

  return {
    state,
    // per frame: current move vector (x right, z forward, length <= 1)
    move() {
      if (!state.enabled) return { x: 0, z: 0 };
      let x = stick.x, z = stick.z;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
      const len = Math.hypot(x, z);
      return len > 1 ? { x: x / len, z: z / len } : { x, z };
    },
    take() {
      const out = { jump: state.enabled && state.jump, wave: state.enabled && state.wave, look: { ...state.look }, zoom: state.zoom };
      state.jump = state.wave = false; state.look.x = state.look.y = 0; state.zoom = 0;
      return out;
    },
    dispose() {
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur);
    },
  };
}

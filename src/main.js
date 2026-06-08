import { MOLECULES } from './molecules.js';

// ─── DOM refs ────────────────────────────────────────────────────────────────
const select       = document.getElementById('molecule-select');
const table        = document.getElementById('molecule-table');
const note         = document.getElementById('molecule-note');
const checklist    = document.getElementById('checklist');
const startButton  = document.getElementById('start-camera');
const themeToggle  = document.getElementById('theme-toggle');
const video        = document.getElementById('webcam');
const canvas       = document.getElementById('overlay');
const ctx          = canvas.getContext('2d');
const cameraDot    = document.getElementById('camera-dot');
const faceDot      = document.getElementById('face-dot');
const handDot      = document.getElementById('hand-dot');
const cameraStatus = document.getElementById('camera-status');
const faceStatus   = document.getElementById('face-status');
const handStatus   = document.getElementById('hand-status');
const angleLabel   = document.getElementById('angle-label');
const motionLabel  = document.getElementById('motion-label');

// ─── Constants ───────────────────────────────────────────────────────────────
const ALPHA        = 0.65;   // EMA smoothing factor
const ANGLE_CLAMP  = 30;     // max deviation from equilibrium in degrees
const HISTORY_LEN  = 30;     // frames to keep (~0.5s at 60fps)
const VEL_WINDOW   = 8;      // frames for velocity estimate

// ─── State ───────────────────────────────────────────────────────────────────
let stream         = null;
let faceLandmarker = null;
let handLandmarker = null;
let mpReady        = false;
let fakeT          = 0;
let lastVideoTime  = -1;
let smoothHead     = null;
let smoothAtoms    = [null, null];

// Ring buffer of past frames: [{left, right, anchor, t}, ...]
const history = [];

// ─── Utilities ───────────────────────────────────────────────────────────────
function lerpPt(prev, next, t) {
  if (!prev) return { ...next };
  const out = {};
  for (const k of Object.keys(next)) {
    const pv = prev[k], nv = next[k];
    out[k] = (typeof pv === 'number' && typeof nv === 'number') ? pv + (nv - pv) * t : nv;
  }
  return out;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function angleRad(A, B, C) {
  const ax = A.x - B.x, ay = A.y - B.y;
  const cx = C.x - B.x, cy = C.y - B.y;
  const dot = ax * cx + ay * cy;
  const mag = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (mag < 1e-6) return null;
  return Math.acos(clamp(dot / mag, -1, 1));
}

function angleDeg(A, B, C) {
  const r = angleRad(A, B, C);
  return r === null ? null : r * 180 / Math.PI;
}

function classifyGeometry(theta) {
  if (theta === null) return null;
  if (theta > 165)    return 'linear';
  if (theta < 150)    return 'bent';
  return 'ambiguous';
}

// ─── Equilibrium constraint ───────────────────────────────────────────────────
// Rotate terminal atoms so the A–B–C angle stays within ANGLE_CLAMP degrees
// of the molecule's equilibrium angle. Bond lengths are NOT constrained.
function constrainAngle(A, B, C, eqDeg) {
  if (eqDeg === null) return { A, C };
  const rawDeg = angleDeg(A, B, C);
  if (rawDeg === null) return { A, C };

  const delta = rawDeg - eqDeg;
  if (Math.abs(delta) <= ANGLE_CLAMP) return { A, C };

  // How much to rotate each terminal atom around B to bring angle back
  const targetDeg  = eqDeg + clamp(delta, -ANGLE_CLAMP, ANGLE_CLAMP);
  const targetRad  = targetDeg * Math.PI / 180;

  // Current half-angle each arm makes relative to bisector
  const midAngle = Math.atan2(
    (A.y - B.y) + (C.y - B.y),
    (A.x - B.x) + (C.x - B.x)
  );

  const rA = Math.hypot(A.x - B.x, A.y - B.y);
  const rC = Math.hypot(C.x - B.x, C.y - B.y);
  const half = targetRad / 2;

  const bisector = Math.atan2(
    (A.y - B.y + C.y - B.y),
    (A.x - B.x + C.x - B.x)
  );

  const newA = {
    x: B.x + rA * Math.cos(bisector - half),
    y: B.y + rA * Math.sin(bisector - half)
  };
  const newC = {
    x: B.x + rC * Math.cos(bisector + half),
    y: B.y + rC * Math.sin(bisector + half)
  };
  return { A: newA, C: newC };
}

// ─── Position history & motion classification ─────────────────────────────────
function pushHistory(left, right, anchor) {
  history.push({ left, right, anchor, t: performance.now() });
  if (history.length > HISTORY_LEN) history.shift();
}

function velocityFromHistory(slot) {
  // slot: 'left' | 'right' | 'anchor'
  const n = history.length;
  if (n < VEL_WINDOW + 1) return { vx: 0, vy: 0 };
  const old = history[n - VEL_WINDOW - 1][slot];
  const cur = history[n - 1][slot];
  if (!old || !cur) return { vx: 0, vy: 0 };
  const dt = (history[n - 1].t - history[n - VEL_WINDOW - 1].t) || 1;
  return { vx: (cur.x - old.x) / dt, vy: (cur.y - old.y) / dt };
}

// Returns a motion label string for the current molecule type
function classifyMotion(key) {
  const n = history.length;
  if (n < VEL_WINDOW + 2) return null;

  const vA = velocityFromHistory('anchor');

  if (key === 'He') {
    const speed = Math.hypot(vA.vx, vA.vy);
    return speed > 0.008 ? 'translation' : 'still';
  }

  const cur  = history[n - 1];
  if (!cur.left || !cur.right) return null;

  const vL = velocityFromHistory('left');
  const vR = velocityFromHistory('right');

  // Translation: all three atoms moving in roughly the same direction
  const avgVx = (vL.vx + vR.vx + vA.vx) / 3;
  const avgVy = (vL.vy + vR.vy + vA.vy) / 3;
  const comSpeed = Math.hypot(avgVx, avgVy);

  // Residual velocities (subtract COM motion)
  const rLx = vL.vx - avgVx, rLy = vL.vy - avgVy;
  const rRx = vR.vx - avgVx, rRy = vR.vy - avgVy;
  const rAx = vA.vx - avgVx, rAy = vA.vy - avgVy;

  const residualMax = Math.max(
    Math.hypot(rLx, rLy), Math.hypot(rRx, rRy), Math.hypot(rAx, rAy)
  );

  if (comSpeed > 0.012 && comSpeed > residualMax * 1.8) return 'translation';

  // Bond axis unit vector (left → right)
  const bx = cur.right.x - cur.left.x;
  const by = cur.right.y - cur.left.y;
  const bLen = Math.hypot(bx, by) || 1;
  const ux = bx / bLen, uy = by / bLen;
  // Perpendicular
  const px = -uy, py = ux;

  // Project residual velocities onto bond axis and perpendicular
  const rLalong  = rLx * ux  + rLy * uy;
  const rRalong  = rRx * ux  + rRy * uy;
  const rLperp   = rLx * px  + rLy * py;
  const rRperp   = rRx * px  + rRy * py;

  // Sym stretch: terminals move away from (or toward) center simultaneously
  const symStretch  = -(rLalong) + rRalong;   // both outward: L goes left(neg), R goes right(pos)
  // Asym stretch: one in, one out
  const asymStretch = rLalong + rRalong;       // both going same direction along axis = asym
  // Bend: terminals move in same perpendicular direction (the bending mode)
  const bendSignal  = rLperp * rRperp;         // positive if same sign

  const signals = [
    { name: 'sym-stretch',  val: Math.abs(symStretch) },
    { name: 'asym-stretch', val: Math.abs(asymStretch) },
    { name: 'bend',         val: bendSignal > 0 ? Math.abs(rLperp) : 0 },
  ];

  // Rotation: check if anchor and terminals circulate around COM
  const comX = (cur.left.x + cur.right.x + cur.anchor.x) / 3;
  const comY = (cur.left.y + cur.right.y + cur.anchor.y) / 3;
  const rotL = (cur.left.x  - comX) * vL.vy - (cur.left.y  - comY) * vL.vx;
  const rotR = (cur.right.x - comX) * vR.vy - (cur.right.y - comY) * vR.vx;
  const rotSignal = Math.abs(rotL + rotR);
  signals.push({ name: 'rotation', val: rotSignal * 0.005 });

  const best = signals.reduce((a, b) => a.val > b.val ? a : b);
  return best.val > 0.002 ? best.name : 'still';
}

// ─── Dipole arrow ─────────────────────────────────────────────────────────────
// For triatomics: compute vector sum of bond dipoles.
// Each bond dipole points from + to − end (partial charges vary by molecule).
// We approximate: for O–C–O (CO2) and O–H–H (H2O), the terminal-to-central
// vector is the negative pole direction.
// For CO diatomic: fixed direction C→O.
const DIPOLE_COLOR = 'rgba(253,171,67,0.95)'; // warm amber
const DIPOLE_SCALE = 90; // max arrow length in canvas pixels

function drawDipole(anchor, left, right, key) {
  const mol = MOLECULES[key];
  if (mol.dipoleMagnitude === 0 && key !== 'CO2' && key !== 'H2O') return;

  let dx = 0, dy = 0;

  if (key === 'CO') {
    // Bond vector from C (anchor) toward O (right or left terminal)
    const term = right || left;
    if (!term) return;
    const len = Math.hypot(term.x - anchor.x, term.y - anchor.y) || 1;
    dx = (term.x - anchor.x) / len * mol.dipoleMagnitude;
    dy = (term.y - anchor.y) / len * mol.dipoleMagnitude;
  } else if (key === 'CO2' || key === 'H2O') {
    if (!left || !right) return;
    // Bond dipole 1: central → left terminal
    const lLen = Math.hypot(left.x  - anchor.x, left.y  - anchor.y) || 1;
    const rLen = Math.hypot(right.x - anchor.x, right.y - anchor.y) || 1;
    // For CO2: O has higher electronegativity, dipole points C→O (central→terminal)
    // For H2O: O is central, H terminals — dipole points O→H direction each bond,
    //   but net dipole actually points away from H side toward O lone pairs.
    //   We flip for H2O: dipole points from terminal toward central.
    const sign = key === 'H2O' ? -1 : 1;
    const d1x = sign * (left.x  - anchor.x) / lLen;
    const d1y = sign * (left.y  - anchor.y) / lLen;
    const d2x = sign * (right.x - anchor.x) / rLen;
    const d2y = sign * (right.y - anchor.y) / rLen;
    dx = d1x + d2x;
    dy = d1y + d2y;
  } else {
    return;
  }

  const mag = Math.hypot(dx, dy);
  if (mag < 0.02) return; // near-zero — don't draw a meaningless stub

  const nx = dx / mag, ny = dy / mag;
  const arrowLen = mag * DIPOLE_SCALE;

  // Origin at anchor (central atom for triatomics, C for CO)
  const ox = anchor.x, oy = anchor.y;
  const ex = ox + nx * arrowLen, ey = oy + ny * arrowLen;

  ctx.save();
  ctx.strokeStyle = DIPOLE_COLOR;
  ctx.fillStyle   = DIPOLE_COLOR;
  ctx.lineWidth   = 3.5;
  ctx.lineCap     = 'round';

  // Shaft
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Arrowhead
  const headLen = 14, headAngle = 0.42;
  const ang = Math.atan2(ey - oy, ex - ox);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - headLen * Math.cos(ang - headAngle), ey - headLen * Math.sin(ang - headAngle));
  ctx.lineTo(ex - headLen * Math.cos(ang + headAngle), ey - headLen * Math.sin(ang + headAngle));
  ctx.closePath();
  ctx.fill();

  // μ label
  ctx.font         = '600 12px \'Work Sans\', sans-serif';
  ctx.fillStyle    = DIPOLE_COLOR;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('μ', ex + nx * 14, ey + ny * 14);
  ctx.restore();
}

// ─── MediaPipe init ──────────────────────────────────────────────────────────
const MP_VERSION = '0.10.14';
const MP_BASE    = `https://unpkg.com/@mediapipe/tasks-vision@${MP_VERSION}`;
const WASM_PATH  = `${MP_BASE}/wasm`;
const BUNDLE_URL = `${MP_BASE}/vision_bundle.mjs`;

async function initMediaPipe() {
  setStatus(faceDot, faceStatus, 'Loading models…', 'idle');
  const { FaceLandmarker, HandLandmarker, FilesetResolver } = await import(BUNDLE_URL);
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  [faceLandmarker, handLandmarker] = await Promise.all([
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO', numFaces: 1,
      outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false
    }),
    HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO', numHands: 2
    })
  ]);
  mpReady = true;
  setStatus(faceDot, faceStatus, 'Show your face…', 'idle');
  setStatus(handDot, handStatus, 'Show your hands…', 'idle');
}

// ─── Molecule info panel ──────────────────────────────────────────────────────
function renderMoleculeInfo(key) {
  const m = MOLECULES[key];
  table.innerHTML = `
    <tr><th>Formula</th><td>${m.formula}</td></tr>
    <tr><th>Geometry</th><td>${m.geometry}</td></tr>
    <tr><th>Point group</th><td>${m.pointGroup}</td></tr>
    <tr><th>Total DOF (3N)</th><td>${m.totalDof}</td></tr>
    <tr><th>Translation</th><td>${m.translation}</td></tr>
    <tr><th>Rotation</th><td>${m.rotation}</td></tr>
    <tr><th>Vibration</th><td>${m.vibration}</td></tr>
    ${m.equilibriumAngleDeg !== null ? `<tr><th>Equil. angle</th><td>${m.equilibriumAngleDeg}°</td></tr>` : ''}
  `;
  note.textContent = m.note;
  checklist.innerHTML = m.checklist.map(item => `
    <div class="check"><strong>${item}</strong><small>Move to demonstrate this mode.</small></div>
  `).join('');
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function setStatus(dot, label, text, type = 'idle') {
  dot.className = 'dot' + (type === 'ready' ? ' ready' : type === 'error' ? ' error' : '');
  label.textContent = text;
}

// ─── Canvas resize ────────────────────────────────────────────────────────────
function resizeCanvas() {
  const rect = video.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
const COLORS = { C:'#4f98a3', O:'#d163a7', N:'#6daa45', H:'#bb653b', He:'#6daa45' };

function drawAtom(x, y, r, color, label) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.fillStyle = color; ctx.globalAlpha = 0.9;
  ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  if (label) {
    ctx.fillStyle = 'rgba(14,15,16,0.9)';
    ctx.font = `700 ${Math.max(10, r * 0.72)}px 'Work Sans', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }
  ctx.restore();
}

function drawBond(x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = 'rgba(205,204,202,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

function drawHeadCircle(cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = 'rgba(79,152,163,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
}

function drawConnector(x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = 'rgba(79,152,163,0.28)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
}

function drawMoleculeLabel(cx, anchorY, text) {
  ctx.save();
  ctx.font = `700 14px 'Work Sans', sans-serif`;
  const tw = ctx.measureText(text).width;
  const pad = 10, h = 24, bx = cx - tw / 2 - pad, by = anchorY - 52;
  ctx.fillStyle = 'rgba(14,15,16,0.78)';
  ctx.beginPath(); ctx.roundRect(bx, by, tw + pad * 2, h, 6); ctx.fill();
  ctx.fillStyle = '#cdccca'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, by + h / 2);
  ctx.restore();
}

// ─── Live overlay ─────────────────────────────────────────────────────────────
function drawOverlay(headPt, rawAtoms, key) {
  const w = canvas.clientWidth  || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  ctx.clearRect(0, 0, w, h);

  const { x: cx, y: cy, r: headR, topY } = headPt;
  const safeTopY = Number.isFinite(topY) ? topY : cy - headR;
  const anchor   = { x: cx, y: safeTopY - 28 };

  drawHeadCircle(cx, cy, headR);
  drawConnector(cx, safeTopY, cx, anchor.y + 10);

  const mol = MOLECULES[key];

  if (key === 'He') {
    drawAtom(anchor.x, anchor.y, 24, COLORS.He, 'He');
    pushHistory(null, null, anchor);

  } else if (key === 'N2' || key === 'CO') {
    const term = rawAtoms[0] || rawAtoms[1] || { x: anchor.x + 90, y: anchor.y };
    const [c1, c2, l1, l2] = key === 'CO'
      ? [COLORS.C, COLORS.O, 'C', 'O']
      : [COLORS.N, COLORS.N, 'N', 'N'];
    drawBond(anchor.x, anchor.y, term.x, term.y);
    drawAtom(anchor.x, anchor.y, 20, c1, l1);
    drawAtom(term.x,  term.y,   18, c2, l2);
    if (key === 'CO') drawDipole(anchor, null, term, key);
    pushHistory(null, term, anchor);

  } else {
    // CO2 or H2O — two terminal atoms, apply angle constraint
    const rawL = rawAtoms[0] || { x: anchor.x - 95, y: anchor.y };
    const rawR = rawAtoms[1] || { x: anchor.x + 95, y: anchor.y };

    const { A: left, C: right } = constrainAngle(rawL, anchor, rawR, mol.equilibriumAngleDeg);

    const theta = angleDeg(left, anchor, right);
    const geo   = classifyGeometry(theta);

    const [cC, cT, lC, lT] = key === 'CO2'
      ? [COLORS.C, COLORS.O, 'C', 'O']
      : [COLORS.O, COLORS.H, 'O', 'H'];
    const [rC, rT] = key === 'CO2' ? [20, 17] : [20, 15];

    drawBond(anchor.x, anchor.y, left.x,  left.y);
    drawBond(anchor.x, anchor.y, right.x, right.y);
    drawAtom(left.x,   left.y,   rT, cT, lT);
    drawAtom(anchor.x, anchor.y, rC, cC, lC);
    drawAtom(right.x,  right.y,  rT, cT, lT);

    drawDipole(anchor, left, right, key);

    if (theta !== null && angleLabel) {
      const eq = mol.equilibriumAngleDeg;
      const dev = eq !== null ? ` (${(theta - eq > 0 ? '+' : '')}${(theta - eq).toFixed(1)}°)` : '';
      angleLabel.textContent = `${theta.toFixed(1)}°${dev} — ${geo ?? '?'}`;
      angleLabel.dataset.geo = geo ?? 'ambiguous';
    }

    pushHistory(left, right, anchor);
  }

  drawMoleculeLabel(anchor.x, anchor.y, mol.formula);

  // Motion classification from history
  const motion = classifyMotion(key);
  if (motion && motionLabel) {
    motionLabel.textContent = motion;
    motionLabel.dataset.motion = motion;
  }
}

// ─── Placeholder (no face yet) ────────────────────────────────────────────────
function drawPlaceholder() {
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w * 0.5, cy = h * 0.52;
  const headR = Math.min(w, h) * 0.2;
  const anchorY = cy - headR * 2.4;
  const pulse = Math.sin(fakeT) * 10;

  ctx.save();
  ctx.strokeStyle = 'rgba(79,152,163,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.arc(cx, cy, headR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(79,152,163,0.28)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, cy - headR); ctx.lineTo(cx, anchorY + 10); ctx.stroke();

  const key = select.value;
  if (key === 'He') {
    _a(cx, anchorY, 24, COLORS.He);
  } else if (key === 'N2') {
    _b(cx - 52, anchorY, cx + 52 + pulse * 0.4, anchorY);
    _a(cx - 52, anchorY, 18, COLORS.N); _a(cx + 52 + pulse * 0.4, anchorY, 18, COLORS.N);
  } else if (key === 'CO') {
    _b(cx - 52, anchorY, cx + 52 + pulse * 0.4, anchorY);
    _a(cx - 52, anchorY, 20, COLORS.C); _a(cx + 52 + pulse * 0.4, anchorY, 16, COLORS.O);
  } else if (key === 'CO2') {
    _b(cx - 70 - pulse * 0.3, anchorY, cx, anchorY); _b(cx, anchorY, cx + 70 + pulse * 0.3, anchorY);
    _a(cx - 70 - pulse * 0.3, anchorY, 17, COLORS.O); _a(cx, anchorY, 20, COLORS.C); _a(cx + 70 + pulse * 0.3, anchorY, 17, COLORS.O);
  } else {
    const ang = Math.PI / 5, r = 68;
    const lx = cx - Math.cos(ang) * r - pulse * 0.12;
    const rx = cx + Math.cos(ang) * r + pulse * 0.12;
    const ey = anchorY + Math.sin(ang) * r + Math.abs(pulse) * 0.08;
    _b(cx, anchorY, lx, ey); _b(cx, anchorY, rx, ey);
    _a(cx, anchorY, 20, COLORS.O); _a(lx, ey, 15, COLORS.H); _a(rx, ey, 15, COLORS.H);
  }

  drawMoleculeLabel(cx, anchorY, MOLECULES[key].formula);
  ctx.restore();

  function _a(x, y, r, color) {
    ctx.beginPath(); ctx.fillStyle = color; ctx.globalAlpha = 0.88;
    ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  function _b(x1, y1, x2, y2) {
    ctx.beginPath(); ctx.strokeStyle = 'rgba(205,204,202,0.8)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
}

// ─── Palm center ──────────────────────────────────────────────────────────────
function palmCenter(hand, w, h) {
  const idxs = [0, 5, 9, 13, 17];
  let sx = 0, sy = 0;
  for (const i of idxs) { sx += (1 - hand[i].x) * w; sy += hand[i].y * h; }
  return { x: sx / idxs.length, y: sy / idxs.length, r: 0 };
}

// ─── Per-frame detect ─────────────────────────────────────────────────────────
function detectFrame() {
  if (!mpReady || !stream || video.readyState < 2) return null;
  if (video.currentTime === lastVideoTime) return 'stale';
  lastVideoTime = video.currentTime;

  const now        = performance.now();
  const faceResult = faceLandmarker.detectForVideo(video, now);
  const handResult = handLandmarker.detectForVideo(video, now);

  const w = canvas.clientWidth  || canvas.width;
  const h = canvas.clientHeight || canvas.height;

  let headPt = null;
  if (faceResult.faceLandmarks?.length > 0) {
    const lm     = faceResult.faceLandmarks[0];
    const top    = lm[10], chin = lm[152], lCheek = lm[234], rCheek = lm[454];
    const headCX = ((1 - lCheek.x) + (1 - rCheek.x)) / 2 * w;
    const headCY = ((top.y + chin.y) / 2) * h;
    const rawR   = Math.abs(chin.y - top.y) * h * 0.58;
    const topY   = top.y * h;
    smoothHead   = lerpPt(smoothHead, { x: headCX, y: headCY, r: rawR, topY }, ALPHA);
    headPt       = smoothHead;
    setStatus(faceDot, faceStatus, 'Face detected ✓', 'ready');
  } else {
    smoothHead = null;
    setStatus(faceDot, faceStatus, 'Show your face', 'idle');
  }

  const atomMap = [null, null];
  if (handResult.landmarks?.length > 0) {
    handResult.landmarks.forEach((hand, i) => {
      const side = handResult.handedness[i]?.[0]?.categoryName ?? 'Left';
      const slot = side === 'Right' ? 0 : 1;
      const raw  = palmCenter(hand, w, h);
      smoothAtoms[slot] = lerpPt(smoothAtoms[slot], raw, ALPHA);
      atomMap[slot] = smoothAtoms[slot];
    });
  } else {
    smoothAtoms = [null, null];
  }

  const key = select.value;
  const needs2 = ['CO2', 'H2O'].includes(key);
  const handCount = atomMap.filter(Boolean).length;
  if (key === 'He') {
    setStatus(handDot, handStatus, 'No hands needed for He', 'ready');
  } else if (needs2 && handCount < 2) {
    setStatus(handDot, handStatus, `Show both hands (${handCount}/2)`, 'idle');
  } else if (handCount > 0) {
    setStatus(handDot, handStatus, `${handCount} hand${handCount > 1 ? 's' : ''} detected ✓`, 'ready');
  } else {
    setStatus(handDot, handStatus, 'Show your hands', 'idle');
  }

  return { headPt, atoms: atomMap };
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function loop() {
  fakeT += 0.06;
  const result = detectFrame();
  if (result && result !== 'stale' && result.headPt) {
    drawOverlay(result.headPt, result.atoms, select.value);
  } else {
    drawPlaceholder();
  }
  requestAnimationFrame(loop);
}

// ─── Camera start ─────────────────────────────────────────────────────────────
async function startCamera() {
  if (stream) return;
  startButton.textContent = 'Starting…'; startButton.disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    });
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', resizeCanvas, { once: true });
    await video.play();
    resizeCanvas();
    setStatus(cameraDot, cameraStatus, 'Camera live ✓', 'ready');
    startButton.textContent = 'Camera running';
    try {
      await initMediaPipe();
    } catch (e) {
      console.error('MediaPipe load failed:', e);
      setStatus(faceDot, faceStatus, 'MediaPipe failed — see console', 'error');
    }
    loop();
  } catch (err) {
    console.error(err);
    setStatus(cameraDot, cameraStatus, 'Camera blocked', 'error');
    setStatus(faceDot, faceStatus, 'Check browser permission', 'error');
    startButton.textContent = 'Start camera'; startButton.disabled = false;
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────
select.addEventListener('change', () => {
  renderMoleculeInfo(select.value);
  history.length = 0; // clear history on molecule switch
  if (angleLabel) { angleLabel.textContent = '—'; delete angleLabel.dataset.geo; }
  if (motionLabel) { motionLabel.textContent = '—'; delete motionLabel.dataset.motion; }
});
startButton.addEventListener('click', startCamera);
window.addEventListener('resize', resizeCanvas);
themeToggle.addEventListener('click', () => {
  const root = document.documentElement;
  root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
renderMoleculeInfo(select.value);
drawPlaceholder();

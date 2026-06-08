import { MOLECULES } from './molecules.js';

// ─── DOM refs ───────────────────────────────────────────────────────────────
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

// ─── State ──────────────────────────────────────────────────────────────────
let stream         = null;
let faceLandmarker = null;
let handLandmarker = null;
let mpReady        = false;
let fakeT          = 0;
let lastVideoTime  = -1;

// Smoothing: exponential moving average
// 0.65 = faster response (was 0.35), still damps micro-jitter
const ALPHA = 0.65;
let smoothHead  = null;        // { x, y, r }
let smoothAtoms = [null, null]; // left & right terminal atoms

function lerpPt(prev, next, t) {
  if (!prev) return { ...next };
  return {
    x: prev.x + (next.x - prev.x) * t,
    y: prev.y + (next.y - prev.y) * t,
    r: (prev.r ?? next.r) + ((next.r ?? prev.r) - (prev.r ?? next.r)) * t
  };
}

// ─── MediaPipe init ─────────────────────────────────────────────────────────
const MP_VERSION  = '0.10.14';
const MP_BASE     = `https://unpkg.com/@mediapipe/tasks-vision@${MP_VERSION}`;
const WASM_PATH   = `${MP_BASE}/wasm`;
const BUNDLE_URL  = `${MP_BASE}/vision_bundle.mjs`;

async function initMediaPipe() {
  setStatus(faceDot, faceStatus, 'Loading models…', 'idle');
  const { FaceLandmarker, HandLandmarker, FilesetResolver } =
    await import(BUNDLE_URL);

  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

  [faceLandmarker, handLandmarker] = await Promise.all([
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false
    }),
    HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 2
    })
  ]);

  mpReady = true;
  setStatus(faceDot, faceStatus, 'Show your face…', 'idle');
  setStatus(handDot, handStatus, 'Show your hands…', 'idle');
}

// ─── Molecule info panel ─────────────────────────────────────────────────────
function renderMoleculeInfo(key) {
  const m = MOLECULES[key];
  table.innerHTML = `
    <tr><th>Formula</th>     <td>${m.formula}</td></tr>
    <tr><th>Geometry</th>    <td>${m.geometry}</td></tr>
    <tr><th>Point group</th> <td>${m.pointGroup}</td></tr>
    <tr><th>Total DOF (3N)</th><td>${m.totalDof}</td></tr>
    <tr><th>Translation</th> <td>${m.translation}</td></tr>
    <tr><th>Rotation</th>    <td>${m.rotation}</td></tr>
    <tr><th>Vibration</th>   <td>${m.vibration}</td></tr>
  `;
  note.textContent = m.note;
  checklist.innerHTML = m.checklist.map(item => `
    <div class="check">
      <strong>${item}</strong>
      <small>Move to demonstrate this mode.</small>
    </div>
  `).join('');
}

// ─── Status helpers ──────────────────────────────────────────────────────────
function setStatus(dot, label, text, type = 'idle') {
  dot.className = 'dot' + (type === 'ready' ? ' ready' : type === 'error' ? ' error' : '');
  label.textContent = text;
}

// ─── Canvas resize ───────────────────────────────────────────────────────────
function resizeCanvas() {
  const rect = video.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─── Draw helpers ────────────────────────────────────────────────────────────
function drawAtom(x, y, r, color, label) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = 14;
  ctx.beginPath();
  ctx.fillStyle   = color;
  ctx.globalAlpha = 0.9;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  if (label) {
    ctx.fillStyle    = 'rgba(14,15,16,0.9)';
    ctx.font         = `700 ${Math.max(10, r * 0.72)}px 'Work Sans', sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }
  ctx.restore();
}

function drawBond(x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = 'rgba(205,204,202,0.85)';
  ctx.lineWidth   = 5;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawHeadCircle(cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = 'rgba(79,152,163,0.5)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawConnector(x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = 'rgba(79,152,163,0.28)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawMoleculeLabel(cx, anchorY, text) {
  ctx.save();
  ctx.font = `700 14px 'Work Sans', sans-serif`;
  const tw  = ctx.measureText(text).width;
  const pad = 10, h = 24;
  const bx  = cx - tw / 2 - pad;
  const by  = anchorY - 52;
  ctx.fillStyle = 'rgba(14,15,16,0.78)';
  ctx.beginPath();
  ctx.roundRect(bx, by, tw + pad * 2, h, 6);
  ctx.fill();
  ctx.fillStyle    = '#cdccca';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, by + h / 2);
  ctx.restore();
}

// ─── Angle computation ───────────────────────────────────────────────────────
function computeAngle(A, B, C) {
  const ax = A.x - B.x, ay = A.y - B.y;
  const cx = C.x - B.x, cy = C.y - B.y;
  const dot = ax * cx + ay * cy;
  const mag = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (mag < 1e-6) return null;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

function classifyGeometry(theta) {
  if (theta === null) return null;
  if (theta > 165) return 'linear';
  if (theta < 150) return 'bent';
  return 'ambiguous';
}

// ─── Live overlay (face detected) ───────────────────────────────────────────
const COLORS = { C:'#4f98a3', O:'#d163a7', N:'#6daa45', H:'#bb653b', He:'#6daa45' };

function drawOverlay(headPt, atoms, key) {
  const w = canvas.clientWidth  || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  ctx.clearRect(0, 0, w, h);

  const { x: cx, y: cy, r: headR, topY } = headPt;
  // Anchor sits just above the head top landmark — not a fixed multiple of headR
  const anchor = { x: cx, y: topY - 28 };

  drawHeadCircle(cx, cy, headR);
  drawConnector(cx, topY, cx, anchor.y + 10);

  if (key === 'He') {
    drawAtom(anchor.x, anchor.y, 24, COLORS.He, 'He');

  } else if (key === 'N2' || key === 'CO') {
    const term  = atoms[0] || atoms[1] || { x: anchor.x + 90, y: anchor.y };
    const [c1, c2, l1, l2] = key === 'CO'
      ? [COLORS.C, COLORS.O, 'C', 'O']
      : [COLORS.N, COLORS.N, 'N', 'N'];
    drawBond(anchor.x, anchor.y, term.x, term.y);
    drawAtom(anchor.x, anchor.y, 20, c1, l1);
    drawAtom(term.x,  term.y,   18, c2, l2);

  } else {
    // CO2 or H2O — need two terminal atoms
    const left  = atoms[0] || { x: anchor.x - 95, y: anchor.y };
    const right = atoms[1] || { x: anchor.x + 95, y: anchor.y };
    const theta = computeAngle(left, anchor, right);
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

    if (theta !== null && angleLabel) {
      angleLabel.textContent  = `${theta.toFixed(1)}° — ${geo ?? '?'}`;
      angleLabel.dataset.geo  = geo ?? 'ambiguous';
    }
  }

  drawMoleculeLabel(anchor.x, anchor.y, MOLECULES[key].formula);
}

// ─── Placeholder (no face yet) ───────────────────────────────────────────────
function drawPlaceholder() {
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx      = w * 0.5;
  const cy      = h * 0.52;
  const headR   = Math.min(w, h) * 0.2;
  const anchorY = cy - headR * 2.4;
  const pulse   = Math.sin(fakeT) * 10;

  ctx.save();
  ctx.strokeStyle = 'rgba(79,152,163,0.45)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(cx, cy, headR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(79,152,163,0.28)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - headR);
  ctx.lineTo(cx, anchorY + 10);
  ctx.stroke();

  const key = select.value;

  if (key === 'He') {
    _a(cx, anchorY, 24, COLORS.He);
  } else if (key === 'N2') {
    _b(cx - 52, anchorY, cx + 52 + pulse * 0.4, anchorY);
    _a(cx - 52, anchorY, 18, COLORS.N);
    _a(cx + 52 + pulse * 0.4, anchorY, 18, COLORS.N);
  } else if (key === 'CO') {
    _b(cx - 52, anchorY, cx + 52 + pulse * 0.4, anchorY);
    _a(cx - 52, anchorY, 20, COLORS.C);
    _a(cx + 52 + pulse * 0.4, anchorY, 16, COLORS.O);
  } else if (key === 'CO2') {
    _b(cx - 70 - pulse * 0.3, anchorY, cx, anchorY);
    _b(cx, anchorY, cx + 70 + pulse * 0.3, anchorY);
    _a(cx - 70 - pulse * 0.3, anchorY, 17, COLORS.O);
    _a(cx, anchorY, 20, COLORS.C);
    _a(cx + 70 + pulse * 0.3, anchorY, 17, COLORS.O);
  } else {
    const ang = Math.PI / 5, r = 68;
    const lx  = cx - Math.cos(ang) * r - pulse * 0.12;
    const rx  = cx + Math.cos(ang) * r + pulse * 0.12;
    const ey  = anchorY + Math.sin(ang) * r + Math.abs(pulse) * 0.08;
    _b(cx, anchorY, lx, ey); _b(cx, anchorY, rx, ey);
    _a(cx, anchorY, 20, COLORS.O);
    _a(lx, ey, 15, COLORS.H);
    _a(rx, ey, 15, COLORS.H);
  }

  drawMoleculeLabel(cx, anchorY, MOLECULES[key].formula);
  ctx.restore();

  function _a(x, y, r, color) {
    ctx.beginPath();
    ctx.fillStyle   = color;
    ctx.globalAlpha = 0.88;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function _b(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(205,204,202,0.8)';
    ctx.lineWidth   = 5;
    ctx.lineCap     = 'round';
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

// ─── Palm center helper ───────────────────────────────────────────────────────
// Averages landmarks 0 (wrist), 5, 9, 13, 17 (MCP knuckles)
// This is much more stable than fingertip lm8 under open-hand conditions.
function palmCenter(hand, w, h) {
  const idxs = [0, 5, 9, 13, 17];
  let sx = 0, sy = 0;
  for (const i of idxs) {
    sx += (1 - hand[i].x) * w;   // mirror for selfie
    sy += hand[i].y * h;
  }
  return { x: sx / idxs.length, y: sy / idxs.length, r: 0 };
}

// ─── Per-frame MediaPipe detect ──────────────────────────────────────────────
function detectFrame() {
  if (!mpReady || !stream || video.readyState < 2) return null;
  if (video.currentTime === lastVideoTime) return 'stale';
  lastVideoTime = video.currentTime;

  const now        = performance.now();
  const faceResult = faceLandmarker.detectForVideo(video, now);
  const handResult = handLandmarker.detectForVideo(video, now);

  const w = canvas.clientWidth  || canvas.width;
  const h = canvas.clientHeight || canvas.height;

  // ── Face landmarks used:
  //   lm[10]  = top of head (forehead centre)
  //   lm[152] = chin
  //   lm[234] = left cheek edge  (right side of screen, mirrored)
  //   lm[454] = right cheek edge (left side of screen, mirrored)
  //
  // headCX: average of mirrored cheek landmarks → true horizontal centre
  // headCY: midpoint of top & chin → vertical centre
  // anchor: sits just above lm[10] (face top), not a fixed headR multiple
  let headPt = null;
  if (faceResult.faceLandmarks?.length > 0) {
    const lm      = faceResult.faceLandmarks[0];
    const top     = lm[10];
    const chin    = lm[152];
    const lCheek  = lm[234];   // appears on right of mirrored video
    const rCheek  = lm[454];   // appears on left of mirrored video
    // Mirror x (1 - x) for selfie mode
    const headCX  = ((1 - lCheek.x) + (1 - rCheek.x)) / 2 * w;
    const headCY  = ((top.y + chin.y) / 2) * h;
    const rawR    = Math.abs(chin.y - top.y) * h * 0.58;
    const topY    = top.y * h;
    smoothHead    = lerpPt(smoothHead, { x: headCX, y: headCY, r: rawR, topY }, ALPHA);
    headPt        = smoothHead;
    setStatus(faceDot, faceStatus, 'Face detected ✓', 'ready');
  } else {
    smoothHead = null;
    setStatus(faceDot, faceStatus, 'Show your face', 'idle');
  }

  // ── Hands: palm center (lm 0,5,9,13,17) instead of fingertip lm8
  const atomMap = { left: null, right: null };
  if (handResult.landmarks?.length > 0) {
    handResult.landmarks.forEach((hand, i) => {
      const side = handResult.handedness[i]?.[0]?.categoryName ?? 'Left';
      const slot = side === 'Right' ? 0 : 1;
      const raw  = palmCenter(hand, w, h);
      smoothAtoms[slot] = lerpPt(smoothAtoms[slot], raw, ALPHA);
      atomMap[slot === 0 ? 'left' : 'right'] = smoothAtoms[slot];
    });
  } else {
    smoothAtoms = [null, null];
  }

  // ── Hand status
  const key         = select.value;
  const needs2Hands = ['CO2', 'H2O'].includes(key);
  const handCount   = (atomMap.left ? 1 : 0) + (atomMap.right ? 1 : 0);

  if (key === 'He') {
    setStatus(handDot, handStatus, 'No hands needed for He', 'ready');
  } else if (needs2Hands && handCount < 2) {
    setStatus(handDot, handStatus, `Show both hands (${handCount}/2)`, 'idle');
  } else if (handCount > 0) {
    setStatus(handDot, handStatus, `${handCount} hand${handCount > 1 ? 's' : ''} detected ✓`, 'ready');
  } else {
    setStatus(handDot, handStatus, 'Show your hands', 'idle');
  }

  return { headPt, atoms: [atomMap.left, atomMap.right] };
}

// ─── Main loop ───────────────────────────────────────────────────────────────
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
  startButton.textContent = 'Starting…';
  startButton.disabled    = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    });
    video.srcObject = stream;
    // Resize canvas once video dimensions are known
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
    setStatus(faceDot,   faceStatus,   'Check browser permission', 'error');
    startButton.textContent = 'Start camera';
    startButton.disabled    = false;
  }
}

// ─── Events ──────────────────────────────────────────────────────────────────
select.addEventListener('change', () => {
  renderMoleculeInfo(select.value);
  if (angleLabel) { angleLabel.textContent = '—'; delete angleLabel.dataset.geo; }
});
startButton.addEventListener('click', startCamera);
window.addEventListener('resize', resizeCanvas);
themeToggle.addEventListener('click', () => {
  const root = document.documentElement;
  root.setAttribute('data-theme',
    root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
renderMoleculeInfo(select.value);
drawPlaceholder();

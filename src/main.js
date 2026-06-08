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

// ─── State ───────────────────────────────────────────────────────────────────
let stream           = null;
let faceLandmarker   = null;
let handLandmarker   = null;
let mpReady          = false;
let fakeT            = 0;
let lastVideoTime    = -1;

// Smoothed positions (One-Euro-style: exponential moving average)
const ALPHA = 0.35; // lower = smoother but laggier
let smoothHead  = null;  // { x, y, r }
let smoothAtoms = [null, null]; // left & right terminal atoms

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpPt(prev, next, t) {
  if (!prev) return { ...next };
  return { x: lerp(prev.x, next.x, t), y: lerp(prev.y, next.y, t), r: lerp(prev.r ?? next.r, next.r, t) };
}

// ─── MediaPipe init ───────────────────────────────────────────────────────────
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.1/wasm';

async function initMediaPipe() {
  const { FaceLandmarker, HandLandmarker, FilesetResolver } =
    await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.1/vision_bundle.mjs');

  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  });

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numHands: 2
  });

  mpReady = true;
  setStatus(faceDot, faceStatus, 'Waiting for face…', 'idle');
  setStatus(handDot, handStatus, 'Waiting for hands…', 'idle');
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
  `;
  note.textContent = m.note;
  checklist.innerHTML = m.checklist.map(item => `
    <div class="check">
      <strong>${item}</strong>
      <small>Move to demonstrate this mode.</small>
    </div>
  `).join('');
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function setStatus(dot, label, text, type = 'idle') {
  dot.className = 'dot';
  if (type === 'ready') dot.classList.add('ready');
  if (type === 'error') dot.classList.add('error');
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
function drawAtom(x, y, r, color, label) {
  ctx.save();
  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur  = 12;
  ctx.beginPath();
  ctx.fillStyle   = color;
  ctx.globalAlpha = 0.9;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  // Atom label
  if (label) {
    ctx.fillStyle  = 'rgba(14,15,16,0.85)';
    ctx.font       = `700 ${Math.max(10, r * 0.75)}px Satoshi, sans-serif`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }
  ctx.restore();
}

function drawBond(x1, y1, x2, y2, dashed = false) {
  ctx.save();
  ctx.strokeStyle = 'rgba(205,204,202,0.85)';
  ctx.lineWidth   = 5;
  if (dashed) ctx.setLineDash([8, 6]);
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawHeadCircle(cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = 'rgba(79,152,163,0.55)';
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
  ctx.strokeStyle = 'rgba(79,152,163,0.3)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawMoleculeLabel(cx, anchorY, label) {
  const pad = 10, h = 24;
  ctx.save();
  ctx.font = '700 14px Satoshi, sans-serif';
  const tw = ctx.measureText(label).width;
  const bx = cx - tw / 2 - pad;
  const by = anchorY - 52;
  ctx.fillStyle = 'rgba(14,15,16,0.78)';
  ctx.beginPath();
  ctx.roundRect(bx, by, tw + pad * 2, h, 6);
  ctx.fill();
  ctx.fillStyle = '#cdccca';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, by + h / 2);
  ctx.restore();
}

// ─── Angle computation ────────────────────────────────────────────────────────
function computeAngle(termA, center, termB) {
  const ax = termA.x - center.x, ay = termA.y - center.y;
  const bx = termB.x - center.x, by = termB.y - center.y;
  const dot = ax * bx + ay * by;
  const mag = Math.sqrt(ax*ax+ay*ay) * Math.sqrt(bx*bx+by*by);
  if (mag < 1e-6) return null;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

function classifyGeometry(theta) {
  if (theta === null) return null;
  if (theta > 165) return 'linear';
  if (theta < 150) return 'bent';
  return 'ambiguous';
}

// ─── Main overlay draw ────────────────────────────────────────────────────────
function drawOverlay(headPt, atoms, key) {
  const w  = canvas.clientWidth  || canvas.width;
  const h  = canvas.clientHeight || canvas.height;
  ctx.clearRect(0, 0, w, h);

  const mol    = MOLECULES[key];
  const cx     = headPt.x;
  const cy     = headPt.y;
  const headR  = headPt.r;
  const anchor = { x: cx, y: cy - headR * 2.6 };

  drawHeadCircle(cx, cy, headR);
  drawConnector(cx, cy - headR, cx, anchor.y + 12);

  // Atom colors by element
  const COLORS = {
    C: '#4f98a3', O: '#d163a7', N: '#6daa45',
    H: '#bb653b', He: '#6daa45'
  };

  if (key === 'He') {
    drawAtom(anchor.x, anchor.y, 22, COLORS.He, 'He');

  } else if (key === 'N2' || key === 'CO') {
    // 1 terminal atom from hand; central above head
    const term = atoms[0] || atoms[1] || { x: anchor.x + 80, y: anchor.y };
    const [c1, c2] = key === 'CO' ? [COLORS.C, COLORS.O] : [COLORS.N, COLORS.N];
    const [l1, l2] = key === 'CO' ? ['C', 'O'] : ['N', 'N'];
    drawBond(anchor.x, anchor.y, term.x, term.y);
    drawAtom(anchor.x, anchor.y, 18, c1, l1);
    drawAtom(term.x, term.y, 16, c2, l2);

  } else if (key === 'CO2') {
    // CO2: head = C (central), both hands = O terminals
    const left  = atoms[0] || { x: anchor.x - 90, y: anchor.y };
    const right = atoms[1] || { x: anchor.x + 90, y: anchor.y };
    const theta = computeAngle(left, anchor, right);
    const geo   = classifyGeometry(theta);

    drawBond(anchor.x, anchor.y, left.x, left.y);
    drawBond(anchor.x, anchor.y, right.x, right.y);
    drawAtom(left.x, left.y, 17, COLORS.O, 'O');
    drawAtom(anchor.x, anchor.y, 20, COLORS.C, 'C');
    drawAtom(right.x, right.y, 17, COLORS.O, 'O');

    if (theta !== null && angleLabel) {
      angleLabel.textContent = `θ = ${theta.toFixed(1)}° — ${geo ?? '?'}`;
      angleLabel.dataset.geo = geo ?? 'ambiguous';
    }

  } else {
    // H2O: head = O (central), both hands = H terminals
    const left  = atoms[0] || { x: anchor.x - 70, y: anchor.y + 50 };
    const right = atoms[1] || { x: anchor.x + 70, y: anchor.y + 50 };
    const theta = computeAngle(left, anchor, right);
    const geo   = classifyGeometry(theta);

    drawBond(anchor.x, anchor.y, left.x, left.y);
    drawBond(anchor.x, anchor.y, right.x, right.y);
    drawAtom(left.x, left.y, 14, COLORS.H, 'H');
    drawAtom(anchor.x, anchor.y, 20, COLORS.O, 'O');
    drawAtom(right.x, right.y, 14, COLORS.H, 'H');

    if (theta !== null && angleLabel) {
      angleLabel.textContent = `θ = ${theta.toFixed(1)}° — ${geo ?? '?'}`;
      angleLabel.dataset.geo = geo ?? 'ambiguous';
    }
  }

  drawMoleculeLabel(anchor.x, anchor.y, mol.formula);
}

// ─── Placeholder (no face detected yet) ──────────────────────────────────────
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
  ctx.strokeStyle = 'rgba(79,152,163,0.5)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(cx, cy, headR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(79,152,163,0.3)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - headR);
  ctx.lineTo(cx, anchorY + 10);
  ctx.stroke();

  const key = select.value;

  if (key === 'He') {
    _atom(cx, anchorY, 22, '#6daa45');
  } else if (key === 'N2') {
    _bond(cx - 50, anchorY, cx + 50 + pulse * 0.4, anchorY);
    _atom(cx - 50, anchorY, 18, '#6daa45');
    _atom(cx + 50 + pulse * 0.4, anchorY, 18, '#6daa45');
  } else if (key === 'CO') {
    _bond(cx - 50, anchorY, cx + 50 + pulse * 0.4, anchorY);
    _atom(cx - 50, anchorY, 18, '#4f98a3');
    _atom(cx + 50 + pulse * 0.4, anchorY, 16, '#d163a7');
  } else if (key === 'CO2') {
    _bond(cx - 70, anchorY, cx, anchorY);
    _bond(cx, anchorY, cx + 70, anchorY);
    _atom(cx - 70 - pulse * 0.3, anchorY, 17, '#d163a7');
    _atom(cx, anchorY, 20, '#4f98a3');
    _atom(cx + 70 + pulse * 0.3, anchorY, 17, '#d163a7');
  } else {
    const ang = Math.PI / 5;
    const r   = 64;
    const lx  = cx - Math.cos(ang) * r;
    const rx  = cx + Math.cos(ang) * r;
    const ey  = anchorY + Math.sin(ang) * r;
    _bond(cx, anchorY, lx - pulse * 0.12, ey + pulse * 0.12);
    _bond(cx, anchorY, rx + pulse * 0.12, ey + pulse * 0.12);
    _atom(cx, anchorY, 20, '#4f98a3');
    _atom(lx - pulse * 0.12, ey + pulse * 0.12, 15, '#d163a7');
    _atom(rx + pulse * 0.12, ey + pulse * 0.12, 15, '#d163a7');
  }

  drawMoleculeLabel(cx, anchorY, MOLECULES[key].formula);
  ctx.restore();

  function _atom(x, y, r, color) {
    ctx.beginPath();
    ctx.fillStyle   = color;
    ctx.globalAlpha = 0.88;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function _bond(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(205,204,202,0.8)';
    ctx.lineWidth   = 5;
    ctx.lineCap     = 'round';
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

// ─── MediaPipe per-frame detect ───────────────────────────────────────────────
function detectFrame() {
  if (!mpReady || !stream || video.readyState < 2) return null;
  const now = performance.now();
  if (video.currentTime === lastVideoTime) return 'stale';
  lastVideoTime = video.currentTime;

  const faceResult = faceLandmarker.detectForVideo(video, now);
  const handResult = handLandmarker.detectForVideo(video, now);

  const w = canvas.clientWidth  || canvas.width;
  const h = canvas.clientHeight || canvas.height;

  // ── Face: get nose tip + estimate head radius from face bbox
  let headPt = null;
  if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
    const lm      = faceResult.faceLandmarks[0];
    // Landmark 1 = nose tip; landmark 10 = top of head; landmark 152 = chin
    const nose    = lm[1];
    // Estimate head radius as half the vertical span nose→chin * scale factor
    const chin    = lm[152];
    const topHead = lm[10];
    // Use mirrored x (video is CSS-flipped)
    const nx      = (1 - nose.x) * w;
    const ny      = nose.y * h;
    // Head center Y: midpoint between top and chin
    const headCY  = ((1 - topHead.x) * w + (1 - nose.x) * w) / 2 * 0 +  // unused x avg
                    (topHead.y * h + chin.y * h) / 2;
    const headCX  = nx;
    const faceH   = Math.abs(chin.y - topHead.y) * h;
    const rawR    = faceH * 0.6;
    const rawPt   = { x: headCX, y: headCY, r: rawR };
    smoothHead    = lerpPt(smoothHead, rawPt, ALPHA);
    headPt        = smoothHead;
    setStatus(faceDot, faceStatus, 'Face detected ✓', 'ready');
  } else {
    smoothHead = null;
    setStatus(faceDot, faceStatus, 'Show your face', 'idle');
  }

  // ── Hands: index fingertip (landmark 8), mirrored x
  // MediaPipe reports handedness as seen in image (mirrored), so
  // "Left" in result = user's right hand in selfie view
  const atomMap = { left: null, right: null };
  if (handResult.landmarks && handResult.landmarks.length > 0) {
    handResult.landmarks.forEach((hand, i) => {
      const tip  = hand[8]; // index fingertip
      const side = handResult.handedness[i]?.[0]?.categoryName ?? 'Left';
      // Mirror x for selfie
      const mx   = (1 - tip.x) * w;
      const my   = tip.y * h;
      const key  = side === 'Right' ? 'left' : 'right'; // swap for selfie
      const prev = atomMap[key];
      const smoothed = lerpPt(
        side === 'Right' ? smoothAtoms[0] : smoothAtoms[1],
        { x: mx, y: my, r: 0 },
        ALPHA
      );
      if (side === 'Right') smoothAtoms[0] = smoothed;
      else smoothAtoms[1] = smoothed;
      atomMap[key] = smoothed;
    });
  } else {
    smoothAtoms = [null, null];
  }

  // Hand status
  const key = select.value;
  const needsHands = key !== 'He';
  const needs2Hands = ['CO2', 'H2O'].includes(key);
  const handCount = (atomMap.left ? 1 : 0) + (atomMap.right ? 1 : 0);
  if (!needsHands) {
    setStatus(handDot, handStatus, 'No hands needed for He', 'ready');
  } else if (needs2Hands && handCount < 2) {
    setStatus(handDot, handStatus, `Show both hands (${handCount}/2)`, handCount > 0 ? 'idle' : 'idle');
  } else if (handCount > 0) {
    setStatus(handDot, handStatus, `${handCount} hand${handCount > 1 ? 's' : ''} detected ✓`, 'ready');
  } else {
    setStatus(handDot, handStatus, 'Show your hand(s)', 'idle');
  }

  return { headPt, atoms: [atomMap.left, atomMap.right] };
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function loop() {
  fakeT += 0.06;
  const result = detectFrame();
  if (result && result.headPt) {
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
    await video.play();
    resizeCanvas();
    setStatus(cameraDot, cameraStatus, 'Camera live ✓', 'ready');
    startButton.textContent = 'Camera running';

    if (!mpReady) {
      setStatus(faceDot, faceStatus, 'Loading MediaPipe…', 'idle');
      try {
        await initMediaPipe();
      } catch(e) {
        console.error('MediaPipe failed to load:', e);
        setStatus(faceDot, faceStatus, 'MediaPipe failed — check console', 'error');
      }
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

// ─── Events ───────────────────────────────────────────────────────────────────
select.addEventListener('change', () => {
  renderMoleculeInfo(select.value);
  if (angleLabel) angleLabel.textContent = '';
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

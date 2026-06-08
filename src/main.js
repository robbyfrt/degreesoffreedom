import { MOLECULES } from './molecules.js';

const select = document.getElementById('molecule-select');
const table = document.getElementById('molecule-table');
const note = document.getElementById('molecule-note');
const checklist = document.getElementById('checklist');
const startButton = document.getElementById('start-camera');
const themeToggle = document.getElementById('theme-toggle');
const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');

const cameraDot = document.getElementById('camera-dot');
const faceDot = document.getElementById('face-dot');
const handDot = document.getElementById('hand-dot');
const cameraStatus = document.getElementById('camera-status');
const faceStatus = document.getElementById('face-status');
const handStatus = document.getElementById('hand-status');

let stream = null;
let fakeT = 0;

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
      <small>Phase 1 will detect this motion live.</small>
    </div>
  `).join('');
}

function setStatus(dot, label, text, type = 'idle') {
  dot.className = 'dot';
  if (type === 'ready') dot.classList.add('ready');
  if (type === 'error') dot.classList.add('error');
  label.textContent = text;
}

function resizeCanvas() {
  const rect = video.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawPlaceholder() {
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.52;
  const headR = Math.min(w, h) * 0.2;
  const anchorY = cy - headR * 2.4;
  const pulse = Math.sin(fakeT) * 10;

  ctx.save();

  // Head circle placeholder
  ctx.strokeStyle = 'rgba(79,152,163,0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, headR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Connector line to molecule
  ctx.strokeStyle = 'rgba(79,152,163,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - headR);
  ctx.lineTo(cx, anchorY + 10);
  ctx.stroke();

  const key = select.value;

  if (key === 'He') {
    drawAtom(cx, anchorY, 18, '#6daa45');
  } else if (key === 'N2') {
    drawBond(cx - 44, anchorY, cx + 44, anchorY);
    drawAtom(cx - 44, anchorY, 16, '#6daa45');
    drawAtom(cx + 44 + pulse * 0.3, anchorY, 16, '#6daa45');
  } else if (key === 'CO') {
    drawBond(cx - 44, anchorY, cx + 44, anchorY);
    drawAtom(cx - 44, anchorY, 16, '#4f98a3');
    drawAtom(cx + 44 + pulse * 0.3, anchorY, 14, '#d163a7');
  } else if (key === 'CO2') {
    drawBond(cx - 58, anchorY, cx, anchorY);
    drawBond(cx, anchorY, cx + 58, anchorY);
    drawAtom(cx - 58 - pulse * 0.2, anchorY, 14, '#d163a7');
    drawAtom(cx, anchorY, 17, '#4f98a3');
    drawAtom(cx + 58 + pulse * 0.2, anchorY, 14, '#d163a7');
  } else {
    // H2O bent
    const ang = Math.PI / 5;
    const r = 56;
    const lx = cx - Math.cos(ang) * r;
    const rx = cx + Math.cos(ang) * r;
    const ey = anchorY + Math.sin(ang) * r;
    drawBond(cx, anchorY, lx, ey);
    drawBond(cx, anchorY, rx, ey);
    drawAtom(cx, anchorY, 18, '#4f98a3');
    drawAtom(lx - pulse * 0.1, ey + pulse * 0.1, 13, '#d163a7');
    drawAtom(rx + pulse * 0.1, ey + pulse * 0.1, 13, '#d163a7');
  }

  // Label
  const mol = MOLECULES[key];
  ctx.fillStyle = 'rgba(14,15,16,0.75)';
  roundRect(cx - 38, anchorY - 54, 76, 22, 6);
  ctx.fill();
  ctx.fillStyle = '#cdccca';
  ctx.font = '600 13px Satoshi, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mol.label, cx, anchorY - 39);

  ctx.restore();

  function drawAtom(x, y, r, color) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.92;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBond(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(205,204,202,0.85)';
    ctx.lineWidth = 4;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

async function startCamera() {
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    resizeCanvas();
    setStatus(cameraDot, cameraStatus, 'Camera live', 'ready');
    setStatus(faceDot, faceStatus, 'Phase 0 scaffold — no tracking yet', 'idle');
    setStatus(handDot, handStatus, 'MediaPipe wired in Phase 1', 'idle');
    startButton.textContent = 'Camera running';
    startButton.disabled = true;
    loop();
  } catch (err) {
    console.error(err);
    setStatus(cameraDot, cameraStatus, 'Camera blocked', 'error');
    setStatus(faceDot, faceStatus, 'Check browser permission', 'error');
  }
}

function loop() {
  fakeT += 0.06;
  drawPlaceholder();
  requestAnimationFrame(loop);
}

select.addEventListener('change', () => renderMoleculeInfo(select.value));
startButton.addEventListener('click', startCamera);
window.addEventListener('resize', resizeCanvas);

themeToggle.addEventListener('click', () => {
  const root = document.documentElement;
  root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// Init
renderMoleculeInfo(select.value);
drawPlaceholder();

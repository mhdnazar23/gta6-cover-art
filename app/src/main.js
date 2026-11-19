// Neon Coast — the studio UI: wires the controls to the cover engine,
// keeps an undo/redo history, and exports all three post sizes at once.
// Photos never leave the machine: uploads live as object URLs in memory.
import { drawCover, defaultState, ensurePanels, panelCount, hitPanel, LAYOUTS, GRADES, SIZES } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const preview = $('previewSize');
const statusEl = $('status');
const state = defaultState();
let photos = [];       // loaded images: 0 = pier, 1 = boulevard, then uploads
let photoNames = ['Pier (sample)', 'Boulevard (sample)'];
let selected = 0;
let sizeId = 'square';
let history = [];
let future = [];

function snapshot() { return JSON.stringify(state); }
function pushHistory() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
  updateUndoButtons();
}
function restore(json) {
  const next = JSON.parse(json);
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, next);
  syncControls();
  redraw();
}
function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restore(history.pop());
  updateUndoButtons();
}
function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restore(future.pop());
  updateUndoButtons();
}
function updateUndoButtons() {
  $('undo').disabled = !history.length;
  $('redo').disabled = !future.length;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadSamples() {
  photos = [
    await loadImage('samples/pier.jpg'),
    await loadImage('samples/boulevard.jpg'),
  ];
  renderPhotoList();
}

function currentSize() {
  return SIZES.find((s) => s.id === sizeId) || SIZES[0];
}

function redraw() {
  ensurePanels(state);
  const size = currentSize();
  const scale = Math.min(1, 560 / size.w);
  canvas.width = Math.round(size.w * scale);
  canvas.height = Math.round(size.h * scale);
  // draw at preview resolution, then the title block stays crisp enough
  drawCover(canvas, state, photos);
  preview.textContent = `${size.label} ${size.w} x ${size.h} — preview`;
  renderPanelButtons();
}

function renderPhotoList() {
  const sel = $('photoPick');
  sel.innerHTML = '';
  photoNames.forEach((name, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = name;
    sel.appendChild(o);
  });
  sel.value = String(state.panels[selected]?.photo ?? 0);
}

function renderPanelButtons() {
  const wrap = $('panels');
  wrap.innerHTML = '';
  const n = panelCount(state.layout);
  for (let i = 0; i < n; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'panel-chip' + (i === selected ? ' on' : '');
    b.textContent = `Panel ${i + 1} · ${photoNames[state.panels[i]?.photo] ?? '—'}`;
    b.addEventListener('click', () => { selected = i; syncControls(); redraw(); });
    wrap.appendChild(b);
  }
}

function syncControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('badge').value = state.badge;
  $('titleStyle').value = state.titleStyle;
  $('grain').checked = state.grain;
  $('vignette').checked = state.vignette;
  $('frame').checked = state.frame;
  $('stars').value = String(state.stars);
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', b.dataset.size === sizeId));
  const p = state.panels[selected] || { photo: 0, zoom: 1, x: 0, y: 0 };
  $('zoom').value = String(p.zoom);
  $('panX').value = String(p.x);
  $('panY').value = String(p.y);
  $('zoomVal').textContent = `${Math.round(p.zoom * 100)}%`;
  $('panXVal').textContent = `${Math.round(p.x * 100)}`;
  $('panYVal').textContent = `${Math.round(p.y * 100)}`;
  renderPhotoList();
}

function setStatus(text) { statusEl.textContent = text; }

// ---- controls ----
function buildPickers() {
  const layouts = $('layouts');
  Object.entries(LAYOUTS).forEach(([id, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.layout = id;
    b.innerHTML = `<strong>${def.label}</strong><span>${def.hint}</span>`;
    b.addEventListener('click', () => {
      pushHistory();
      state.layout = id;
      ensurePanels(state);
      selected = 0;
      syncControls();
      redraw();
    });
    layouts.appendChild(b);
  });
  const grades = $('grades');
  Object.entries(GRADES).forEach(([id, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick grade';
    b.dataset.grade = id;
    const sw = def.stops
      ? `linear-gradient(90deg, ${def.stops.map(([t, c]) => `${c} ${Math.round(t * 100)}%`).join(', ')})`
      : 'linear-gradient(90deg,#888,#fff)';
    b.innerHTML = `<span class="swatch" style="background:${sw}"></span><strong>${def.label}</strong>`;
    b.addEventListener('click', () => {
      pushHistory();
      state.grade = id;
      syncControls();
      redraw();
    });
    grades.appendChild(b);
  });
  const sizes = $('sizes');
  SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.size = s.id;
    b.innerHTML = `<strong>${s.label}</strong><span>${s.w} x ${s.h}</span>`;
    b.addEventListener('click', () => {
      sizeId = s.id;
      syncControls();
      redraw();
    });
    sizes.appendChild(b);
  });
}

$('upload').addEventListener('change', async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  for (const f of files) {
    const img = await loadImage(URL.createObjectURL(f));
    photos.push(img);
    photoNames.push(f.name.replace(/\.[^.]+$/, '').slice(0, 24));
  }
  setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} loaded — kept on this machine only.`);
  renderPhotoList();
  redraw();
  e.target.value = '';
});

$('photoPick').addEventListener('change', (e) => {
  pushHistory();
  state.panels[selected].photo = Number(e.target.value);
  redraw();
});

function bindPanelSlider(id, key, parse) {
  let armed = false;
  $(id).addEventListener('pointerdown', () => { if (!armed) { pushHistory(); armed = true; } });
  $(id).addEventListener('focus', () => { if (!armed) { pushHistory(); armed = true; } });
  $(id).addEventListener('input', (e) => {
    state.panels[selected][key] = parse(e.target.value);
    syncControls();
    redraw();
  });
  $(id).addEventListener('change', () => { armed = false; });
}
bindPanelSlider('zoom', 'zoom', Number);
bindPanelSlider('panX', 'x', Number);
bindPanelSlider('panY', 'y', Number);

[['title', 'title'], ['subtitle', 'subtitle'], ['badge', 'badge']].forEach(([id, key]) => {
  $(id).addEventListener('focus', () => pushHistory());
  $(id).addEventListener('input', (e) => { state[key] = e.target.value; redraw(); });
});
$('titleStyle').addEventListener('change', (e) => { pushHistory(); state.titleStyle = e.target.value; redraw(); });
$('grain').addEventListener('change', (e) => { pushHistory(); state.grain = e.target.checked; redraw(); });
$('vignette').addEventListener('change', (e) => { pushHistory(); state.vignette = e.target.checked; redraw(); });
$('frame').addEventListener('change', (e) => { pushHistory(); state.frame = e.target.checked; redraw(); });
$('stars').addEventListener('change', (e) => { pushHistory(); state.stars = Number(e.target.value); redraw(); });
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);

$('samplePier').addEventListener('click', () => {
  pushHistory();
  state.panels[selected].photo = 0;
  syncControls(); redraw();
});
$('sampleBoulevard').addEventListener('click', () => {
  pushHistory();
  state.panels[selected].photo = 1;
  syncControls(); redraw();
});

// drag on the preview to pan the selected panel; click to select a panel
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = hitPanel(state, canvas.width, canvas.height, p.x, p.y);
  if (hit >= 0) {
    selected = hit;
    syncControls();
    redraw();
    drag = { startX: p.x, startY: p.y, px: state.panels[hit].x, py: state.panels[hit].y, moved: false };
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const dx = (p.x - drag.startX) / canvas.width;
  const dy = (p.y - drag.startY) / canvas.height;
  if (Math.abs(dx) + Math.abs(dy) > 0.005) drag.moved = true;
  state.panels[selected].x = drag.px + dx;
  state.panels[selected].y = drag.py + dy;
  syncControls();
  redraw();
});
canvas.addEventListener('pointerup', () => {
  if (drag?.moved) pushHistory();
  drag = null;
});

// ---- export: all three post sizes at once, from offscreen canvases ----
function exportOne(size) {
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state, photos);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neon-coast-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      resolve();
    }, 'image/png');
  });
}

$('exportAll').addEventListener('click', async () => {
  setStatus('Exporting 3 sizes…');
  for (const size of SIZES) await exportOne(size);
  setStatus('Saved neon-coast-1080x1080.png, neon-coast-1080x1350.png and neon-coast-1920x1080.png');
});
$('exportOne').addEventListener('click', async () => {
  const size = currentSize();
  await exportOne(size);
  setStatus(`Saved neon-coast-${size.w}x${size.h}.png`);
});

// ---- boot ----
buildPickers();
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  await loadSamples();
  await document.fonts.ready;
  await runShot(shot, new URLSearchParams(location.search), state, photos, redraw);
  syncControls();
} else {
  await loadSamples();
  await document.fonts.ready;
  syncControls();
  redraw();
  updateUndoButtons();
}

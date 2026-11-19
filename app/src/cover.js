// Neon Coast — the cover engine: draws a GTA-poster-style multi-panel cover
// onto any canvas, from a state object and a list of loaded photos.
// Everything is local: no network, no library, just the 2D canvas API.
// Lettering is Anton (titles) and Pacifico (neon script subtitle), both
// vendored under the SIL Open Font License in app/fonts/.

export const LAYOUTS = {
  grid4: { label: 'Grid 4', hint: 'Four equal panels' },
  hero3: { label: 'Hero + 3', hint: 'One big hero, three small' },
  fullbleed: { label: 'Full Bleed', hint: 'One photo, edge to edge' },
  nine: { label: 'Nine Grid', hint: '3 x 3 with a title block' },
  tilted: { label: 'Tilted', hint: 'Snapshots at a slant' },
  duo: { label: 'Duo Strip', hint: 'Two tall panels' },
};

export const GRADES = {
  sunset: { label: 'Sunset', stops: [[0, '#2b0a3d'], [0.5, '#ff5e3a'], [1, '#ffd166']] },
  neon: { label: 'Neon', stops: [[0, '#0a0a2e'], [0.5, '#ff2e88'], [1, '#7df9ff']] },
  golden: { label: 'Golden Hour', stops: [[0, '#1f1200'], [0.5, '#ff9f1c'], [1, '#fff3b0']] },
  vice: { label: 'Vice', stops: [[0, '#12002e'], [0.5, '#b537f2'], [1, '#00e5ff']] },
  noir: { label: 'Noir', stops: [[0, '#000000'], [0.5, '#7a7a7a'], [1, '#ffffff']] },
  original: { label: 'Original', stops: null },
};

export const SIZES = [
  { id: 'square', label: 'Square', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide', w: 1920, h: 1080 },
];

export function defaultState() {
  return {
    layout: 'grid4',
    grade: 'sunset',
    title: 'NEON SHORE',
    subtitle: 'Sunset Heist',
    badge: 'VICE CITY',
    titleStyle: 'gradient',
    grain: true,
    vignette: true,
    frame: true,
    stars: 5,
    panels: [
      { photo: 0, zoom: 1.15, x: 0, y: 0 },
      { photo: 1, zoom: 1.15, x: 0, y: 0 },
      { photo: 1, zoom: 1.3, x: 0.08, y: -0.05 },
      { photo: 0, zoom: 1.3, x: -0.08, y: 0.05 },
    ],
  };
}

export function panelCount(layout) {
  return { grid4: 4, hero3: 4, fullbleed: 1, nine: 8, tilted: 4, duo: 2 }[layout] ?? 4;
}

export function ensurePanels(state) {
  const n = panelCount(state.layout);
  while (state.panels.length < n) {
    const i = state.panels.length;
    state.panels.push({ photo: i % 2, zoom: 1.2, x: 0, y: 0 });
  }
  state.panels.length = n;
  return state;
}

// Panel rectangles as fractions of the cover, leaving room for the title
// block at the foot (except full-bleed, where the title floats on the photo).
function layoutRects(layout, w, h) {
  const titleH = layout === 'fullbleed' || layout === 'nine' ? 0 : h * 0.2;
  const top = h - titleH;
  const g = Math.max(4, Math.round(w * 0.012)); // white gutter
  const R = (x, y, rw, rh) => ({ x: x * w, y: y * h, w: rw * w, h: rh * h });
  switch (layout) {
    case 'hero3': {
      const half = top / 2;
      return [
        R(0, 0, 0.62, top / h),
        R(0.62 + g / w, 0, 1 - 0.62 - g / w, half / h),
        R(0.62 + g / w, (half + g) / h, (1 - 0.62) / 2 - g / w, (half - g) / h),
        R(0.62 + (1 - 0.62) / 2 + g / w, (half + g) / h, (1 - 0.62) / 2 - g / w, (half - g) / h),
      ];
    }
    case 'fullbleed':
      return [R(0, 0, 1, 1)];
    case 'nine': {
      const cells = [];
      const cw = 1 / 3, ch = top / h / 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (r === 1 && c === 1) continue; // centre cell is the title block
          cells.push(R(c * cw + (c ? g / w : 0), r * ch + (r ? g / h : 0), cw - (c ? g / w : 0), ch - (r ? g / h : 0)));
        }
      }
      return cells;
    }
    case 'tilted': {
      const hw = 0.5, hh = top / h / 2;
      return [
        R(0.01, 0.01, hw - 0.02, hh - 0.01),
        R(0.51, 0.0, hw - 0.02, hh - 0.01),
        R(0.0, hh + 0.01, hw - 0.02, hh - 0.01),
        R(0.51, hh + 0.02, hw - 0.02, hh - 0.01),
      ];
    }
    case 'duo':
      return [R(0, 0, 0.5 - g / w / 2, top / h), R(0.5 + g / w / 2, 0, 0.5 - g / w / 2, top / h)];
    case 'grid4':
    default: {
      const hw = 0.5, hh = top / h / 2;
      return [
        R(0, 0, hw - g / w / 2, hh - g / h / 2),
        R(hw + g / w / 2, 0, hw - g / w / 2, hh - g / h / 2),
        R(0, hh + g / h / 2, hw - g / w / 2, hh - g / h / 2),
        R(hw + g / w / 2, hh + g / h / 2, hw - g / w / 2, hh - g / h / 2),
      ];
    }
  }
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mapStops(stops, t) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0 || 1);
      const a = hexRgb(c0), b = hexRgb(c1);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
  }
  return hexRgb(stops[stops.length - 1][1]);
}

// Gradient-map grade: luminance through the grade's colour ramp, blended
// back with the original so skin and texture survive. Built once per grade
// as a 256-entry lookup table, then applied to a panel's pixels.
const lutCache = new Map();
function gradeLut(gradeId) {
  if (lutCache.has(gradeId)) return lutCache.get(gradeId);
  const grade = GRADES[gradeId];
  const lut = new Uint8Array(256 * 3);
  if (!grade || !grade.stops) {
    for (let i = 0; i < 256; i++) { lut[i * 3] = i; lut[i * 3 + 1] = i; lut[i * 3 + 2] = i; }
  } else {
    for (let i = 0; i < 256; i++) {
      const c = mapStops(grade.stops, i / 255);
      lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2];
    }
  }
  lutCache.set(gradeId, lut);
  return lut;
}

const temp = document.createElement('canvas');
function drawPhotoPanel(ctx, photo, panel, rect, gradeId) {
  const { x, y, w, h } = rect;
  if (w < 2 || h < 2) return;
  temp.width = Math.max(2, Math.round(w));
  temp.height = Math.max(2, Math.round(h));
  const tctx = temp.getContext('2d');
  tctx.fillStyle = '#221028';
  tctx.fillRect(0, 0, temp.width, temp.height);
  if (photo) {
    const scale = Math.max(temp.width / photo.naturalWidth, temp.height / photo.naturalHeight) * (panel.zoom || 1);
    const pw = photo.naturalWidth * scale;
    const ph = photo.naturalHeight * scale;
    const px = (temp.width - pw) / 2 + (panel.x || 0) * temp.width;
    const py = (temp.height - ph) / 2 + (panel.y || 0) * temp.height;
    tctx.drawImage(photo, px, py, pw, ph);
  }
  if (gradeId !== 'original') {
    const lut = gradeLut(gradeId);
    const img = tctx.getImageData(0, 0, temp.width, temp.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      const o = lum * 3;
      d[i] = d[i] * 0.28 + lut[o] * 0.72;
      d[i + 1] = d[i + 1] * 0.28 + lut[o + 1] * 0.72;
      d[i + 2] = d[i + 2] * 0.28 + lut[o + 2] * 0.72;
    }
    tctx.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(temp, x, y, w, h);
  // panel ink: thin dark inner edge + a warm top light, poster-art feel
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.strokeRect(x, y, w, h);
  const sheen = ctx.createLinearGradient(x, y, x, y + h * 0.4);
  sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h * 0.4);
  ctx.restore();
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawGrain(ctx, w, h, seed = 20261119) {
  const rnd = seededRandom(seed);
  const n = Math.floor((w * h) / 900);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const v = rnd();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
  }
  ctx.restore();
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,0,20,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function fitFont(ctx, text, fontFamily, weight, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${fontFamily}`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${fontFamily}`;
  }
  return size;
}

// Compact title block for the nine-grid centre cell: title word-wrapped and
// centred, subtitle, stars and badge stacked below it.
function drawTitleBlockCompact(ctx, state, rect) {
  const { x, y, w: bw, h: bh } = rect;
  ctx.fillStyle = '#160a24';
  ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = 'rgba(255,94,58,0.28)';
  const step = Math.max(10, bh * 0.14);
  for (let dx = step / 2; dx < bw; dx += step) {
    for (let dy = step / 2; dy < bh; dy += step) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, Math.max(1.2, bh * 0.018), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const title = (state.title || 'UNTITLED').toUpperCase();
  const pad = bw * 0.08;
  // greedy word wrap at the largest size that still fits in 3 lines
  let size = Math.round(bh * 0.2);
  let lines = [];
  for (; size > 10; size -= 2) {
    ctx.font = `${size}px Anton, sans-serif`;
    lines = [''];
    for (const word of title.split(' ')) {
      const trial = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
      if (ctx.measureText(trial).width <= bw - pad * 2) lines[lines.length - 1] = trial;
      else lines.push(word);
    }
    if (lines.length <= 3 && lines.length * size * 1.05 <= bh * 0.5) break;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grad = ctx.createLinearGradient(x, y + bh * 0.1, x, y + bh * 0.55);
  grad.addColorStop(0, '#fff3b0');
  grad.addColorStop(0.5, '#ff9f1c');
  grad.addColorStop(1, '#ff2e88');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.1;
  const lineH = size * 1.05;
  const startY = y + bh * 0.14 + lineH / 2;
  lines.forEach((line, i) => ctx.fillText(line, x + bw / 2, startY + i * lineH));
  ctx.shadowBlur = 0;
  let cy = y + bh * 0.14 + lines.length * lineH + bh * 0.05;
  if (state.subtitle) {
    const subSize = Math.round(bh * 0.09);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ff7ad9';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = subSize * 0.5;
    ctx.fillText(state.subtitle, x + bw / 2, cy);
    ctx.shadowBlur = 0;
    cy += bh * 0.12;
  }
  ctx.font = `${Math.round(bh * 0.09)}px sans-serif`;
  ctx.fillStyle = '#ffd166';
  ctx.fillText('★'.repeat(state.stars || 0) + '☆'.repeat(Math.max(0, 5 - (state.stars || 0))), x + bw / 2, cy);
  cy += bh * 0.12;
  if (state.badge) {
    const bSize = Math.round(bh * 0.07);
    ctx.font = `bold ${bSize}px sans-serif`;
    const bText = state.badge.toUpperCase();
    const bW = ctx.measureText(bText).width + bSize * 1.6;
    ctx.fillStyle = '#ff2e88';
    ctx.fillRect(x + (bw - bW) / 2, cy, bW, bSize * 1.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(bText, x + bw / 2, cy + bSize * 0.8);
  }
  ctx.textAlign = 'left';
}

function drawTitleBlock(ctx, state, w, h, rect) {
  const { x, y, w: bw, h: bh } = rect;
  // halftone dots on a deep plum band
  ctx.fillStyle = '#160a24';
  ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = 'rgba(255,94,58,0.28)';
  const step = Math.max(10, bh * 0.16);
  for (let dx = step / 2; dx < bw; dx += step) {
    for (let dy = step / 2; dy < bh; dy += step) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, Math.max(1.2, bh * 0.02), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const title = (state.title || 'UNTITLED').toUpperCase();
  const pad = bw * 0.045;
  const titleSize = fitFont(ctx, title, 'Anton, sans-serif', '', bw - pad * 2, bh * 0.52);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const ty = y + bh * 0.44;
  if (state.titleStyle === 'gradient') {
    const grad = ctx.createLinearGradient(x + pad, ty - titleSize / 2, x + pad, ty + titleSize / 2);
    grad.addColorStop(0, '#fff3b0');
    grad.addColorStop(0.45, '#ff9f1c');
    grad.addColorStop(0.75, '#ff5e3a');
    grad.addColorStop(1, '#ff2e88');
    ctx.fillStyle = grad;
  } else if (state.titleStyle === 'outline') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = Math.max(2, titleSize * 0.06);
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = titleSize * 0.12;
  ctx.shadowOffsetY = titleSize * 0.03;
  ctx.fillText(title, x + pad, ty);
  if (state.titleStyle === 'outline') ctx.strokeText(title, x + pad, ty);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // neon script subtitle
  if (state.subtitle) {
    const subSize = fitFont(ctx, state.subtitle, 'Pacifico, cursive', '', bw * 0.5, bh * 0.2);
    ctx.fillStyle = '#ff7ad9';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = subSize * 0.5;
    ctx.fillText(state.subtitle, x + pad, y + bh * 0.82);
    ctx.shadowBlur = 0;
  }
  // stars + badge ribbon, right side
  const starText = '★'.repeat(state.stars || 0) + '☆'.repeat(Math.max(0, 5 - (state.stars || 0)));
  ctx.font = `${Math.round(bh * 0.2)}px sans-serif`;
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'right';
  ctx.fillText(starText, x + bw - pad, y + bh * 0.3);
  if (state.badge) {
    const bSize = Math.round(bh * 0.16);
    ctx.font = `bold ${bSize}px sans-serif`;
    const bText = ` ${state.badge.toUpperCase()} `;
    const bW = ctx.measureText(bText).width + bSize;
    const bX = x + bw - pad - bW;
    const bY = y + bh * 0.58;
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath();
    ctx.moveTo(bX, bY);
    ctx.lineTo(bX + bW, bY);
    ctx.lineTo(bX + bW - bSize * 0.5, bY + bSize * 1.5);
    ctx.lineTo(bX, bY + bSize * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(bText.trim(), bX + bW / 2, bY + bSize * 0.78);
    ctx.textAlign = 'left';
  }
}

/** Draws the whole cover onto `canvas` (its own width/height), from `state`
 *  and `photos` (array of loaded images; a panel's `photo` is its index). */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const s = ensurePanels(structuredClone(state));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const rects = layoutRects(s.layout, w, h);
  const tilted = s.layout === 'tilted';
  rects.forEach((rect, i) => {
    const panel = s.panels[i] || { photo: 0, zoom: 1, x: 0, y: 0 };
    const photo = photos[panel.photo] || photos[0] || null;
    if (tilted) {
      ctx.save();
      const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((i % 2 === 0 ? -1.6 : 1.6) * Math.PI / 180);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = '#ffffff';
      const b = Math.max(4, w * 0.01);
      ctx.fillRect(rect.x - b, rect.y - b, rect.w + b * 2, rect.h + b * 2);
      drawPhotoPanel(ctx, photo, panel, rect, s.grade);
      ctx.restore();
    } else {
      drawPhotoPanel(ctx, photo, panel, rect, s.grade);
    }
  });
  // title block
  const titleH = s.layout === 'fullbleed' ? h * 0.24 : h * 0.2;
  const tb = s.layout === 'fullbleed'
    ? { x: 0, y: h - titleH, w, h: titleH }
    : { x: 0, y: h - titleH, w, h: titleH };
  if (s.layout === 'nine') {
    // centre cell is the title block — compact, stacked, centred
    const cw = w / 3, ch = h / 3;
    drawTitleBlockCompact(ctx, s, { x: cw, y: ch, w: cw, h: ch });
  } else if (s.layout === 'fullbleed') {
    ctx.save();
    const g = ctx.createLinearGradient(0, h - titleH - h * 0.08, 0, h);
    g.addColorStop(0, 'rgba(22,10,36,0)');
    g.addColorStop(1, 'rgba(22,10,36,0.88)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h - titleH - h * 0.08, w, titleH + h * 0.08);
    ctx.restore();
    drawTitleBlock(ctx, s, w, h, tb);
  } else {
    drawTitleBlock(ctx, s, w, h, tb);
  }
  if (s.grain) drawGrain(ctx, w, h);
  if (s.vignette) drawVignette(ctx, w, h);
  if (s.frame) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, w * 0.008);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  }
}

/** Which panel (index) sits at preview coordinates (px, py) on a canvas of
 *  size w x h, or -1. Used for click-to-select and drag-to-pan. */
export function hitPanel(state, w, h, px, py) {
  const rects = layoutRects(state.layout, w, h);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

export { layoutRects };

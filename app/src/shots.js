// Fixed scenes for screenshots: ?shot=cover shows the cover alone at the
// export size; ?shot=editor shows the studio with a photo loaded.
// Query params: photo (pier|boulevard), caption (title), sub (subtitle),
// layout, grade, size (square|portrait|wide). window.__shotReady is set
// once the cover is painted, after fonts are ready.
import { drawCover, SIZES } from './cover.js';

export async function runShot(shot, query, state, photos, redraw) {
  const layout = query.get('layout');
  if (layout) state.layout = layout;
  const grade = query.get('grade');
  if (grade) state.grade = grade;
  const caption = query.get('caption');
  if (caption) state.title = caption;
  const sub = query.get('sub');
  if (sub) state.subtitle = sub;
  // The default panel mix (pier / boulevard alternating) already shows off
  // multi-photo covers, so the query photo only chooses the hero panel.
  const photo = query.get('photo');
  if (photo === 'boulevard') state.panels[0].photo = 1;
  if (photo === 'pier') state.panels[0].photo = 0;
  const size = SIZES.find((s) => s.id === (query.get('size') || 'square')) || SIZES[0];
  if (shot === 'cover' || shot === 'cover2' || shot === 'cover3') {
    document.body.classList.add('shot-cover');
    const canvas = document.getElementById('cover');
    canvas.width = size.w;
    canvas.height = size.h;
    drawCover(canvas, state, photos);
    document.getElementById('previewSize').textContent = '';
  } else {
    redraw();
  }
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
}

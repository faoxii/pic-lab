// Oscilloscope virtuel 2 voies : affichage, déclenchement et mesures (comme un oscillo de TP)
import { engine } from './state.js';

export const fmtT = s => s == null || !isFinite(s) ? '—' : s >= 1 ? s.toFixed(3) + ' s' : s >= 1e-3 ? (s * 1e3).toPrecision(4) + ' ms' : (s * 1e6).toPrecision(4) + ' µs';
export const fmtF = f => f == null || !isFinite(f) ? '—' : f >= 1e3 ? (f / 1e3).toPrecision(4) + ' kHz' : f.toPrecision(4) + ' Hz';
export const fmtV = v => v == null || !isFinite(v) ? '—' : v.toFixed(2) + ' V';

export const defaultScope = () => ({ tdiv: 5e-3, vdiv: { ch1: 2, ch2: 2 }, pos: { ch1: 1, ch2: -3 }, trigSrc: 'ch1', trigEdge: 'up', run: true, frozen: null });
export const scopeStats = { ch1: null, ch2: null };
const LEVEL = 2.5; // niveau de déclenchement / seuil des mesures temporelles (V)

function source(ch, pic) {
  const B = engine.bench;
  if (B.scopeSrc[ch] === 'dac') return { kind: 'hist', h: B.dac.hist };
  const p = B.pin('bnc', ch);
  if (p === null) return null;
  if (p === 18 && pic.pwmActive() && !(pic.tris[2] >> 2 & 1)) return { kind: 'pwm' };
  if (pic.pinOut(p) !== null) return { kind: 'hist', h: B.hist[ch] };
  if ((B.byPin[p] || []).some(([m]) => m === 'gbf')) return { kind: 'gbf' };
  return { kind: 'static' };
}
// liste des fronts (dir = 1 montant, -1 descendant) avant tEnd, du plus récent au plus ancien
function edgesBefore(src, tEnd, pic, max = 6) {
  const B = engine.bench, out = [];
  if (!src) return out;
  if (src.kind === 'hist') {
    const h = src.h;
    for (let i = h.length - 1; i > 0 && out.length < max; i--) {
      if (h[i][0] > tEnd) continue;
      const a = h[i - 1][1] >= LEVEL, b = h[i][1] >= LEVEL;
      if (a !== b) out.push([h[i][0], b ? 1 : -1]);
    }
    return out;
  }
  let per, e0, e1;
  if (src.kind === 'gbf') { per = pic.fcy / B.gbf.f; const e = B.gbfEdges(); e0 = e[0]; e1 = e[1]; }
  else if (src.kind === 'pwm') { const w = pic.pwm(); if (!(w.Th > 0 && w.Th < w.T)) return out; per = w.T; e0 = 0; e1 = w.Th / w.T; }
  else return out;
  let k = Math.floor(tEnd / per);
  while (out.length < max && k >= 0) {
    const tf = (k + e1) * per, tr = (k + e0) * per;
    if (tf <= tEnd) out.push([tf, -1]);
    if (tr <= tEnd && out.length < max) out.push([tr, 1]);
    k--;
  }
  return out;
}
function timeMeasures(src, tEnd, pic) {
  const e = edgesBefore(src, tEnd, pic, 8);
  const r = e.filter(x => x[1] === 1).map(x => x[0]), f = e.filter(x => x[1] === -1).map(x => x[0]);
  if (r.length < 2) return null;
  const T = (r[0] - r[1]) / pic.fcy;
  if ((tEnd - r[0]) / pic.fcy > 3 * T + 0.05 && src.kind === 'hist') return null; // signal arrêté
  const fall = f.find(t => t > r[1] && t < r[0]);
  const Th = fall !== undefined ? (fall - r[1]) / pic.fcy : null;
  return { f: 1 / T, T, Th, Tl: Th != null ? T - Th : null, duty: Th != null ? Th / T * 100 : null };
}

export function drawScope(cv, S, compact) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.fillStyle = '#0b1d16'; g.fillRect(0, 0, W, H);
  const dx = W / 10, dy = H / 8;
  g.strokeStyle = 'rgba(120,220,180,.16)'; g.lineWidth = 1;
  for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(i * dx, 0); g.lineTo(i * dx, H); g.stroke(); }
  for (let j = 1; j < 8; j++) { g.beginPath(); g.moveTo(0, j * dy); g.lineTo(W, j * dy); g.stroke(); }
  g.strokeStyle = 'rgba(120,220,180,.35)'; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  const fs = Math.round(H / 18);
  g.font = `600 ${fs}px "JetBrains Mono", monospace`;
  const sim = engine.sim, B = engine.bench;
  const cols = { ch1: '#f2d230', ch2: '#3fd6e8' };
  if (!sim) { g.fillStyle = '#6fa892'; g.fillText('Pas de signal — lance un programme', 12, H / 2 - 10); scopeStats.ch1 = scopeStats.ch2 = null; return; }
  const pic = sim.pic, span = S.tdiv * 10 * pic.fcy, now = pic.S.C;
  // déclenchement
  let t0, trig = false;
  if (!S.run && S.frozen != null) t0 = S.frozen;
  else {
    const src = source(S.trigSrc, pic);
    const want = S.trigEdge === 'up' ? 1 : -1;
    const e = edgesBefore(src, now - span * 0.9, pic, 12).find(x => x[1] === want);
    if (e) { t0 = e[0] - span * 0.1; trig = true; } else t0 = now - span;
    S.lastT0 = t0;
  }
  const tEnd = Math.min(now, t0 + span);
  for (const ch of ['ch1', 'ch2']) {
    const src = source(ch, pic);
    if (!src) { scopeStats[ch] = null; continue; }
    const base = H / 2 - S.pos[ch] * dy, vd = S.vdiv[ch];
    g.strokeStyle = cols[ch]; g.lineWidth = compact ? 2.5 : 2; g.beginPath();
    let vmax = -Infinity, vmin = Infinity, sum = 0, n = 0;
    for (let x = 0; x <= W; x += 1) {
      const t = t0 + x / W * span; if (t > now) break;
      const v = B.scopeV(ch, t, pic) ?? 0;
      vmax = Math.max(vmax, v); vmin = Math.min(vmin, v); sum += v; n++;
      const y = base - v / vd * dy;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    // repère du 0 V
    g.fillStyle = cols[ch]; g.beginPath(); g.moveTo(0, base - 5); g.lineTo(8, base); g.lineTo(0, base + 5); g.fill();
    g.fillText(ch.toUpperCase(), 12, base - 6);
    const tm = timeMeasures(src, tEnd, pic);
    scopeStats[ch] = { ...(tm || {}), vmax: n ? vmax : null, vmin: n ? vmin : null, vpp: n ? vmax - vmin : null, vmoy: n ? sum / n : null };
  }
  if (trig || !S.run) { g.fillStyle = '#ff8a3c'; g.beginPath(); g.moveTo(W * 0.1, 0); g.lineTo(W * 0.1 - 6, 9); g.lineTo(W * 0.1 + 6, 9); g.fill(); }
  g.fillStyle = '#9fd8c2';
  const st = !S.run ? 'STOP' : trig ? `déclenché ${S.trigSrc.toUpperCase()} ${S.trigEdge === 'up' ? '↑' : '↓'}` : 'auto';
  g.fillText(`${fmtT(S.tdiv)}/div · CH1 ${S.vdiv.ch1} V/div · CH2 ${S.vdiv.ch2} V/div · ${st}`, 8, H - 8);
  let y = fs + 4;
  for (const ch of ['ch1', 'ch2']) { const m = scopeStats[ch]; if (!m || !m.f) continue; g.fillStyle = cols[ch]; const txt = `${ch.toUpperCase()}  f = ${fmtF(m.f)}  T = ${fmtT(m.T)}  T/2 = ${fmtT(m.T / 2)}`; g.fillText(txt, W - g.measureText(txt).width - 8, y); y += fs + 4; }
}

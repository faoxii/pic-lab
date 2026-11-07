// Textures dessinées sur canvas : sérigraphie des cartes, écran LCD
import * as THREE from 'three';
import { P, PIC, PIC_PORTS, MODS, SIG_LABEL } from './layout.js';
import PICM from './engine/machine.js';
const { PORTS, PMASK } = PICM;

const PX = 48; // pixels par unité
function board(w, d, draw) {
  const c = document.createElement('canvas'); c.width = Math.round(w * PX); c.height = Math.round(d * PX);
  const g = c.getContext('2d');
  // PCB
  g.fillStyle = '#1e5a3a'; g.fillRect(0, 0, c.width, c.height);
  // pistes discrètes
  g.strokeStyle = 'rgba(120,190,140,.16)'; g.lineWidth = 3;
  for (let i = 0; i < 14; i++) { g.beginPath(); const y = (i + 0.5) * c.height / 14; g.moveTo(0, y); g.lineTo(c.width * (0.2 + 0.6 * ((i * 37) % 10) / 10), y); g.lineTo(c.width * (0.25 + 0.6 * ((i * 37) % 10) / 10), y + 18); g.stroke(); }
  const tx = (x, z) => [(x + w / 2) * PX, (z + d / 2) * PX];
  g.fillStyle = '#e9f1e6'; g.strokeStyle = '#e9f1e6'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const text = (s, x, z, size = 0.32, align = 'center', rot = 0) => { const [a, b] = tx(x, z); g.save(); g.translate(a, b); g.rotate(rot); g.font = `600 ${size * PX}px "JetBrains Mono", ui-monospace, Menlo, monospace`; g.textAlign = align; g.fillText(s, 0, 0); g.restore(); };
  const rect = (x, z, ww, dd, lw = 2) => { const [a, b] = tx(x, z); g.lineWidth = lw; g.strokeRect(a, b, ww * PX, dd * PX); };
  draw({ g, text, rect, tx });
  // trous de fixation
  for (const [x, z] of [[0.6, 0.6], [w - 0.6, 0.6], [0.6, d - 0.6], [w - 0.6, d - 0.6]]) { g.fillStyle = '#c9b46a'; g.beginPath(); g.arc(x * PX, z * PX, 0.32 * PX, 0, 7); g.fill(); g.fillStyle = '#2a2a1a'; g.beginPath(); g.arc(x * PX, z * PX, 0.18 * PX, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function picTexture() {
  return board(PIC.w, PIC.d, ({ text, rect }) => {
    for (const P_ of PORTS) {
      const h = PIC_PORTS[P_], i = PORTS.indexOf(P_), top = h.z < 0;
      for (let b = 0; b < 8; b++) if (PMASK[i] >> b & 1) text(P_ + b, h.x0 + b * P, h.z + (top ? 0.6 : -0.6), 0.26);
      text('PORT ' + P_, h.conn.x, h.conn.z + (top ? -0.82 : 0.82), 0.3);
    }
    text('Module Processor', -8.4, 0.55, 0.4, 'left'); text('PIC 18F452 ---', -8.4, 1.15, 0.4, 'left');
    text('centrale lille · IG2I', -1.6, 1.45, 0.28, 'center');
    text('GND +9V', 7.6, 2.2, 0.24); text('ON  OFF', 5.6, -1.3, 0.22); text('PICKIT', 7.6, -3.9, 0.26);
    rect(-8.7, 4.9, 1.3, 0.9); text('N°', -8.05, 5.35, 0.3);
  });
}
export function modTexture(m) {
  const M = MODS[m];
  return board(M.w, M.d, ({ text, rect }) => {
    for (const [s, [x, z]] of Object.entries(M.pins)) text(SIG_LABEL(s), x, z + 0.62, 0.27);
    for (const r of Object.values(M.ribbons)) text(r.label, r.x, r.z - 0.65, 0.24);
    text(M.title, -M.w / 2 + 0.9, M.d / 2 - 0.7, 0.38, 'left');
    if (m === 'seg7') text('2N2905 ×4', 4.3, -1.5, 0.22);
    text('centrale lille · IG2I', M.w / 2 - 1.0, M.d / 2 - 0.7, 0.22, 'right');
  });
}

// ---------- LCD ----------
const F = '0000000000 00005F0000 0007000700 147F147F14 242A7F2A12 2313086462 3649552250 0005030000 001C224100 0041221C00 14083E0814 08083E0808 0050300000 0808080808 0060600000 2010080402 3E5149453E 00427F4000 4261514946 2141454B31 1814127F10 2745454539 3C4A494930 0171090503 3649494936 064949291E 0036360000 0056360000 0814224100 1414141414 0041221408 0201510906 324979413E 7E1111117E 7F49494936 3E41414122 7F4141221C 7F49494941 7F09090901 3E4149497A 7F0808087F 00417F4100 2040413F01 7F08142241 7F40404040 7F020C027F 7F0408107F 3E4141413E 7F09090906 3E4151215E 7F09192946 4649494931 01017F0101 3F4040403F 1F2040201F 3F4038403F 6314081463 0708700807 6151494543 007F414100 15167C1615 0041417F00 0402010204 4040404040 0001020400 2054545478 7F48444438 3844444420 384444487F 3854545418 087E090102 0C5252523E 7F08040478 00447D4000 2040443D00 7F10284400 00417F4000 7C04180478 7C08040478 3844444438 7C14141408 081414187C 7C08040408 4854545420 043F444020 3C4040207C 1C2040201C 3C4030403C 4428102844 0C5050503C 4464544C44 0008364100 00007F0000 0041360800 08082A1C08 081C2A0808'.split(' ');
const FONT = {}; F.forEach((s, i) => FONT[0x20 + i] = [0, 1, 2, 3, 4].map(k => parseInt(s.substr(k * 2, 2), 16)));
FONT[0xDF] = [0, 7, 5, 7, 0]; FONT[0xFF] = [0x7F, 0x7F, 0x7F, 0x7F, 0x7F]; FONT[0xE4] = [0x7C, 0x20, 0x20, 0x1C, 0x20];

export function makeLcd() {
  const c = document.createElement('canvas'); c.width = 16 * 24 + 16; c.height = 2 * 38 + 16;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.anisotropy = 8;
  let key = null;
  function draw(L, alive) {
    const blink = (Math.floor(performance.now() / 530) & 1);
    const k = alive ? L.dd.join(',') + L.cg.join(',') + [L.on, L.cur, L.blink && blink, L.ac, L.shift, L.lines2, L.tgt].join('|') : 'off';
    if (k === key) return false; key = k;
    const g = c.getContext('2d'); g.fillStyle = '#9fbf3b'; g.fillRect(0, 0, c.width, c.height);
    const D = 4, ox = 8, oy = 10;
    for (let r = 0; r < 2; r++) for (let col = 0; col < 16; col++) {
      const code = alive ? L.charAt(r, col) : -1; const x0 = ox + col * 24, y0 = oy + r * 38;
      let cols = null, rows = null;
      if (code >= 0 && L.on) { if (code < 16) { rows = []; for (let y = 0; y < 8; y++) rows.push(L.cg[(code & 7) * 8 + y]); } else cols = FONT[code] || [0, 0, 0, 0, 0]; }
      const span = L.lines2 ? 40 : 80;
      const visAddr = (r ? 0x40 : 0) + (((col + L.shift) % span) + span) % span;
      const isCur = alive && L.on && L.tgt === 'dd' && L.ac === visAddr && code >= 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 5; x++) {
        let on = rows ? !!(rows[y] >> (4 - x) & 1) : cols ? !!(cols[x] >> y & 1) : false;
        if (isCur && L.cur && y === 7) on = true; if (isCur && L.blink && blink) on = true;
        g.fillStyle = on ? '#16200a' : 'rgba(30,50,0,.10)'; g.fillRect(x0 + x * D, y0 + y * D, D - 0.7, D - 0.7);
      }
    }
    t.needsUpdate = true; return true;
  }
  return { texture: t, draw };
}

export function labelTexture(txt, { bg = '#f4efe3', fg = '#1e1e1e', size = 30 } = {}) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  g.font = `700 ${size}px "Space Grotesk", system-ui, sans-serif`; const w = g.measureText(txt).width + 24;
  c.width = w; c.height = size + 18; g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.font = `700 ${size}px "Space Grotesk", system-ui, sans-serif`; g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(txt, 12, c.height / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { texture: t, aspect: c.width / c.height };
}

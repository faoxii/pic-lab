// Géométrie du banc : positions des cartes, des broches et des connecteurs (unités ≈ cm)
import PICM from './engine/machine.js';
const { PORTS, PMASK } = PICM;

export const P = 0.6;            // pas des broches (agrandi pour être cliquable)
export const BOARD_Y = 0.45;     // dessus des entretoises
export const BOARD_T = 0.16;     // épaisseur PCB
export const TOP = BOARD_Y + BOARD_T;
export const HDR_H = 0.5;        // hauteur des barrettes femelles
export const PIN_TOP = TOP + HDR_H;

// ---- Carte processeur ----
export const PIC = { w: 18, d: 12.5 };
export const PIC_PORTS = {
  // header : rangée de broches ; conn : connecteur nappe (blanc)
  C: { x0: -6.6, z: -3.2, conn: { x: -4.5, z: -4.85 } },
  E: { x0: -0.9, z: -3.2, conn: { x: -0.3, z: -4.85 } },
  A: { x0: 1.6, z: -3.2, conn: { x: 3.1, z: -4.85 } },
  D: { x0: -6.6, z: 3.2, conn: { x: -4.5, z: 4.85 } },
  B: { x0: 0.6, z: 3.2, conn: { x: 2.7, z: 4.85 } },
};
export const picPinLocal = p => { const P_ = PORTS[p >> 3], b = p & 7; const h = PIC_PORTS[P_]; return [h.x0 + b * P, h.z]; };
export const picConnLocal = portIdx => { const c = PIC_PORTS[PORTS[portIdx]].conn; return [c.x, c.z]; };
export const portWidth = i => { let n = 0; for (let b = 0; b < 8; b++) if (PMASK[i] >> b & 1) n++; return n; };

// ---- Modules ----
const row = (sigs, x0, z, step = P) => Object.fromEntries(sigs.map((s, i) => [s, [x0 + i * step, z]]));
export const MODS = {
  seg7: {
    title: 'Module 7 segments', w: 11.5, d: 9,
    pins: { ...row(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'], -5.0, -2.55), ...row(['dis0', 'dis1', 'dis2', 'dis3'], 2.0, -3.6, 0.9) },
    ribbons: { seg: { sigs: ['dp', 'g', 'f', 'e', 'd', 'c', 'b', 'a'], x: -2.9, z: -3.75, label: 'segments DP…a' } },
    desc: '4 afficheurs 7 segments à anode commune. Chaque afficheur est alimenté par un transistor PNP (2N2905) piloté par Dis0…Dis3 : actif à 0. Les segments a…dp sont reliés aux cathodes via 270 Ω : actifs à 0.',
  },
  lcd: {
    title: 'Module LCD 16×2', w: 13.5, d: 8.6,
    pins: { ...row(['d7', 'd6', 'd5', 'd4', 'd3', 'd2', 'd1', 'd0'], -5.9, -2.5), ...row(['e', 'rw', 'rs'], 2.4, -3.6, 0.95) },
    ribbons: { data: { sigs: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'], x: -3.8, z: -3.7, label: 'données D0→D7' } },
    desc: 'Afficheur HD44780 16 caractères × 2 lignes. RS : 0 = commande, 1 = caractère. RW : 0 = écriture. E : la donnée est lue sur le front descendant. Mode 8 bits (D0…D7) ou 4 bits (D4…D7 seulement).',
  },
  keypad: {
    title: 'Module clavier 16 touches', w: 9.5, d: 10.5,
    pins: row(['c1', 'c2', 'c3', 'c4', 'r1', 'r2', 'r3', 'r4'], -2.1, -3.55),
    ribbons: { all: { sigs: ['c1', 'c2', 'c3', 'c4', 'r1', 'r2', 'r3', 'r4'], x: 0, z: -4.55, label: 'C1-C4 · L1-L4' } },
    desc: 'Clavier matriciel 4×4. Colonnes C1…C4 et lignes L1…L4 ont des résistances de 10 kΩ vers la masse : on met une ligne à 1 et on lit les colonnes (une touche appuyée relie sa ligne et sa colonne).',
  },
  buttons: {
    title: 'Module boutons poussoirs', w: 9.5, d: 6,
    pins: row(['bp0', 'bp1', 'bp2', 'bp3'], -2.7, -2.2, 1.8), ribbons: {},
    desc: 'Quatre boutons poussoirs avec résistance de rappel et condensateur anti-rebond. Au repos la sortie vaut 1, appuyé elle vaut 0.',
  },
  switches: {
    title: 'Module interrupteurs', w: 9.5, d: 6,
    pins: row(['i0', 'i1', 'i2', 'i3'], -2.7, -2.2, 1.8), ribbons: {},
    desc: 'Quatre interrupteurs à levier : position haute = 1 (5 V), basse = 0.',
  },
  pots: {
    title: 'Module potentiomètres', w: 9.5, d: 6,
    pins: row(['pot0', 'pot1', 'pot2', 'pot3'], -2.7, -2.2, 1.8), ribbons: {},
    desc: 'Quatre potentiomètres 1 kΩ entre 0 et 5 V. À relier à une entrée analogique (AN0…AN7 : RA0, RA1, RA2, RA3, RA5, RE0, RE1, RE2).',
  },
};
MODS.gbf = {
  title: 'GBF', w: 9, d: 7, pins: { out: [3.2, 2.6] }, ribbons: {},
  desc: 'Générateur basse fréquence : signal carré TTL 0/5 V (ou sinus / triangle 0-5 V). Règle la fréquence dans l\'onglet INSTRUMENTS. Les masses du GBF et de la carte sont reliées.',
};
MODS.bnc = {
  title: 'Module BNC + oscilloscope', w: 12, d: 9.5, pins: { ch1: [-1.6, 3.7], ch2: [1.6, 3.7] }, ribbons: {},
  desc: 'Le module BNC envoie deux broches vers l\'oscilloscope (CH1 jaune, CH2 cyan). Il ne perturbe pas le montage : tu peux le brancher sur une broche déjà utilisée. Écran agrandi et mesures dans l\'onglet INSTRUMENTS.',
};
MODS.buzzer = {
  title: 'Module buzzer', w: 7, d: 5.5, pins: { buz: [0, -1.9] }, ribbons: {},
  desc: 'Buzzer piézo : il vibre à la fréquence du signal carré reçu. Avec la sortie PWM CCP1 (RC2) on règle la note par PR2. Active le son avec le bouton « Son ».',
};
MODS.dac = {
  title: 'Module MCP4921', w: 8.5, d: 6, pins: { cs: [-2.7, -2.1], sck: [-0.9, -2.1], sdi: [0.9, -2.1], ldac: [2.7, -2.1] }, ribbons: {},
  desc: 'Convertisseur numérique-analogique 12 bits sur bus SPI. Mot de 16 bits : bit 15 = voie (0 = A), bit 14 = buffer, bit 13 = gain (1 = ×1), bit 12 = actif, puis 12 bits de valeur. Vout = Vref × D / 4096. CS et LDAC actifs à 0.',
};
export const MOD_ORDER = ['seg7', 'lcd', 'keypad', 'buttons', 'switches', 'pots', 'buzzer', 'dac', 'gbf', 'bnc'];
const INSTR = ['gbf', 'bnc'];

// emplacements autour de la carte PIC (toutes les cartes à l'endroit, texte lisible)
const SLOTS = [
  { x: -8.6, z: 14.4, r: 0 }, { x: 8.6, z: 14.4, r: 0 },
  { x: -22.5, z: 0, r: 0 }, { x: 22.5, z: 0, r: 0 },
  { x: -8.6, z: -14.8, r: 0 }, { x: 8.6, z: -14.8, r: 0 },
  { x: -22.5, z: 13, r: 0 }, { x: 22.5, z: 13, r: 0 },
];
export function placements(active) {
  const res = {}; let i = 0;
  // les grosses cartes devant, les petites sur les côtés
  const sorted = MOD_ORDER.filter(m => active.includes(m) && !INSTR.includes(m));
  if (sorted.length === 1) res[sorted[0]] = { x: 0, z: 14.4, r: 0 };
  else for (const m of sorted) res[m] = SLOTS[i++];
  const n = sorted.length;
  const L = { x: -24, z: 4, r: -0.4 }, R = { x: 24, z: 4, r: 0.4 };
  const backL = { x: -30, z: -15, r: 0 }, backR = { x: 30, z: -15, r: 0 };
  if (active.includes('bnc')) res.bnc = n <= 2 ? L : n === 3 ? R : backL;
  if (active.includes('gbf')) res.gbf = n <= 2 ? R : backR;
  return res;
}
export function toWorld(slot, [x, z]) {
  if (!slot) return [x, z];
  const c = Math.cos(slot.r), s = Math.sin(slot.r);
  return [slot.x + x * c + z * s, slot.z - x * s + z * c];
}
export const SIG_LABEL = s => s.startsWith('dis') ? 'Dis' + s[3] : s.startsWith('pot') ? 'POT' + s[3] : s.startsWith('bp') ? 'BP' + s[2] : /^r\d$/.test(s) ? 'L' + s[1] : s.toUpperCase();
export const WIRE_COLORS = ['#e2552e', '#2a6fdb', '#f2c230', '#21a35b', '#8e44ad', '#ef7d1a', '#1fb5a8', '#d6336c', '#555'];
export const RIBBON_COLORS = ['#7a4a2a', '#d23a2a', '#f08a24', '#f2d230', '#2e9e4f', '#2a6fdb', '#7d4bb5', '#8a8a8a'];

export function calloutSpots(active) {
  const pl = placements(active);
  const out = [{ id: 'pic', title: 'Carte PIC 18F452', pos: [0, 2.2, -7.4] }];
  for (const m of MOD_ORDER) if (pl[m]) { const [x, z] = toWorld(pl[m], [0, MODS[m].d / 2 + 0.9]); out.push({ id: m, title: MODS[m].title.replace('Module ', ''), pos: [x, 1.6, z] }); }
  return out;
}
export const calloutDom = {};

export function sceneExtent(active) {
  const pl = placements(active); let mx = PIC.w / 2 + 4, mz = PIC.d / 2;
  for (const m in pl) { const M = MODS[m], sl = pl[m]; const hw = Math.abs(Math.cos(sl.r)) * M.w / 2 + Math.abs(Math.sin(sl.r)) * M.d / 2; mx = Math.max(mx, Math.abs(sl.x) + hw); mz = Math.max(mz, Math.abs(sl.z) + M.d / 2); }
  return { mx, mz };
}

// État global (zustand) + pilotage du moteur de simulation
import { create } from 'zustand';
import CC from './engine/compiler.js';
import PICM from './engine/machine.js';
import { LESSONS, DEFAULT_WIRING } from './engine/lessons.js';
import { MODS } from './layout.js';
import { defaultScope } from './scope.js';

const { Bench, Sim, SFR, pinIdx, pinName, MODULES } = PICM;
export { LESSONS, PICM, SFR, pinName, pinIdx };

const ls = {
  get(k, d) { try { const v = localStorage.getItem('piclab3d.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('piclab3d.' + k, JSON.stringify(v)); } catch (e) { } },
};

// ---------- moteur (hors React) ----------
export const engine = { bench: new Bench(), sim: null, compiled: null, okSince: null };
const bench = engine.bench;
for (const m in bench.wiring) for (const s in bench.wiring[m]) bench.wiring[m][s] = null;

// Câblage attendu d'une leçon : nappes + fils
export function lessonWiring(lesson) {
  const items = [];
  for (const m of lesson.modules) {
    const def = { ...DEFAULT_WIRING[m], ...((lesson.wiring || {})[m] || {}) }; const covered = new Set();
    for (const [g, r] of Object.entries(MODS[m].ribbons)) {
      if (r.sigs.some(s => !def[s])) continue;
      const pins = r.sigs.map(s => pinIdx(def[s]));
      if (pins.every((p, i) => p === pins[0] + i) && (pins[0] & 7) === 0) { items.push({ kind: 'ribbon', mod: m, group: g, port: pins[0] >> 3 }); r.sigs.forEach(s => covered.add(s)); }
    }
    for (const s of MODULES[m].sigs) if (!covered.has(s) && def[s]) items.push({ kind: 'wire', mod: m, sig: s, pin: pinIdx(def[s]) });
  }
  return items;
}
export function itemDone(it, wiring, ribbons) {
  if (it.kind === 'ribbon') return ribbons[it.mod + '.' + it.group] === it.port;
  return wiring[it.mod][it.sig] === it.pin;
}

let logId = 0;
export const useStore = create((set, get) => ({
  lessonId: ls.get('lesson', LESSONS[0].id),
  done: ls.get('done', {}),
  code: '',
  state: 'idle', simTime: 0, effSpeed: 1,
  speed: ls.get('speed', 1), fosc: ls.get('fosc4', 4e6), scope: defaultScope(), help: false,
  logs: [], errLine: 0, curLine: 0, warnLines: [],
  active: [], wiring: {}, ribbons: {}, wv: 0,
  pending: null, hover: null, selected: null, labels: true, sound: ls.get('sound', true), modal: null, addOpen: false,
  tab: 'apercu', codeExpanded: false, toast: null,
  cam: 0, // compteur pour actions caméra
  camCmd: null,

  log(k, m, l) {
    const logs = get().logs.slice(-250);
    logs.push({ k, m, l, id: ++logId });
    const warnLines = (k === 'warn' && l && !get().warnLines.includes(l)) ? [...get().warnLines, l] : get().warnLines;
    set({ logs, warnLines });
  },
  clearLogs() { set({ logs: [], warnLines: [], errLine: 0 }); },
  setCode(code) {
    const id = get().lessonId, L = LESSONS.find(l => l.id === id);
    set({ code });
    // on ne garde que le code modifié, lié à la version d'origine de la leçon
    if (!L || code === L.code) ls.set('code2.' + id, null);
    else ls.set('code2.' + id, { code, orig: L.code });
  },
  savedCode(L) { const sv = ls.get('code2.' + L.id, null); return sv && sv.orig === L.code && typeof sv.code === 'string' ? sv.code : L.code; },
  syncWiring() {
    bench.rebuild();
    const wiring = JSON.parse(JSON.stringify(bench.wiring));
    set({ wiring, wv: get().wv + 1 });
    ls.set('bench.' + get().lessonId, { wiring: bench.wiring, ribbons: get().ribbons, active: [...bench.active] });
    if (engine.sim) { engine.sim.pic.pinsChanged(); engine.sim.pic.inputsChanged(); }
  },
  // ----- câblage -----
  connect(mod, sig, pin) {
    const ribbons = { ...get().ribbons };
    for (const [g, r] of Object.entries(MODS[mod].ribbons)) if (r.sigs.includes(sig) && ribbons[mod + '.' + g] !== undefined) { delete ribbons[mod + '.' + g]; r.sigs.forEach(s => bench.wiring[mod][s] = null); }
    bench.wiring[mod][sig] = pin;
    set({ ribbons }); get().syncWiring();
  },
  disconnect(mod, sig) { bench.wiring[mod][sig] = null; get().syncWiring(); },
  connectRibbon(mod, group, port) {
    const r = MODS[mod].ribbons[group];
    r.sigs.forEach((s, i) => bench.wiring[mod][s] = port * 8 + i);
    set({ ribbons: { ...get().ribbons, [mod + '.' + group]: port } }); get().syncWiring();
  },
  disconnectRibbon(mod, group) {
    const r = MODS[mod].ribbons[group]; r.sigs.forEach(s => bench.wiring[mod][s] = null);
    const ribbons = { ...get().ribbons }; delete ribbons[mod + '.' + group];
    set({ ribbons }); get().syncWiring();
  },
  unplugAll() { for (const m in bench.wiring) for (const s in bench.wiring[m]) bench.wiring[m][s] = null; set({ ribbons: {} }); get().syncWiring(); },
  autoWire() {
    const L = LESSONS.find(l => l.id === get().lessonId);
    get().unplugAll();
    const ribbons = {};
    for (const it of lessonWiring(L)) {
      if (it.kind === 'ribbon') { MODS[it.mod].ribbons[it.group].sigs.forEach((s, i) => bench.wiring[it.mod][s] = it.port * 8 + i); ribbons[it.mod + '.' + it.group] = it.port; }
      else bench.wiring[it.mod][it.sig] = it.pin;
    }
    set({ ribbons }); get().syncWiring();
  },
  setActive(active) { bench.active = new Set(active); set({ active }); get().syncWiring(); },
  // ----- leçons -----
  loadLesson(id, keepCode) {
    get().stop(true);
    const L = LESSONS.find(l => l.id === id) || LESSONS[0];
    const saved = ls.get('bench.' + L.id, null);
    for (const m in bench.wiring) for (const s in bench.wiring[m]) bench.wiring[m][s] = null;
    let ribbons = {}, active = L.modules;
    if (saved) { try { for (const m in saved.wiring) for (const s in saved.wiring[m]) if (bench.wiring[m]) bench.wiring[m][s] = saved.wiring[m][s]; ribbons = saved.ribbons || {}; active = saved.active || L.modules; } catch (e) { } }
    bench.active = new Set(active);
    bench.scopeSrc = { ch1: 'pin', ch2: 'pin', ...(L.scope || {}) };
    const code = keepCode ? get().code : get().savedCode(L);
    set({ lessonId: L.id, code, active, ribbons, pending: null, selected: null, errLine: 0, curLine: 0, warnLines: [], logs: [] });
    ls.set('lesson', L.id);
    get().syncWiring();
    if (saved && Object.values(bench.wiring).some(w => Object.values(w).some(v => v !== null))) get().log('info', 'Câblage retrouvé : c\'est celui que tu avais laissé sur cette leçon (sauvegardé dans ton navigateur). Onglet Câblage → « Tout débrancher » pour repartir de zéro.');
    get().log('info', L.free ? 'Banc libre : choisis tes modules, câble comme tu veux et lance ▶.' : `« ${L.title} » : branche les câbles (onglet Câblage) puis lance le programme ▶.`);
  },
  resetCode() { const L = LESSONS.find(l => l.id === get().lessonId); get().setCode(L.code); },
  loadSolution() { const L = LESSONS.find(l => l.id === get().lessonId); if (L.solution) { get().setCode(L.solution); get().log('info', 'Exemple de solution chargé. Le bouton ↺ remet le squelette.'); } set({ modal: null }); },
  // ----- simulation -----
  compileRun() {
    const st = get(); st.stop(true);
    set({ logs: [], warnLines: [], errLine: 0, curLine: 0 });
    let c;
    try { c = CC.compile(st.code, SFR); }
    catch (e) {
      if (e instanceof CC.CErr) { set({ errLine: e.line || 0, state: 'error' }); get().log('error', 'Erreur de compilation : ' + e.message, e.line); if (e.xc8) get().log('xc8', `Sur MPLAB X, XC8 afficherait à peu près : main.c:${e.line}: ${e.xc8}`, e.line); }
      else { console.error(e); get().log('error', 'Erreur interne du compilateur : ' + e.message); set({ state: 'error' }); }
      return false;
    }
    engine.compiled = c;
    c.warnings.forEach(w => get().log('warn', w.msg, w.line || null));
    const fosc = c.xtal || st.fosc;
    const osc = (c.pragmas || []).join(' ');
    if (!c.xtal && /OSC\s*=\s*HS/i.test(osc) && fosc <= 4e6) get().log('info', `#pragma OSC = HS mais quartz réglé à ${fosc / 1e6} MHz (HS sert au-dessus de 4 MHz, XT jusqu'à 4 MHz).`);
    const sim = new Sim(bench, (k, m, l) => get().log(k, m, l));
    try { sim.load(c, fosc); } catch (e) { console.error(e); get().log('error', 'Erreur interne : ' + e.message); return false; }
    bench.opts.lcdStrict = false;
    sim.start(); engine.sim = sim; engine.okSince = 0;
    const L = LESSONS.find(l => l.id === st.lessonId);
    const missing = L.free ? [] : lessonWiring(L).filter(it => !itemDone(it, bench.wiring, get().ribbons));
    get().log('ok', `Compilation réussie — PIC à ${fosc / 1e6} MHz.${missing.length ? ` ⚠ ${missing.length} branchement(s) du TP manquant(s) : voir l'onglet Câblage.` : ''}`);
    set({ state: 'run', simTime: 0 });
    return true;
  },
  stop(silent) { if (engine.sim && !silent && get().state !== 'idle') get().log('info', 'Simulation arrêtée.'); set({ state: 'idle', curLine: 0 }); },
  halt() { get().stop(); engine.sim = null; set({ wv: get().wv + 1 }); },
  togglePause() {
    const s = get().state; if (!engine.sim) return;
    if (s === 'run') { const L = engine.sim.pic.S.L; set({ state: 'pause', curLine: L }); get().log('info', `Pause — ligne ${L} en cours.`, L); }
    else if (s === 'pause') set({ state: 'run', curLine: 0 });
  },
  step() { const sim = engine.sim; if (!sim || get().state !== 'pause') return; sim.runCycles(sim.pic.fcy / 1000); set({ curLine: sim.pic.S.L, simTime: sim.pic.S.C / sim.pic.fcy }); },
  afterFrame() {
    const sim = engine.sim; if (!sim) return;
    const t = sim.pic.S.C / sim.pic.fcy;
    if (sim.state === 'error' || sim.state === 'done') {
      set({ state: sim.state, curLine: sim.pic.S.L, errLine: sim.state === 'error' ? sim.pic.S.L : 0, simTime: t });
      return;
    }
    // validation de la leçon : 2 s sans erreur avec le câblage du TP
    const st = get();
    if (!st.done[st.lessonId] && t > 2) {
      const L = LESSONS.find(l => l.id === st.lessonId);
      if (st.code === L.code) return;   // le squelette seul ne valide pas la leçon
      const items = lessonWiring(L);
      if (L.id !== 'libre' && items.every(it => itemDone(it, bench.wiring, st.ribbons))) {
        const done = { ...st.done, [L.id]: true }; ls.set('done', done);
        set({ done, toast: `Leçon « ${L.title} » validée ✓` });
        setTimeout(() => set({ toast: null }), 3500);
      }
    }
  },
  set(k, v) { set({ [k]: v }); if (k === 'speed') ls.set(k, v); if (k === 'fosc') ls.set('fosc4', v); },
}));

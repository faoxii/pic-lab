// Logique de branchement (clics sur broches et connecteurs)
import { useStore, engine, pinName } from './state.js';
import { MODS, placements, toWorld, picPinLocal, picConnLocal, PIN_TOP, TOP, SIG_LABEL, portWidth } from './layout.js';
import PICM from './engine/machine.js';
const { PORTS } = PICM;

export function modPinWorld(m, s, active) { const sl = placements(active)[m]; const [x, z] = toWorld(sl, MODS[m].pins[s]); return [x, PIN_TOP, z]; }
export function picPinWorld(p) { const [x, z] = picPinLocal(p); return [x, PIN_TOP, z]; }
export function modConnWorld(m, g, active) { const sl = placements(active)[m]; const r = MODS[m].ribbons[g]; const [x, z] = toWorld(sl, [r.x, r.z]); return [x, TOP + 0.55, z]; }
export function picConnWorld(port) { const [x, z] = picConnLocal(port); return [x, TOP + 0.55, z]; }

const toast = (msg) => { useStore.setState({ toast: msg }); clearTimeout(toast.t); toast.t = setTimeout(() => useStore.setState({ toast: null }), 3200); };
function ribbonOf(m, s) { const rb = useStore.getState().ribbons; for (const [g, r] of Object.entries(MODS[m].ribbons)) if (r.sigs.includes(s) && rb[m + '.' + g] !== undefined) return g; return null; }

export function targetPos(t) {
  const active = useStore.getState().active;
  if (t.type === 'mod') return modPinWorld(t.mod, t.sig, active);
  if (t.type === 'pic') return picPinWorld(t.pin);
  if (t.type === 'mconn') return modConnWorld(t.mod, t.group, active);
  return picConnWorld(t.port);
}
const T = {
  mod: (mod, sig) => ({ type: 'mod', mod, sig, id: `mod:${mod}:${sig}`, label: SIG_LABEL(sig) }),
  pic: pin => ({ type: 'pic', pin, id: `pic:${pin}`, label: pinName(pin) }),
  mconn: (mod, group) => ({ type: 'mconn', mod, group, id: `mconn:${mod}:${group}`, label: 'nappe ' + MODS[mod].ribbons[group].label }),
  pconn: port => ({ type: 'pconn', port, id: `pconn:${port}`, label: 'PORT' + PORTS[port] }),
};
export { T as targets };

export function pick(t) {
  const st = useStore.getState(), W = engine.bench.wiring, pend = st.pending;
  const start = x => useStore.setState({ pending: { ...x, pos: targetPos(x) } });
  if (!pend) {
    if (t.type === 'mod') {
      const g = ribbonOf(t.mod, t.sig);
      if (g) { toast(`${t.label} est déjà relié par la nappe. Clique sur le connecteur blanc pour débrancher la nappe.`); return; }
      if (t.mod === 'bnc' && engine.bench.scopeSrc[t.sig] === 'gbf') { st.disconnectDirect(t.sig); return start(T.mod('gbf', 'out')); }
      if (W[t.mod][t.sig] !== null) st.disconnect(t.mod, t.sig);
      return start(t);
    }
    if (t.type === 'pic') {
      const l = (engine.bench.byPin[t.pin] || []).filter(([m, s]) => !ribbonOf(m, s));
      if (l.length) { const [m, s] = l[0]; st.disconnect(m, s); return start(T.mod(m, s)); }
      return start(t);
    }
    if (t.type === 'mconn') { if (st.ribbons[t.mod + '.' + t.group] !== undefined) st.disconnectRibbon(t.mod, t.group); return start(t); }
    if (t.type === 'pconn') {
      const k = Object.keys(st.ribbons).find(k => st.ribbons[k] === t.port && st.active.includes(k.split('.')[0]));
      if (k) { const [m, g] = k.split('.'); st.disconnectRibbon(m, g); return start(T.mconn(m, g)); }
      if (portWidth(t.port) < 8) { toast(`Le PORT${PORTS[t.port]} n'a que ${portWidth(t.port)} broches : les nappes 8 fils vont sur PORTB, PORTC ou PORTD.`); return; }
      return start(t);
    }
  }
  if (t.id === pend.id) { useStore.setState({ pending: null }); return; }
  const pair = (a, b) => (pend.type === a && t.type === b) || (pend.type === b && t.type === a);
  if (pair('mod', 'pic')) {
    const m = pend.type === 'mod' ? pend : t, p = pend.type === 'pic' ? pend : t;
    if (m.mod === 'pots' && !PICM.AN_PINS.includes(p.pin)) toast(`${pinName(p.pin)} n'est pas une entrée analogique : un potentiomètre se lit sur AN0…AN7 (RA0-3, RA5, RE0-2).`);
    const g = ribbonOf(m.mod, m.sig);
    if (g) st.disconnectRibbon(m.mod, g);
    st.connect(m.mod, m.sig, p.pin);
    useStore.setState({ pending: null }); return;
  }
  if (pair('mconn', 'pconn')) {
    const m = pend.type === 'mconn' ? pend : t, p = pend.type === 'pconn' ? pend : t;
    if (portWidth(p.port) < 8) { toast(`Le PORT${PORTS[p.port]} n'a que ${portWidth(p.port)} broches : choisis PORTB, PORTC ou PORTD.`); return; }
    st.connectRibbon(m.mod, m.group, p.port);
    useStore.setState({ pending: null }); return;
  }
  if (pair('mod', 'mod')) {
    const g = [pend, t].find(x => x.mod === 'gbf'), b = [pend, t].find(x => x.mod === 'bnc');
    if (g && b) { st.connectDirect(b.sig); useStore.setState({ pending: null }); toast(`GBF relié directement à ${b.sig.toUpperCase()} de l'oscilloscope.`); return; }
  }
  if (pend.type === t.type) return start(t);
  toast('Un fil relie une broche de module à une broche du PIC ; une nappe relie un connecteur blanc à un connecteur blanc.');
}
export function cancelPending() { if (useStore.getState().pending) useStore.setState({ pending: null }); }

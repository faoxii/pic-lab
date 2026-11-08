import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useStore, engine, LESSONS, PICM } from './state.js';
import Panel from './ui/Panel.jsx';
import { cancelPending } from './interact.js';
import { calloutSpots, calloutDom, MODS } from './layout.js';
const Scene = lazy(() => import('./scene/Scene.jsx'));
const { KEY_LAYOUTS } = PICM;

const ICONS = { timer: '⧗', clavier: '#', musique: '♪', spi: '⇄', freq: '≋', seg1: '8', seg2: '9', seg3: '⁴', bp: '◉', chrono: '⏱', adc: '∿', lcd: 'Aa', serrure: '⌗', libre: '+' };

function Clock() {
  const [d, setD] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setD(new Date()), 1000); return () => clearInterval(i); }, []);
  const mois = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];
  return <div className="clock"><div>{String(d.getDate()).padStart(2, '0')} {mois[d.getMonth()]} {d.getFullYear()}</div><div>{d.toLocaleTimeString('fr-FR')}</div></div>;
}
function Progress() {
  const done = useStore(s => s.done);
  const list = LESSONS.filter(l => l.id !== 'libre'); const n = list.filter(l => done[l.id]).length;
  return (
    <div className="card prog">
      <div className="progcard"><span className="book">📖</span><div><div className="k">LEÇONS</div><div className="pbar"><i style={{ width: n / list.length * 100 + '%' }} /></div></div><b>{n}/{list.length}</b></div>
      <Clock />
    </div>
  );
}
function Status() {
  const state = useStore(s => s.state), t = useStore(s => s.simTime), speed = useStore(s => s.speed), eff = useStore(s => s.effSpeed), fosc = useStore(s => s.fosc), active = useStore(s => s.active), sound = useStore(s => s.sound);
  const lbl = { idle: 'prêt', run: 'en marche', pause: 'en pause', error: 'erreur', done: 'terminé' }[state];
  const fmt = s => s < 1 ? (s * 1000).toFixed(0) + ' ms' : s.toFixed(2) + ' s';
  return (
    <div className="status card">
      <span className={'sdot s-' + state} />{lbl}
      {engine.sim && <span className="mono mut">t = {fmt(t)}{state === 'run' && eff < 0.97 ? ` · ${Math.round(eff * 100)} %` : ''}</span>}
      <span className="lbl">Vitesse</span><select value={speed} onChange={e => useStore.getState().set('speed', +e.target.value)} title="Vitesse de simulation">
        <option value={1}>×1</option><option value={0.25}>×0,25</option><option value={0.1}>×0,1</option><option value={0.01}>×0,01</option><option value={0.001}>×0,001</option>
      </select>
      <span className="lbl">Quartz</span><select value={fosc} onChange={e => useStore.getState().set('fosc', +e.target.value)} title="Quartz (ignoré si _XTAL_FREQ est défini) — à relancer après changement">
        {[4e6, 8e6, 10e6, 20e6].map(f => <option key={f} value={f}>{f / 1e6} MHz</option>)}
      </select>
      {state === 'pause' && <button className="btn sm ghost" onClick={() => useStore.getState().step()}>+1 ms</button>}
      {active.includes('buzzer') && <button className="helpb snd" title={sound ? 'Couper le son du buzzer' : 'Activer le son du buzzer'} onClick={toggleSound}>{sound ? '🔊' : '🔇'}</button>}
      <button className="helpb" title="C'est quoi ×1 et 4 MHz ?" onClick={() => useStore.setState({ help: !useStore.getState().help })}>?</button>
    </div>
  );
}
// Son du buzzer (WebAudio) : fréquence PWM ou fréquence des basculements de la broche
const audio = { ctx: null, osc: null, gain: null };
function Sound() {
  const on = useStore(s => s.sound);
  useEffect(() => {
    if (!on) { if (audio.gain) audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.02); return; }
    let last = { tog: 0, C: 0 };
    const i = setInterval(() => {
      const st = useStore.getState(), sim = engine.sim, B = engine.bench;
      let f = 0;
      if (sim && st.state === 'run' && st.active.includes('buzzer')) {
        const dC = sim.pic.S.C - last.C;
        if (dC > 0) { B.buz.f = (B.buz.toggles - last.tog) / 2 / (dC / sim.pic.fcy); last = { tog: B.buz.toggles, C: sim.pic.S.C }; }
        f = B.buzFreq(sim.pic);
      }
      const ok = f > 30 && f < 12000 && st.speed === 1;
      if (audio.osc) { audio.osc.frequency.setTargetAtTime(ok ? f : 440, audio.ctx.currentTime, 0.01); audio.gain.gain.setTargetAtTime(ok ? 0.05 : 0, audio.ctx.currentTime, 0.015); }
    }, 40);
    return () => clearInterval(i);
  }, [on]);
  return null;
}
function initAudio() {
  try {
    if (!audio.ctx) { const C = window.AudioContext || window.webkitAudioContext; audio.ctx = new C(); audio.osc = audio.ctx.createOscillator(); audio.osc.type = 'square'; audio.gain = audio.ctx.createGain(); audio.gain.gain.value = 0; audio.osc.connect(audio.gain).connect(audio.ctx.destination); audio.osc.start(); }
    audio.ctx.resume();
  } catch (e) { }
}
if (typeof window !== 'undefined') { const once = () => { initAudio(); removeEventListener('pointerdown', once); removeEventListener('keydown', once); }; addEventListener('pointerdown', once); addEventListener('keydown', once); }
function toggleSound() {
  const st = useStore.getState();
  try {
    if (!audio.ctx) { const C = window.AudioContext || window.webkitAudioContext; audio.ctx = new C(); audio.osc = audio.ctx.createOscillator(); audio.osc.type = 'square'; audio.gain = audio.ctx.createGain(); audio.gain.gain.value = 0; audio.osc.connect(audio.gain).connect(audio.ctx.destination); audio.osc.start(); }
    audio.ctx.resume();
  } catch (e) { st.log('warn', 'Son indisponible dans ce navigateur.'); return; }
  useStore.setState({ sound: !st.sound }); try { localStorage.setItem('piclab3d.sound', JSON.stringify(!st.sound)); } catch (e) { }
}
function SoundButton() {
  const active = useStore(s => s.active), sound = useStore(s => s.sound);
  if (!active.includes('buzzer')) return null;
  return null;
}
function Help() {
  const help = useStore(s => s.help);
  if (!help) return null;
  return (
    <div className="helpbox card">
      <button className="x" onClick={() => useStore.setState({ help: false })}>×</button>
      <h4>Vitesse (×1, ×0,1…)</h4>
      <p>Vitesse de la simulation. <b>×1</b> = temps réel : 1 seconde de PIC = 1 seconde à l'écran. <b>×0,1</b> = 10 fois plus lent, <b>×0,01</b> = 100 fois plus lent : pratique pour voir le multiplexage, un compteur ou les fronts à l'oscillo. Les timers et le GBF ralentissent aussi, les calculs restent justes.</p>
      <h4>Quartz (4 MHz)</h4>
      <p>Fréquence de l'oscillateur de la carte (Fosc). Le PIC18F452 exécute une instruction tous les 4 coups d'horloge : <b>Fcy = Fosc / 4 = 1 MHz</b>, donc <b>1 instruction = 1 µs</b> (cycle instruction). C'est la base de tous les calculs de timer : sans prédiviseur, Timer0 avance de 1 pas par µs. Les cartes de TP ont un quartz de 4 MHz (<code>#pragma config OSC = XT</code>). Si tu écris <code>#define _XTAL_FREQ</code>, c'est cette valeur qui est utilisée.</p>
      <h4>t = …</h4>
      <p>Temps écoulé dans le PIC depuis le lancement du programme.</p>
    </div>
  );
}
function Toolbar() {
  const labels = useStore(s => s.labels);
  const cmd = (type, v) => useStore.setState({ camCmd: { type, v, n: Math.random() } });
  return (
    <div className="toolbar card">
      <button title="Tourner à gauche" onClick={() => cmd('rot', -Math.PI / 6)}>↺</button>
      <button title="Tourner à droite" onClick={() => cmd('rot', Math.PI / 6)}>↻</button>
      <i />
      <button title="Dézoomer" onClick={() => cmd('zoom', 1.25)}>−</button>
      <button title="Zoomer" onClick={() => cmd('zoom', 0.8)}>+</button>
      <i />
      <button title="Vue de dessus" onClick={() => cmd('top')}>⊤</button>
      <button title="Vue d'origine" onClick={() => cmd('home')}>⌂</button>
      <button title="Étiquettes" className={labels ? 'on' : ''} onClick={() => useStore.setState({ labels: !labels })}>ⓘ</button>
    </div>
  );
}
function Lessons() {
  const lessonId = useStore(s => s.lessonId), done = useStore(s => s.done);
  const ref = useRef();
  const [ask, setAsk] = useState(null);
  const go = L => {
    const st = useStore.getState(); const cur = LESSONS.find(l => l.id === st.lessonId);
    if (L.id === st.lessonId) return;
    st.loadLesson(L.id);
  };
  return (
    <div className="lessons">
      <div className="lhd">⚡ LEÇONS · MICRO-INFO</div>
      <div className="lrow">
        <div className="lscroll" ref={ref}>
          {LESSONS.map((L, i) => (
            <button key={L.id} className={'lcard' + (L.id === lessonId ? ' on' : '')} onClick={() => go(L)}>
              <span className="lic">{ICONS[L.id] || '•'}</span>
              <span className="lt">{L.free ? '' : i + '. '}{L.title.toUpperCase()}</span>
              {done[L.id] && <span className="ok">✓</span>}
            </button>
          ))}
        </div>
        <button className="arrow" onClick={() => ref.current.scrollBy({ left: -320, behavior: 'smooth' })}>‹</button>
        <button className="arrow dark" onClick={() => ref.current.scrollBy({ left: 320, behavior: 'smooth' })}>›</button>
      </div>
    </div>
  );
}
const PIC_DESC = 'Microcontrôleur PIC18F452 (40 broches, 8 bits) avec quartz, régulateur 5 V et connecteur PICkit. Les ports A à E sortent sur des barrettes (fils) et des connecteurs blancs (nappes 8 fils). Chaque broche a une LED : rouge = sortie à 1, rouge sombre = sortie à 0, bleu = entrée lue à 1, ocre = entrée analogique.';
function Callouts() {
  const active = useStore(s => s.active), labels = useStore(s => s.labels);
  if (!labels) return null;
  return <div className="callouts">{calloutSpots(active).map(sp => (
    <div key={sp.id} ref={el => { if (el) calloutDom[sp.id] = el; else delete calloutDom[sp.id]; }} className="callout"
      onClick={() => useStore.setState({ tab: 'apercu', selected: sp.id === 'pic' ? { title: 'Module Processor PIC 18F452', desc: PIC_DESC } : { title: MODS[sp.id].title, desc: MODS[sp.id].desc } })}>{sp.title}<span>ⓘ</span></div>))}</div>;
}
function Modal() {
  const modal = useStore(s => s.modal);
  if (!modal) return null;
  const st = useStore.getState();
  const txt = modal === 'solution' ? 'Remplacer ton code par l\'exemple de solution ? (ton code actuel sera perdu, pense à le copier si tu veux le garder)' : 'Repartir du squelette ? Ton code actuel sera remplacé.';
  return (
    <div className="modal" onClick={() => useStore.setState({ modal: null })}>
      <div className="card mbox" onClick={e => e.stopPropagation()}>
        <p>{txt}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={() => useStore.setState({ modal: null })}>Annuler</button>
          <button className="btn" style={{ background: 'var(--navy)', color: '#fff' }} onClick={() => { if (modal === 'solution') st.loadSolution(); else { st.resetCode(); useStore.setState({ modal: null }); } }}>{modal === 'solution' ? '💡 Charger la solution' : '↺ Repartir du squelette'}</button>
        </div>
      </div>
    </div>
  );
}
const MOD_LABEL = { seg7: '7 segments', lcd: 'LCD 16×2', keypad: 'Clavier', buttons: 'Boutons poussoirs', switches: 'Interrupteurs', pots: 'Potentiomètres', buzzer: 'Buzzer', dac: 'MCP4921 (SPI)', gbf: 'GBF', bnc: 'BNC + oscilloscope' };
function AddModules() {
  const active = useStore(s => s.active), open = useStore(s => s.addOpen);
  const st = useStore.getState();
  const order = Object.keys(MOD_LABEL);
  return (
    <div className="addmod">
      {open && <div className="addlist card">
        <div className="k" style={{ marginBottom: 6 }}>MODULES SUR LA TABLE</div>
        {order.map(m => <label key={m} className="addrow"><input type="checkbox" checked={active.includes(m)} onChange={() => st.setActive(active.includes(m) ? active.filter(x => x !== m) : [...active, m])} />{MOD_LABEL[m]}</label>)}
      </div>}
      <button className={'addbtn' + (open ? ' on' : '')} title="Ajouter / retirer des modules" onClick={() => useStore.setState({ addOpen: !open })}>{open ? '×' : '+'}</button>
    </div>
  );
}
function Overlays() {
  const hover = useStore(s => s.hover), pending = useStore(s => s.pending), toast = useStore(s => s.toast);
  return (
    <>
      {hover && <div className="tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>{hover.text}</div>}
      {pending && <div className="hint card"><span className="pulse" />
        {pending.type === 'mod' && <>Fil depuis <b>{pending.label}</b> : clique sur une broche du PIC</>}
        {pending.type === 'pic' && <>Fil depuis <b>{pending.label}</b> : clique sur une broche d'un module</>}
        {pending.type === 'mconn' && <>Nappe <b>{pending.label.replace('nappe ', '')}</b> : clique sur un connecteur blanc du PIC (PORTB, C ou D)</>}
        {pending.type === 'pconn' && <>Nappe depuis <b>{pending.label}</b> : clique sur le connecteur blanc d'un module</>}
        <button onClick={cancelPending}>Annuler (Échap)</button></div>}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

import * as interact from './interact.js';
window.__piclab = Object.assign(window.__piclab || {}, { useStore, engine, interact });
export default function App() {
  const expanded = useStore(s => s.codeExpanded);
  const [mview, setMview] = useState('scene');
  useEffect(() => {
    const st = useStore.getState(); st.loadLesson(st.lessonId);
    const inEditor = e => e.target.closest && (e.target.closest('.cm-editor') || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName));
    const down = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); useStore.getState().compileRun(); return; }
      if (e.key === 'Escape') { cancelPending(); useStore.setState({ codeExpanded: false }); }
      if (inEditor(e) || e.repeat) return;
    };
    addEventListener('keydown', down);
    return () => removeEventListener('keydown', down);
  }, []);
  return (
    <div className={'app m-' + mview + (expanded ? ' wide' : '')}>
      <div className="stage">
        <Suspense fallback={<div className="loading">Chargement de la scène 3D…</div>}><Scene /></Suspense>
        <div className="brand">
          <div className="logo"><svg viewBox="0 0 40 40"><rect x="9" y="9" width="22" height="22" rx="3" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M14 3v6M20 3v6M26 3v6M14 31v6M20 31v6M26 31v6M3 14h6M3 20h6M3 26h6M31 14h6M31 20h6M31 26h6" stroke="currentColor" strokeWidth="3" /><text x="20" y="24.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="currentColor" fontFamily="monospace">PIC</text></svg></div>
          <div><h1>PIC LAB</h1><div className="sub">SIMULATEUR PIC18F452 · MICRO-INFO</div></div>
        </div>
        <Progress />
        <Status />
        <Callouts />
        <AddModules />
        <Help />
        <Toolbar />
        <Lessons />
      </div>
      <Panel />
      <nav className="mtabs"><button className={mview === 'scene' ? 'on' : ''} onClick={() => setMview('scene')}>Banc 3D</button><button className={mview === 'panel' ? 'on' : ''} onClick={() => setMview('panel')}>Code & câblage</button></nav>
      <Overlays />
      <Sound />
      <Modal />
    </div>
  );
}

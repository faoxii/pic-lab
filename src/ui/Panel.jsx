import { useEffect, useRef, useState } from 'react';
import { useStore, engine, LESSONS, lessonWiring, itemDone, pinName, PICM } from '../state.js';
import { MODS, MOD_ORDER, SIG_LABEL } from '../layout.js';
import CodeEditor, { gotoLine } from './CodeEditor.jsx';
import { MEMO } from './memo.js';
import { drawScope, scopeStats, fmtF, fmtT, fmtV } from '../scope.js';
const { PORTS, PMASK, PCFG } = PICM;

function Apercu() {
  const lessonId = useStore(s => s.lessonId), selected = useStore(s => s.selected);
  const L = LESSONS.find(l => l.id === lessonId);
  return (
    <div className="tabbody">
      {selected && <div className="selcard"><div className="k">COMPOSANT</div><h3>{selected.title}</h3><p>{selected.desc}</p><button className="lnk" onClick={() => useStore.setState({ selected: null })}>fermer</button></div>}
      <div className="k">LEÇON</div>
      <h2>{L.title}</h2>
      <p className="goal">{L.goal}</p>
      <ul className="notes">{L.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
      {L.defi && <div className="defi"><b>Défi :</b> {L.defi}</div>}
      {L.solution && <div className="row" style={{ marginTop: 10 }}><span className="mut small">Le code part d'un squelette à compléter.</span><button className="btn sm" onClick={() => useStore.setState({ modal: 'solution' })}>💡 Voir un exemple de solution</button></div>}
      <div className="howto"><b>Comment câbler ?</b> Clique sur une broche d'un module, puis sur une broche du PIC : un fil se crée. Pour une nappe 8 fils, clique sur un connecteur blanc puis sur un connecteur blanc du PIC. Clique sur un fil pour le retirer.</div>
    </div>
  );
}
function Cablage() {
  const lessonId = useStore(s => s.lessonId), wiring = useStore(s => s.wiring), ribbons = useStore(s => s.ribbons), active = useStore(s => s.active);
  const st = useStore.getState();
  const L = LESSONS.find(l => l.id === lessonId);
  const items = L.free ? [] : lessonWiring(L);
  const nDone = items.filter(it => itemDone(it, wiring, ribbons)).length;
  const conflicts = engine.bench.conflicts();
  const extra = [];
  const rbList = Object.entries(ribbons).filter(([k]) => active.includes(k.split('.')[0]));
  for (const m of active) { if (!wiring[m]) continue; const cov = new Set(); for (const [g, r] of Object.entries(MODS[m].ribbons)) if (ribbons[m + '.' + g] !== undefined) r.sigs.forEach(x => cov.add(x)); for (const s in wiring[m]) if (wiring[m][s] !== null && !cov.has(s)) extra.push([m, s, wiring[m][s]]); }
  return (
    <div className="tabbody">
      {L.free ? <div className="howto" style={{ marginTop: 0 }}><b>Banc libre</b> : aucun câblage imposé. Clique sur une broche d'un module puis sur une broche du PIC pour poser un fil.<div style={{ marginTop: 6 }}><button className="btn sm ghost" onClick={() => st.unplugAll()}>Tout débrancher</button></div></div> : <>
      <div className="row between"><div className="k">BRANCHEMENTS DU TP · {nDone}/{items.length}</div>
        <div className="row"><button className="btn sm" onClick={() => st.autoWire()}>Câbler pour moi</button><button className="btn sm ghost" onClick={() => st.unplugAll()}>Tout débrancher</button></div></div>
      <div className="bar"><i style={{ width: (items.length ? nDone / items.length * 100 : 0) + '%' }} /></div>
      <table className="wt"><tbody>
        {items.map((it, i) => {
          const ok = itemDone(it, wiring, ribbons);
          const txt = it.kind === 'ribbon' ? <>Nappe <b>{MODS[it.mod].ribbons[it.group].label}</b> → <b>PORT{PORTS[it.port]}</b></> : <><b>{SIG_LABEL(it.sig)}</b> <span className="mut">({MODS[it.mod].title.replace('Module ', '')})</span> → <b>{pinName(it.pin)}</b></>;
          return <tr key={i} className={ok ? 'ok' : ''}><td>{ok ? '✓' : '○'}</td><td>{txt}</td></tr>;
        })}
      </tbody></table></>}
      {conflicts.length > 0 && <div className="warnbox"><b>Broches partagées :</b> {conflicts.join(' · ')}</div>}
      <div className="k" style={{ marginTop: 14 }}>EN PLACE · {rbList.length} NAPPE(S), {extra.length} FIL(S)</div>
      <div className="chips">{rbList.map(([k, port]) => { const [m, g] = k.split('.'); return <span key={k} className="chip rb">▤ {MODS[m].ribbons[g].label} → PORT{PORTS[port]}<button onClick={() => st.disconnectRibbon(m, g)}>×</button></span>; })}
        {extra.map(([m, s, p]) => <span key={m + s} className="chip">{SIG_LABEL(s)} → {pinName(p)}<button onClick={() => st.disconnect(m, s)}>×</button></span>)}
        {!extra.length && !rbList.length && <span className="mut">Rien de branché.</span>}</div>
      <p className="mut small" style={{ marginTop: 12 }}>Ajouter ou retirer des modules : bouton <b>+</b> en bas à droite de la scène 3D.</p>
      <p className="mut small">Conventions de la carte : segments et Dis actifs à 0, boutons à 0 quand on appuie, clavier avec pull-down (mettre une ligne à 1).</p>
    </div>
  );
}
const bits8 = v => { let s = ''; for (let b = 7; b >= 0; b--) s += `<b class="${v >> b & 1 ? 'one' : ''}">${v >> b & 1}</b>`; return `<span class="bits">${s}</span>`; };
const hx = (v, n = 2) => '0x' + v.toString(16).toUpperCase().padStart(n, '0');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function debugHtml() {
  const sim = engine.sim; if (!sim) return '<p class="mut">Lance un programme pour voir les registres et les variables.</p>';
  const p = sim.pic, r = p.reg, B = engine.bench;
  const rd = i => { let v = 0; for (let b = 0; b < 8; b++) { if (!(PMASK[i] >> b & 1)) continue; const pin = i * 8 + b; if (p.tris[i] >> b & 1) { if (p.isAnalog(pin)) continue; let l = B.extLevel(pin, p); if (l === null) l = (i === 1 && !(r.INTCON2 & 0x80)) ? 1 : 0; v |= l << b; } else v |= (p.lat[i] >> b & 1) << b; } return v; };
  let s = '<div class="k">VARIABLES GLOBALES</div>';
  try {
    const vals = sim.prog.watch();
    if (!vals.length) s += '<p class="mut">Aucune variable globale (déclare en global ce que tu veux surveiller).</p>';
    else { s += '<table class="reg">'; vals.forEach(([n, v], i) => { const info = engine.compiled.watchInfo[i]; let val; if (info.arr && v) { const a = Array.from(v).slice(0, 16); val = '{' + a.map(x => typeof x === 'number' ? (Number.isInteger(x) ? x : x.toFixed(2)) : '…').join(', ') + (v.length > 16 ? ', …' : '') + '}'; } else if (v && typeof v === 'object') val = '→ [' + v.o + ']'; else if (typeof v === 'number' && !Number.isInteger(v)) val = v.toPrecision(5); else val = v === null ? 'NULL' : v; s += `<tr><td><b>${esc(n)}</b></td><td class="mut">${esc(info.ty)}</td><td>${esc(val)}</td></tr>`; }); s += '</table>'; }
  } catch (e) { }
  s += '<div class="k" style="margin-top:10px">PORTS</div><table class="reg"><tr><th>Port</th><th>TRIS</th><th>LAT (écrit)</th><th>PORT (lu)</th></tr>';
  PORTS.forEach((P_, i) => s += `<tr><td>${P_}</td><td>${bits8(p.tris[i])}</td><td>${bits8(p.lat[i])}</td><td>${bits8(rd(i))}</td></tr>`);
  s += '</table><div class="k" style="margin-top:10px">REGISTRES</div><table class="reg">';
  const row = (n, v, note = '') => s += `<tr><td>${n}</td><td>${hx(v)}</td><td>${bits8(v)}</td><td class="mut">${note}</td></tr>`;
  const ps = (r.T0CON & 8) ? 1 : 2 << (r.T0CON & 7);
  row('T0CON', r.T0CON, `${r.T0CON & 0x80 ? 'ON' : 'OFF'} · ${r.T0CON & 0x40 ? '8' : '16'} bits · ${r.T0CON & 0x20 ? 'horloge EXTERNE' : 'Fosc/4'} · 1:${ps}`);
  s += `<tr><td>TMR0</td><td>${hx(p.t0.val, 4)}</td><td colspan=2>${p.t0.val}</td></tr>`;
  row('INTCON', r.INTCON, 'GIE PEIE T0IE INT0IE RBIE T0IF INT0IF RBIF');
  row('T1CON', r.T1CON); s += `<tr><td>TMR1</td><td>${hx(p.t1.val, 4)}</td><td colspan=2>${p.t1.val}</td></tr>`;
  row('T2CON', r.T2CON, 'TMR2 = ' + r.TMR2 + ' · PR2 = ' + r.PR2);
  row('PIR1', r.PIR1, 'PSPIF ADIF RCIF TXIF SSPIF CCP1IF TMR2IF TMR1IF'); row('PIE1', r.PIE1);
  row('ADCON0', r.ADCON0, `AN${(r.ADCON0 >> 3) & 7} · ${r.ADCON0 & 1 ? 'ADON' : 'éteint'}${r.ADCON0 & 4 ? ' · conversion…' : ''}`);
  row('ADCON1', r.ADCON1, `${r.ADCON1 & 0x80 ? 'droite' : 'gauche'} · AN7…AN0 = ${PCFG[r.ADCON1 & 15]}`);
  const res = r.ADCON1 & 0x80 ? ((r.ADRESH & 3) << 8 | r.ADRESL) : (r.ADRESH << 2 | r.ADRESL >> 6);
  s += `<tr><td>ADRES</td><td>${hx(r.ADRESH)}:${hx(r.ADRESL)}</td><td colspan=2>${res}</td></tr></table>`;
  return s;
}
function Debug() {
  const [, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT(t => t + 1), 200); return () => clearInterval(i); }, []);
  return <div className="tabbody mono" dangerouslySetInnerHTML={{ __html: debugHtml() }} />;
}

const TDIVS = [1e-5, 5e-5, 1e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1];
function Instruments() {
  const active = useStore(s => s.active), wiring = useStore(s => s.wiring);
  const S = useStore(s => s.scope);
  const [, setT] = useState(0);
  const refresh = () => setT(t => t + 1);
  const cv = useRef();
  useEffect(() => { let raf, k = 0; const loop = () => { if (cv.current) drawScope(cv.current, useStore.getState().scope, false); if (++k % 12 === 0) refresh(); raf = requestAnimationFrame(loop); }; loop(); return () => cancelAnimationFrame(raf); }, []);
  const g = engine.bench.gbf, st = useStore.getState();
  const upd = (k, v) => { g[k] = v; refresh(); engine.sim?.pic.inputsChanged(); };
  const setS = (fn) => { fn(S); refresh(); };
  const add = m => st.setActive([...active, m]);
  const pinTxt = (m, s) => wiring[m] && wiring[m][s] !== null && wiring[m][s] !== undefined ? pinName(wiring[m][s]) : 'non branché';
  const logf = Math.log10(Math.max(1, g.f));
  const M = [['Fréquence', 'f', fmtF], ['Période T', 'T', fmtT], ['Demi-période T/2', 'T', v => v == null ? '—' : fmtT(v / 2)], ['Largeur haut (+W)', 'Th', fmtT], ['Largeur bas (−W)', 'Tl', fmtT], ['Rapport cyclique', 'duty', v => v == null ? '—' : v.toFixed(1) + ' %'],
    ['Vmax', 'vmax', fmtV], ['Vmin', 'vmin', fmtV], ['Vcc (crête à crête)', 'vpp', fmtV], ['Vmoy', 'vmoy', fmtV]];
  return (
    <div className="tabbody">
      <div className="row between"><div className="k">OSCILLOSCOPE</div>{!active.includes('bnc') && <button className="btn sm" onClick={() => add('bnc')}>+ module BNC</button>}</div>
      <canvas ref={cv} width={640} height={384} className="scope" />
      <div className="scopectl">
        <label>Temps/div <select value={S.tdiv} onChange={e => setS(s => s.tdiv = +e.target.value)}>{TDIVS.map(t => <option key={t} value={t}>{fmtT(t)}</option>)}</select></label>
        <label>Déclenchement <select value={S.trigSrc} onChange={e => setS(s => s.trigSrc = e.target.value)}><option value="ch1">CH1</option><option value="ch2">CH2</option></select>
          <select value={S.trigEdge} onChange={e => setS(s => s.trigEdge = e.target.value)}><option value="up">front ↑</option><option value="down">front ↓</option></select></label>
        <button className={'btn sm' + (S.run ? ' ghost' : '')} onClick={() => setS(s => { s.run = !s.run; s.frozen = s.run ? null : s.lastT0; })}>{S.run ? '❚❚ Stop' : '▶ Run'}</button>
      </div>
      {['ch1', 'ch2'].map(ch => (
        <div key={ch} className="chrow">
          <b style={{ color: ch === 'ch1' ? '#b89a00' : '#1a9fb0' }}>{ch.toUpperCase()}</b>
          <select value={engine.bench.scopeSrc[ch]} onChange={e => { engine.bench.scopeSrc[ch] = e.target.value; refresh(); }}>
            <option value="pin">fil : {pinTxt('bnc', ch)}</option>{active.includes('dac') && <option value="dac">Vout MCP4921</option>}</select>
          <select value={S.vdiv[ch]} onChange={e => setS(s => s.vdiv[ch] = +e.target.value)}>{[0.5, 1, 2, 5].map(v => <option key={v} value={v}>{v} V/div</option>)}</select>
          <span className="mut small">position</span><button className="btn sm ghost" onClick={() => setS(s => s.pos[ch] -= 0.5)}>▼</button><button className="btn sm ghost" onClick={() => setS(s => s.pos[ch] += 0.5)}>▲</button>
        </div>))}
      <table className="meas"><thead><tr><th>Mesure</th><th style={{ color: '#b89a00' }}>CH1</th><th style={{ color: '#1a9fb0' }}>CH2</th></tr></thead>
        <tbody>{M.map(([l, k, f]) => <tr key={k}><td>{l}</td>{['ch1', 'ch2'].map(ch => <td key={ch} className="mono">{scopeStats[ch] ? f(scopeStats[ch][k]) : '—'}</td>)}</tr>)}</tbody></table>
      <div className="howto small"><b>Vérifier un timer :</b> si l'interruption inverse la broche (<code>TEST_PIN ^= 1</code>), il faut <b>2 interruptions</b> pour faire une période complète. Donc <b>intervalle du timer = T / 2</b> (= largeur haute pour un carré 50 %). Ex. : timer de 10 ms → T = 20 ms à l'oscillo.</div>
      <p className="mut small">Mesures de temps prises au seuil de 2,5 V sur les derniers fronts ; mesures de tension sur la fenêtre affichée.</p>
      <div className="row between" style={{ marginTop: 14 }}><div className="k">GBF</div>{!active.includes('gbf') && <button className="btn sm" onClick={() => add('gbf')}>+ GBF</button>}</div>
      <div className="gbf">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{[['square', '⊓ Carré TTL'], ['sine', '∿ Sinus'], ['triangle', '⋀ Triangle']].map(([k, l]) => <button key={k} className={'chip tog' + (g.wave === k ? ' on' : '')} onClick={() => upd('wave', k)}>{l}</button>)}</div>
        <div className="row" style={{ marginTop: 8 }}>
          <input type="range" min={0} max={4.7} step={0.001} value={logf} onChange={e => upd('f', Math.round(Math.pow(10, +e.target.value) * 100) / 100)} style={{ flex: 1 }} />
          <input type="number" min={0.1} max={50000} step="any" value={g.f} onChange={e => upd('f', Math.max(0.1, Math.min(50000, +e.target.value || 1)))} className="num" /> Hz
        </div>
        {g.wave === 'square' && <div className="row small" style={{ marginTop: 6 }}>Rapport cyclique <input type="range" min={0.05} max={0.95} step={0.05} value={g.duty} onChange={e => upd('duty', +e.target.value)} /> {Math.round(g.duty * 100)} %</div>}
        <p className="mut small">Sortie GBF ← {pinTxt('gbf', 'out')}. Le signal suit le temps simulé : avec la vitesse ×0,01 il ralentit aussi.</p>
      </div>
    </div>
  );
}

function Console() {
  const logs = useStore(s => s.logs);
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div className="term">
      <div className="termhd"><span>TERMINAL</span><button onClick={() => useStore.getState().clearLogs()}>EFFACER</button></div>
      <div className="termbody" ref={ref}>
        {!logs.length && <div className="log info">Appuie sur ▶ pour compiler et lancer le programme.</div>}
        {logs.map(l => <div key={l.id} className={'log ' + l.k}>{l.l ? <a onClick={() => gotoLine(l.l)}>L{l.l}</a> : <span className="nol" />}<span>{l.m}</span></div>)}
      </div>
    </div>
  );
}

export default function Panel() {
  const tab = useStore(s => s.tab), state = useStore(s => s.state), expanded = useStore(s => s.codeExpanded);
  const st = useStore.getState();
  const tabs = [['apercu', 'APERÇU'], ['cablage', 'CÂBLAGE'], ['instr', 'INSTRUMENTS'], ['debug', 'DEBUG'], ['memo', 'MÉMO']];
  const running = state === 'run' || state === 'pause';
  const lessonId = useStore(s => s.lessonId);
  const hasSol = !!(LESSONS.find(l => l.id === lessonId) || {}).solution;
  return (
    <aside className={'panel' + (expanded ? ' expanded' : '')}>
      {!expanded && <div className={'card tabs-card' + (tab === 'instr' || tab === 'debug' ? ' tall' : '')}>
        <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => useStore.setState({ tab: k })}>{l}</button>)}</div>
        {tab === 'apercu' && <Apercu />}{tab === 'cablage' && <Cablage />}{tab === 'instr' && <Instruments />}{tab === 'debug' && <Debug />}
        {tab === 'memo' && <div className="tabbody memo" dangerouslySetInnerHTML={{ __html: MEMO }} />}
      </div>}
      <div className="card code-card">
        <div className="codehd">
          <div><div className="k">À VOUS DE CODER</div><div className="fname">main.c · XC8</div></div>
          <div className="row">
            <label className="ib" title="Ouvrir un fichier .c de ton PC" style={{ display: 'grid', placeItems: 'center', cursor: 'pointer' }}>⇪<input type="file" accept=".c,.h,.txt" hidden onChange={async e => {
              const f = e.target.files[0]; if (!f) return; const buf = await f.arrayBuffer();
              let txt = new TextDecoder('utf-8').decode(buf); if (/\uFFFD/.test(txt)) txt = new TextDecoder('windows-1252').decode(buf);
              st.setCode(txt); st.log('info', `Fichier ${f.name} chargé. Vérifie le câblage (onglet Câblage) : il doit correspondre à l'en-tête de ton fichier.`); e.target.value = '';
            }} /></label>
            <button className="ib" title="Repartir du squelette" onClick={() => useStore.setState({ modal: 'reset' })}>↺</button>
            {hasSol && <button className="solbtn" title="Voir un exemple de solution" onClick={() => useStore.setState({ modal: 'solution' })}>💡 Solution</button>}
            <button className="ib" title="Copier" onClick={async () => { try { await navigator.clipboard.writeText(useStore.getState().code); useStore.setState({ toast: 'Code copié' }); setTimeout(() => useStore.setState({ toast: null }), 1500); } catch (e) { } }}>⧉</button>
            <button className="ib" title={expanded ? 'Réduire' : 'Agrandir l\'éditeur'} onClick={() => useStore.setState({ codeExpanded: !expanded })}>{expanded ? '⤡' : '⤢'}</button>
            {running && <button className="ib" title="Pause" onClick={() => st.togglePause()}>{state === 'pause' ? '▶' : '❚❚'}</button>}
            {running && <button className="ib" title="Arrêter" onClick={() => st.halt()}>■</button>}
            <button className="run" title="Compiler et lancer (Ctrl+Entrée)" onClick={() => st.compileRun()}>▶ {running ? 'Relancer' : 'Lancer'}</button>
          </div>
        </div>
        <div className="editor"><CodeEditor /></div>
        <Console />
      </div>
    </aside>
  );
}

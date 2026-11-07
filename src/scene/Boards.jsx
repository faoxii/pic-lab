import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, RoundedBox, Edges } from '@react-three/drei';
import { useStore, engine, pinName } from '../state.js';
import { PIC, PIC_PORTS, MODS, P, TOP, SIG_LABEL } from '../layout.js';
import { picTexture, modTexture, makeLcd, labelTexture } from '../textures.js';
import { drawScope, fmtF } from '../scope.js';
import { Pcb, HeaderPin, RibbonConn, Box, INK } from './parts.jsx';
import { pick, targets } from '../interact.js';
import PICM from '../engine/machine.js';
const { PORTS, PMASK, KEY_LAYOUTS } = PICM;

function pinStateText(p) {
  const sim = engine.sim; if (!sim) return 'simulation arrêtée';
  const pic = sim.pic, P_ = p >> 3, b = p & 7;
  if (pic.tris[P_] >> b & 1) { if (pic.isAnalog(p)) return 'entrée analogique'; const v = engine.bench.extLevel(p, pic); return `entrée, lue ${v === null ? '0 (rien de branché)' : v}`; }
  return `sortie à ${pic.lat[P_] >> b & 1}`;
}
// ---------------- Carte processeur ----------------
export function PicBoard() {
  const tex = useMemo(() => picTexture(), []);
  const wv = useStore(s => s.wv);
  const pending = useStore(s => s.pending);
  const leds = useRef({});
  const powerLed = useRef();
  const chipTex = useMemo(() => labelTexture('PIC18F452-I/P', { bg: '#151515', fg: '#cfcfcf', size: 34 }), []);
  const kitTex = useMemo(() => labelTexture('MPLAB PICkit 4', { bg: '#c9ccd0', fg: '#c0262e', size: 34 }), []);
  const pins = []; PORTS.forEach((P_, i) => { for (let b = 0; b < 8; b++) if (PMASK[i] >> b & 1) pins.push(i * 8 + b); });
  const wantPin = pending && pending.type === 'mod';
  const wantConn = pending && pending.type === 'mconn';
  useFrame(() => {
    const sim = engine.sim, pic = sim && sim.pic, B = engine.bench;
    for (const p of pins) {
      const m = leds.current[p]; if (!m) continue;
      let c = '#2a1410', e = 0, ec = '#000';
      if (pic) {
        const P_ = p >> 3, b = p & 7;
        if (pic.tris[P_] >> b & 1) { if (pic.isAnalog(p)) { c = '#5a4410'; } else { const v = B.extLevel(p, pic); const lv = v === null ? ((P_ === 1 && !(pic.reg.INTCON2 & 0x80)) ? 1 : 0) : v; if (lv) { c = '#4b8cff'; e = 1.2; ec = '#4b8cff'; } else c = '#14243c'; } }
        else if (pic.lat[P_] >> b & 1) { c = '#ff4a2a'; e = 1.6; ec = '#ff3a1a'; } else c = '#4a1612';
      }
      m.color.set(c); m.emissive.set(ec); m.emissiveIntensity = e;
    }
    if (powerLed.current) powerLed.current.emissiveIntensity = 2.2;
  });
  const sel0 = () => useStore.setState({ selected: { title: 'Module Processor PIC 18F452', desc: 'Microcontrôleur PIC18F452 (40 broches, 8 bits). Quartz HS, régulateur 5 V, connecteur PICkit pour la programmation. Les ports A à E sont accessibles par des barrettes (fils) et des connecteurs blancs (nappes 8 fils). Chaque broche a une LED : rouge = sortie à 1, bleu = entrée lue à 1, orange foncé = analogique.' }, tab: 'apercu' });
  return (
    <group>
      <Pcb w={PIC.w} d={PIC.d} texture={tex} />
      {/* barrettes + LED d'état */}
      {pins.map(p => {
        const P_ = PORTS[p >> 3], b = p & 7, h = PIC_PORTS[P_], x = h.x0 + b * P, z = h.z;
        const ledZ = z + (z < 0 ? 1.05 : -1.05);
        return (
          <group key={p}>
            <HeaderPin x={x} z={z} id={`pic:${p}`} glow={wantPin} hint={() => `${pinName(p)} — ${pinStateText(p)}${(engine.bench.byPin[p] || []).length ? ' · reliée à ' + engine.bench.byPin[p].map(([m, s]) => SIG_LABEL(s)).join(', ') : ''}`} onPick={() => pick(targets.pic(p))} />
            <mesh position={[x, TOP + 0.06, ledZ]}>
              <cylinderGeometry args={[0.15, 0.15, 0.12, 12]} />
              <meshStandardMaterial ref={el => leds.current[p] = el} color="#2a1410" />
            </mesh>
          </group>
        );
      })}
      {/* connecteurs nappe */}
      {PORTS.map((P_, i) => {
        const c = PIC_PORTS[P_].conn; let n = 0; for (let b = 0; b < 8; b++) if (PMASK[i] >> b & 1) n++;
        return <RibbonConn key={P_} x={c.x} z={c.z} n={n} id={`pconn:${i}`} glow={wantConn && n === 8} hint={() => `Connecteur nappe PORT${P_}${n < 8 ? ` (${n} broches)` : ''}`} onPick={() => pick(targets.pconn(i))} />;
      })}
      {/* puce DIP40 */}
      <group position={[-1.6, TOP, -0.2]}>
        <Box args={[5.8, 0.5, 1.7]} position={[0, 0.3, 0]} color="#161616" />
        <mesh position={[0, 0.56, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[3.6, 3.6 / chipTex.aspect]} /><meshBasicMaterial map={chipTex.texture} /></mesh>
        <mesh position={[-2.6, 0.56, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.18, 16]} /><meshBasicMaterial color="#333" /></mesh>
        {Array.from({ length: 20 }, (_, i) => [-2.7 + i * 0.284]).flatMap(([x], i) => [
          <mesh key={'a' + i} position={[x, 0.12, 0.92]}><boxGeometry args={[0.12, 0.24, 0.22]} /><meshStandardMaterial color="#c8cdd2" metalness={0.8} roughness={0.3} /></mesh>,
          <mesh key={'b' + i} position={[x, 0.12, -0.92]}><boxGeometry args={[0.12, 0.24, 0.22]} /><meshStandardMaterial color="#c8cdd2" metalness={0.8} roughness={0.3} /></mesh>])}
      </group>
      {/* quartz, condensateurs, régulateur, LED, borniers */}
      <RoundedBox args={[1.2, 0.45, 0.5]} radius={0.2} position={[-6.4, TOP + 0.25, -1.0]}><meshStandardMaterial color="#d9dde0" metalness={0.85} roughness={0.25} /></RoundedBox>
      {[[-7.6, -1.0], [-5.2, -1.0]].map(([x, z], i) => <mesh key={i} position={[x, TOP + 0.2, z]}><sphereGeometry args={[0.2, 12, 8]} /><meshStandardMaterial color="#e2a63b" /></mesh>)}
      <Box args={[1, 0.25, 0.4]} position={[-1.6, TOP + 0.13, 1.4]} color="#2f6fd0" />
      <group position={[6.2, TOP, 0.9]}>
        <Box args={[1.1, 0.9, 0.5]} position={[0, 0.45, 0]} color="#1a1a1a" />
        <Box args={[1.1, 0.9, 0.1]} position={[0, 0.55, -0.3]} color="#c9ccd0" metal={0.8} rough={0.3} />
      </group>
      <mesh position={[7.6, TOP + 0.3, -0.6]}><sphereGeometry args={[0.25, 16, 12]} /><meshStandardMaterial ref={powerLed} color="#3b7bff" emissive="#3b7bff" emissiveIntensity={2} /></mesh>
      <Box args={[0.9, 0.35, 0.5]} position={[5.6, TOP + 0.2, -0.7]} color="#d8d8d8" />
      <Box args={[1.4, 0.8, 1.1]} position={[7.8, TOP + 0.4, 3.0]} color="#4fbf8a" />
      <Box args={[1.4, 0.8, 1.1]} position={[7.8, TOP + 0.4, 4.4]} color="#ef8a2c" />
      {/* PICkit */}
      <group position={[11.8, 0, -3.0]}>
        <Box args={[2.4, 0.9, 4.6]} position={[0, 0.45, 0]} color="#c9ccd0" metal={0.6} rough={0.35} />
        <mesh position={[0, 0.91, 0.3]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}><planeGeometry args={[3.6, 3.6 / kitTex.aspect]} /><meshBasicMaterial map={kitTex.texture} /></mesh>
        <Box args={[1.6, 0.3, 0.6]} position={[-1.5, TOP + 0.1, 0]} color="#151515" />
      </group>
    </group>
  );
}

// ---------------- Modules ----------------
const SEG_RECTS = [ // [x, z, w, d] dans un afficheur 1.8 × 2.9 (a b c d e f g dp)
  [0, -1.2, 1.0, 0.2], [0.6, -0.6, 0.2, 1.0], [0.6, 0.6, 0.2, 1.0], [0, 1.2, 1.0, 0.2], [-0.6, 0.6, 0.2, 1.0], [-0.6, -0.6, 0.2, 1.0], [0, 0, 1.0, 0.2], [0.85, 1.25, 0.22, 0.22],
];
function Seg7Visual() {
  const mats = useRef([]);
  const last = useRef({ C: -1, b: null });
  useFrame(() => {
    const sim = engine.sim; let b = last.current.b;
    if (sim && sim.pic.S.C !== last.current.C) { b = engine.bench.segFrame(sim.pic.S.C); last.current = { C: sim.pic.S.C, b }; }
    for (let d = 0; d < 4; d++) for (let k = 0; k < 8; k++) {
      const m = mats.current[d * 8 + k]; if (!m) continue;
      // luminosité proportionnelle au temps allumé (100 % = allumé en continu, 25 % = multiplexage 4 afficheurs normal)
      const duty = sim && b ? b[d][k] : 0; const vis = Math.min(1, duty * 4);
      m.emissiveIntensity = vis < 0.004 ? 0 : 0.08 + 2.7 * Math.pow(vis, 0.9);
      m.color.set(vis < 0.004 ? '#3a0f0a' : vis < 0.35 ? '#8a2014' : '#ff3a22');
    }
  });
  return (
    <group>
      {[0, 1, 2, 3].map(d => (
        <group key={d} position={[-3.3 + d * 2.2, TOP, 1.3]}>
          <Box args={[2.05, 0.7, 3.4]} position={[0, 0.35, 0]} color="#1b1b1b" />
          {SEG_RECTS.map(([x, z, w, dd], k) => (
            <mesh key={k} position={[x, 0.71, z]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[w, dd]} />
              <meshStandardMaterial ref={el => mats.current[d * 8 + k] = el} color="#3a0f0a" emissive="#ff2a12" emissiveIntensity={0} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      {[0, 1, 2, 3].map(i => (
        <mesh key={'t' + i} position={[2.0 + i * 0.9, TOP + 0.3, -1.3]}><cylinderGeometry args={[0.32, 0.32, 0.6, 16]} /><meshStandardMaterial color="#cfd3d6" metalness={0.85} roughness={0.25} /></mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={'r' + i} position={[-5.0 + i * 0.6, TOP + 0.14, -1.3]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.1, 0.1, 0.7, 8]} /><meshStandardMaterial color="#d9c49a" /></mesh>
      ))}
    </group>
  );
}
function LcdVisual() {
  const lcd = useMemo(() => makeLcd(), []);
  useFrame(() => { lcd.draw(engine.bench.lcd, !!engine.sim); });
  return (
    <group position={[0, TOP, 1.1]}>
      <Box args={[11.8, 0.6, 4.6]} position={[0, 0.3, 0]} color="#16261a" />
      <mesh position={[0, 0.61, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[10.6, 10.6 * lcd.texture.image.height / lcd.texture.image.width]} /><meshBasicMaterial map={lcd.texture} toneMapped={false} /></mesh>
      <mesh position={[5.3, 0.2, -2.9]}><cylinderGeometry args={[0.3, 0.3, 0.4, 16]} /><meshStandardMaterial color="#2f6fd0" /></mesh>
    </group>
  );
}
function useHold() {
  const controls = useThree(s => s.controls);
  return (on) => { if (controls) controls.enabled = !on; };
}
const keyTexCache = {};
function KeypadVisual() {
  const layout = KEY_LAYOUTS.std;
  const refs = useRef({});
  const hold = useHold();
  useFrame(() => { for (const k in refs.current) { const m = refs.current[k]; if (m) m.position.y = TOP + (engine.bench.keys.has(k) ? 0.18 : 0.32); } });
  return (
    <group>
      <Box args={[8.2, 0.25, 8.2]} position={[0, TOP + 0.12, 1.1]} color="#232323" />
      {layout.flatMap((rowK, r) => rowK.map((lab, c) => {
        const k = r + ',' + c; const tx = keyTexCache[lab] || (keyTexCache[lab] = labelTexture(lab, { bg: '#2c2c2c', fg: '#f2f2f2', size: 60 }));
        const down = e => { e.stopPropagation(); engine.bench.keys.add(k); hold(true); e.target.setPointerCapture?.(e.pointerId); engine.sim?.pic.inputsChanged(); };
        const up = e => { engine.bench.keys.delete(k); hold(false); engine.sim?.pic.inputsChanged(); };
        return (
          <group key={k} ref={el => refs.current[k] = el} position={[-2.85 + c * 1.9, TOP + 0.32, -1.75 + r * 1.9]}>
            <RoundedBox args={[1.6, 0.4, 1.6]} radius={0.12} onPointerDown={down} onPointerUp={up} onPointerLeave={up}
              onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = ''}>
              <meshStandardMaterial color="#2c2c2c" roughness={0.5} />
            </RoundedBox>
            <mesh position={[0, 0.205, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.8 * tx.aspect, 0.8]} /><meshBasicMaterial map={tx.texture} transparent /></mesh>
          </group>
        );
      }))}
    </group>
  );
}
function ButtonsVisual() {
  const caps = useRef([]); const hold = useHold();
  useFrame(() => caps.current.forEach((m, i) => { if (m) m.position.y = TOP + (engine.bench.bp[i] ? 0.55 : 0.75); }));
  return (
    <group>
      {[0, 1, 2, 3].map(i => {
        const down = e => { e.stopPropagation(); engine.bench.bp[i] = 1; hold(true); e.target.setPointerCapture?.(e.pointerId); engine.sim?.pic.inputsChanged(); };
        const up = () => { if (!engine.bench.bp[i]) return; engine.bench.bp[i] = 0; hold(false); engine.sim?.pic.inputsChanged(); };
        return (
          <group key={i} position={[-2.7 + i * 1.8, 0, 0.9]}>
            <Box args={[1.4, 0.45, 1.4]} position={[0, TOP + 0.22, 0]} color="#1c1c1c" />
            <mesh ref={el => caps.current[i] = el} position={[0, TOP + 0.75, 0]} onPointerDown={down} onPointerUp={up} onPointerLeave={up}
              onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = ''}>
              <cylinderGeometry args={[0.55, 0.6, 0.5, 24]} /><meshStandardMaterial color="#b9bcbf" metalness={0.5} roughness={0.35} />
              <Edges color={INK} threshold={30} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
function SwitchesVisual() {
  const levers = useRef([]);
  useFrame(() => levers.current.forEach((m, i) => { if (m) { const t = engine.bench.sw[i] ? -0.5 : 0.5; m.rotation.x += (t - m.rotation.x) * 0.3; } }));
  return (
    <group>
      {[0, 1, 2, 3].map(i => (
        <group key={i} position={[-2.7 + i * 1.8, 0, 0.9]}>
          <Box args={[0.9, 0.6, 1.6]} position={[0, TOP + 0.3, 0]} color="#e04a28" />
          <group ref={el => levers.current[i] = el} position={[0, TOP + 0.6, 0]}>
            <mesh position={[0, 0.45, 0]} onClick={e => { e.stopPropagation(); engine.bench.sw[i] ^= 1; engine.sim?.pic.inputsChanged(); useStore.setState({ wv: useStore.getState().wv + 1 }); }}
              onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = ''}>
              <boxGeometry args={[0.5, 0.9, 0.5]} /><meshStandardMaterial color="#f4f4f4" /><Edges color={INK} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
function PotsVisual() {
  const knobs = useRef([]); const hold = useHold(); const drag = useRef(null);
  useFrame(() => knobs.current.forEach((m, i) => { if (m) m.rotation.y = -(-135 + engine.bench.pot[i] / 5 * 270) * Math.PI / 180; }));
  return (
    <group>
      {[0, 1, 2, 3].map(i => (
        <group key={i} position={[-2.7 + i * 1.8, TOP, 0.9]}>
          <Box args={[1.3, 0.4, 1.3]} position={[0, 0.2, 0]} color="#2f6fd0" />
          <group ref={el => knobs.current[i] = el} position={[0, 0.4, 0]}>
            <mesh position={[0, 0.3, 0]}
              onPointerDown={e => { e.stopPropagation(); drag.current = { i, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, v: engine.bench.pot[i] }; hold(true); e.target.setPointerCapture?.(e.pointerId); }}
              onPointerMove={e => { const d = drag.current; if (!d || d.i !== i) return; const dv = ((e.nativeEvent.clientX - d.x) - (e.nativeEvent.clientY - d.y)) / 80; engine.bench.pot[i] = Math.max(0, Math.min(5, d.v + dv)); engine.sim?.pic.inputsChanged(); useStore.setState({ hover: { id: 'pot' + i, text: `POT${i} = ${engine.bench.pot[i].toFixed(2)} V`, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }); }}
              onPointerUp={() => { drag.current = null; hold(false); useStore.setState({ hover: null }); }}
              onPointerOver={e => { document.body.style.cursor = 'grab'; useStore.setState({ hover: { id: 'pot' + i, text: `POT${i} = ${engine.bench.pot[i].toFixed(2)} V — glisse pour tourner`, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }); }}
              onPointerOut={() => { document.body.style.cursor = ''; if (!drag.current) useStore.setState({ hover: null }); }}>
              <cylinderGeometry args={[0.55, 0.6, 0.6, 24]} /><meshStandardMaterial color="#e8e8e8" /><Edges color={INK} threshold={30} />
            </mesh>
            <mesh position={[0, 0.61, -0.3]}><boxGeometry args={[0.1, 0.02, 0.5]} /><meshBasicMaterial color="#d23a2a" /></mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

function GbfVisual() {
  const disp = useMemo(() => { const c = document.createElement('canvas'); c.width = 512; c.height = 160; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, t, key: '' }; }, []);
  useFrame(() => {
    const g = engine.bench.gbf, k = g.f + g.wave + g.duty; if (k === disp.key) return; disp.key = k;
    const x = disp.c.getContext('2d'); x.fillStyle = '#0d1f2a'; x.fillRect(0, 0, 512, 160);
    x.fillStyle = '#5fe0ff'; x.font = '700 72px "JetBrains Mono", monospace'; x.fillText(fmtF(g.f), 24, 92);
    x.font = '600 34px "JetBrains Mono", monospace'; x.fillStyle = '#8fb8c8'; x.fillText({ square: '⊓ CARRÉ TTL', sine: '∿ SINUS 0-5V', triangle: '⋀ TRIANGLE' }[g.wave], 24, 140);
    disp.t.needsUpdate = true;
  });
  return (
    <group position={[0, TOP, -0.6]}>
      <Box args={[8, 3, 4.6]} position={[0, 1.5, 0]} color="#e8e2d2" />
      <mesh position={[-1.4, 2.0, 2.31]}><planeGeometry args={[4.4, 1.375]} /><meshBasicMaterial map={disp.t} toneMapped={false} /></mesh>
      <mesh position={[2.4, 2.0, 2.4]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.6, 0.6, 0.35, 24]} /><meshStandardMaterial color="#333" /></mesh>
      <mesh position={[2.4, 0.8, 2.4]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.32, 0.32, 0.4, 16]} /><meshStandardMaterial color="#c9ccd0" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[-2.6, 0.8, 2.35]}><boxGeometry args={[2.2, 0.4, 0.12]} /><meshStandardMaterial color="#2f6fd0" /></mesh>
    </group>
  );
}
function ScopeVisual() {
  const scr = useMemo(() => { const c = document.createElement('canvas'); c.width = 640; c.height = 384; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, t, last: 0 }; }, []);
  useFrame(() => { const n = performance.now(); if (n - scr.last < 70) return; scr.last = n; drawScope(scr.c, useStore.getState().scope, true); scr.t.needsUpdate = true; });
  return (
    <group>
      <group position={[0, TOP, -1.3]}>
        <Box args={[11, 5.4, 4.8]} position={[0, 2.7, 0]} color="#d9d6cc" />
        <mesh position={[-1.3, 2.9, 2.41]}><planeGeometry args={[6.5, 3.9]} /><meshBasicMaterial map={scr.t} toneMapped={false} /></mesh>
        {[[3.4, 3.9], [4.5, 3.9], [3.4, 2.6], [4.5, 2.6]].map(([x, y], i) => <mesh key={i} position={[x, y, 2.45]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.38, 0.38, 0.3, 20]} /><meshStandardMaterial color="#2b2b2b" /></mesh>)}
        {[3.4, 4.5].map((x, i) => <mesh key={'b' + i} position={[x, 1.2, 2.5]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.3, 0.3, 0.4, 16]} /><meshStandardMaterial color={i ? '#3fd6e8' : '#f2d230'} metalness={0.4} /></mesh>)}
      </group>
      {[-1.6, 1.6].map((x, i) => <mesh key={i} position={[x, TOP + 0.35, 2.3]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.35, 0.35, 0.7, 16]} /><meshStandardMaterial color="#c9ccd0" metalness={0.85} roughness={0.25} /></mesh>)}
    </group>
  );
}
function BuzzerVisual() {
  const ring = useRef();
  useFrame(() => { const f = engine.sim ? engine.bench.buzFreq(engine.sim.pic) : 0; if (ring.current) { ring.current.emissiveIntensity = f > 0 ? 0.6 + 0.4 * Math.sin(performance.now() / 40) : 0; } });
  return (
    <group position={[0, TOP, 0.8]}>
      <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[1.3, 1.3, 1, 32]} /><meshStandardMaterial color="#1a1a1a" /><Edges color={INK} threshold={30} /></mesh>
      <mesh position={[0, 1.01, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.15, 0.32, 24]} /><meshStandardMaterial ref={ring} color="#333" emissive="#ffb020" emissiveIntensity={0} /></mesh>
    </group>
  );
}
function DacVisual() {
  const tx = useMemo(() => labelTexture('MCP4921', { bg: '#151515', fg: '#d0d0d0', size: 34 }), []);
  const v = useRef();
  useFrame(() => { if (v.current) { const h = 0.05 + engine.bench.dac.vout / 5 * 1.6; v.current.scale.y = h; v.current.position.y = h / 2; } });
  return (
    <group position={[0, TOP, 0.6]}>
      <Box args={[2.4, 0.45, 1.3]} position={[-1, 0.22, 0]} color="#151515" />
      <mesh position={[-1, 0.46, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[2, 2 / tx.aspect]} /><meshBasicMaterial map={tx.texture} /></mesh>
      {Array.from({ length: 4 }, (_, i) => [-1.9 + i * 0.6]).flatMap(([x], i) => [
        <mesh key={'a' + i} position={[x, 0.1, 0.72]}><boxGeometry args={[0.12, 0.2, 0.2]} /><meshStandardMaterial color="#c8cdd2" metalness={0.8} /></mesh>,
        <mesh key={'b' + i} position={[x, 0.1, -0.72]}><boxGeometry args={[0.12, 0.2, 0.2]} /><meshStandardMaterial color="#c8cdd2" metalness={0.8} /></mesh>])}
      <group position={[2.4, 0, 0]}><mesh ref={v} position={[0, 0, 0]}><boxGeometry args={[0.6, 1, 0.6]} /><meshStandardMaterial color="#2fd4bd" emissive="#2fd4bd" emissiveIntensity={0.6} /></mesh></group>
    </group>
  );
}
export function ModuleBoard({ m, slot }) {
  const M = MODS[m];
  const tex = useMemo(() => modTexture(m), [m]);
  useStore(s => s.wv);
  const pending = useStore(s => s.pending);
  const wantPin = pending && pending.type === 'pic';
  const wantConn = pending && pending.type === 'pconn';
  const Visual = { seg7: Seg7Visual, lcd: LcdVisual, keypad: KeypadVisual, buttons: ButtonsVisual, switches: SwitchesVisual, pots: PotsVisual, gbf: GbfVisual, bnc: ScopeVisual, buzzer: BuzzerVisual, dac: DacVisual }[m];
  return (
    <group position={[slot.x, 0, slot.z]} rotation-y={slot.r}>
      <Pcb w={M.w} d={M.d} texture={tex} />
      {Object.entries(M.pins).map(([s, [x, z]]) => (
        <HeaderPin key={s} x={x} z={z} id={`mod:${m}:${s}`} glow={wantPin}
          hint={() => { const p = engine.bench.wiring[m][s]; return `${SIG_LABEL(s)} (${M.title.replace('Module ', '')}) — ${p === null ? 'non branché : clique puis choisis une broche du PIC' : 'relié à ' + pinName(p) + ' · clic pour débrancher'}`; }}
          onPick={() => pick(targets.mod(m, s))} />
      ))}
      {Object.entries(M.ribbons).map(([g, r]) => (
        <RibbonConn key={g} x={r.x} z={r.z} n={8} id={`mconn:${m}:${g}`} glow={wantConn}
          hint={() => { const p = useStore.getState().ribbons[m + '.' + g]; return `Nappe ${r.label} — ${p === undefined ? 'clique puis choisis un connecteur blanc du PIC' : 'branchée sur PORT' + PORTS[p] + ' · clic pour débrancher'}`; }}
          onPick={() => pick(targets.mconn(m, g))} />
      ))}
      <Visual />
    </group>
  );
}

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useStore, engine, pinName } from '../state.js';
import { MODS, placements, WIRE_COLORS, RIBBON_COLORS, SIG_LABEL } from '../layout.js';
import { modPinWorld, picPinWorld, modConnWorld, picConnWorld } from '../interact.js';

export const pointer = new THREE.Vector3(0, 0, 0);

function curveBetween(a, b, lift = 1.2) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const dist = A.distanceTo(B);
  const up = new THREE.Vector3(0, lift, 0);
  const mid = A.clone().lerp(B, 0.5).add(new THREE.Vector3(0, 1.4 + dist * 0.12, 0));
  return new THREE.CatmullRomCurve3([A, A.clone().add(up), mid, B.clone().add(up), B], false, 'centripetal');
}
const plugGeo = new THREE.BoxGeometry(0.34, 0.75, 0.34);
const plugMat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.5 });

function Wire({ a, b, color, onRemove, label }) {
  const geo = useMemo(() => new THREE.TubeGeometry(curveBetween([a[0], a[1] + 0.35, a[2]], [b[0], b[1] + 0.35, b[2]]), 64, 0.075, 8, false), [a, b]);
  const [hov, setHov] = [useStore(s => s.hover && s.hover.id === 'w:' + label), null];
  return (
    <group>
      <mesh geometry={geo} castShadow
        onPointerOver={e => { e.stopPropagation(); document.body.style.cursor = 'pointer'; useStore.setState({ hover: { id: 'w:' + label, text: `${label} · clic pour retirer le fil`, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }); }}
        onPointerOut={() => { document.body.style.cursor = ''; if (useStore.getState().hover?.id === 'w:' + label) useStore.setState({ hover: null }); }}
        onClick={e => { e.stopPropagation(); useStore.setState({ hover: null }); onRemove(); }}>
        <meshStandardMaterial color={color} roughness={0.45} emissive={hov ? color : '#000'} emissiveIntensity={hov ? 0.5 : 0} />
      </mesh>
      <mesh geometry={plugGeo} material={plugMat} position={[a[0], a[1] + 0.2, a[2]]} />
      <mesh geometry={plugGeo} material={plugMat} position={[b[0], b[1] + 0.2, b[2]]} />
    </group>
  );
}

function Ribbon({ a, b, axA, axB, onRemove, label }) {
  const geos = useMemo(() => RIBBON_COLORS.map((_, i) => {
    const o = (i - 3.5) * 0.15;
    const A = [a[0] + axA[0] * o, a[1] + 0.3, a[2] + axA[2] * o], B = [b[0] + axB[0] * o, b[1] + 0.3, b[2] + axB[2] * o];
    return new THREE.TubeGeometry(curveBetween(A, B, 0.9), 64, 0.075, 6, false);
  }), [a, b, axA, axB]);
  const hov = useStore(s => s.hover && s.hover.id === 'r:' + label);
  const ev = {
    onPointerOver: e => { e.stopPropagation(); document.body.style.cursor = 'pointer'; useStore.setState({ hover: { id: 'r:' + label, text: `Nappe ${label} · clic pour la retirer`, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }); },
    onPointerOut: () => { document.body.style.cursor = ''; if (useStore.getState().hover?.id === 'r:' + label) useStore.setState({ hover: null }); },
    onClick: e => { e.stopPropagation(); useStore.setState({ hover: null }); onRemove(); },
  };
  const idc = (p, ax) => <mesh position={[p[0], p[1] + 0.2, p[2]]} rotation-y={Math.atan2(-ax[2], ax[0])}><boxGeometry args={[1.5, 0.45, 0.75]} /><meshStandardMaterial color="#6b6e72" /></mesh>;
  return (
    <group>
      {geos.map((g, i) => <mesh key={i} geometry={g} {...ev}><meshStandardMaterial color={RIBBON_COLORS[i]} roughness={0.5} emissive={hov ? '#ffffff' : '#000'} emissiveIntensity={hov ? 0.15 : 0} /></mesh>)}
      {idc(a, axA)}{idc(b, axB)}
    </group>
  );
}

function PendingWire() {
  const pending = useStore(s => s.pending);
  const mesh = useRef();
  useFrame(() => {
    if (!pending || !mesh.current) return;
    const a = pending.pos, b = [pointer.x, Math.max(1.2, pointer.y + 0.8), pointer.z];
    const g = new THREE.TubeGeometry(curveBetween([a[0], a[1] + 0.35, a[2]], b, 0.8), 40, pending.type.includes('conn') ? 0.3 : 0.075, 8, false);
    mesh.current.geometry.dispose(); mesh.current.geometry = g;
  });
  if (!pending) return null;
  return <mesh ref={mesh} raycast={() => null}><tubeGeometry /><meshStandardMaterial color="#ffb020" transparent opacity={0.85} emissive="#ffb020" emissiveIntensity={0.3} /></mesh>;
}

export function Wires() {
  const active = useStore(s => s.active);
  const wiring = useStore(s => s.wiring);
  const ribbons = useStore(s => s.ribbons);
  const disconnect = useStore(s => s.disconnect), disconnectRibbon = useStore(s => s.disconnectRibbon);
  const pl = placements(active);
  const items = [];
  let ci = 0;
  for (const m of active) {
    if (!wiring[m]) continue;
    const covered = new Set();
    for (const [g, r] of Object.entries(MODS[m].ribbons)) {
      const port = ribbons[m + '.' + g]; if (port === undefined) continue;
      r.sigs.forEach(s => covered.add(s));
      const sl = pl[m]; const axA = [Math.cos(sl.r), 0, -Math.sin(sl.r)];
      items.push(<Ribbon key={'r' + m + g} a={modConnWorld(m, g, active)} b={picConnWorld(port)} axA={axA} axB={[1, 0, 0]} label={`${r.label} → PORT${'ABCDE'[port]}`} onRemove={() => disconnectRibbon(m, g)} />);
    }
    for (const s of Object.keys(MODS[m].pins)) {
      const p = wiring[m][s]; if (p === null || p === undefined || covered.has(s)) { ci++; continue; }
      items.push(<Wire key={'w' + m + s + p} a={modPinWorld(m, s, active)} b={picPinWorld(p)} color={WIRE_COLORS[(ci++) % WIRE_COLORS.length]} label={`${SIG_LABEL(s)} → ${pinName(p)}`} onRemove={() => disconnect(m, s)} />);
    }
  }
  if (active.includes('gbf') && active.includes('bnc')) for (const ch of ['ch1', 'ch2']) if (engine.bench.scopeSrc[ch] === 'gbf')
    items.push(<Wire key={'gd' + ch} a={modPinWorld('gbf', 'out', active)} b={modPinWorld('bnc', ch, active)} color={ch === 'ch1' ? '#f2c230' : '#1fb5a8'} label={`GBF → ${ch.toUpperCase()}`} onRemove={() => useStore.getState().disconnectDirect(ch)} />);
  return <group>{items}<PendingWire /></group>;
}

// Briques 3D réutilisables : PCB, barrettes, connecteurs nappe
import { useMemo } from 'react';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';
import { BOARD_Y, BOARD_T, TOP, HDR_H, P } from '../layout.js';
import { useStore } from '../state.js';

export const INK = '#1b1a17';
export function Pcb({ w, d, texture }) {
  const mats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: '#17432b', roughness: 0.8 });
    const top = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75 });
    return [side, side, top, side, side, side];
  }, [texture]);
  const feet = [[-w / 2 + 0.6, -d / 2 + 0.6], [w / 2 - 0.6, -d / 2 + 0.6], [-w / 2 + 0.6, d / 2 - 0.6], [w / 2 - 0.6, d / 2 - 0.6]];
  return (
    <group>
      <mesh position={[0, BOARD_Y + BOARD_T / 2, 0]} material={mats} castShadow receiveShadow>
        <boxGeometry args={[w, BOARD_T, d]} />
        <Edges color={INK} threshold={20} />
      </mesh>
      {feet.map(([x, z], i) => (
        <mesh key={i} position={[x, BOARD_Y / 2, z]}>
          <cylinderGeometry args={[0.28, 0.28, BOARD_Y, 6]} />
          <meshStandardMaterial color="#b7a46a" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

const hdrGeo = new THREE.BoxGeometry(P * 0.92, HDR_H, P * 0.92);
const hdrMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.6 });
const holeGeo = new THREE.PlaneGeometry(0.18, 0.18);
const holeMat = new THREE.MeshBasicMaterial({ color: '#000' });
const hitGeo = new THREE.BoxGeometry(P * 0.95, 1.1, P * 0.95);
// barrette triple (3 trous reliés = 3 fils possibles sur la même broche), comme sur la carte PIC
const hdr3Geo = new THREE.BoxGeometry(P * 0.92, HDR_H, P * 2.92);
const hit3Geo = new THREE.BoxGeometry(P * 0.95, 1.1, P * 2.95);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const ringGeo = new THREE.RingGeometry(0.33, 0.43, 24);

// Une broche de barrette femelle cliquable
export function HeaderPin({ x, z, id, hint, onPick, glow, triple }) {
  const hovered = useStore(s => s.hover && s.hover.id === id);
  const pending = useStore(s => s.pending);
  const isFrom = pending && pending.id === id;
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={triple ? hdr3Geo : hdrGeo} material={hdrMat} position={[0, TOP + HDR_H / 2, 0]} />
      {(triple ? [-P, 0, P] : [0]).map(dz => <mesh key={dz} geometry={holeGeo} material={holeMat} position={[0, TOP + HDR_H + 0.002, dz]} rotation-x={-Math.PI / 2} />)}
      {(hovered || isFrom || glow) && (
        <mesh geometry={ringGeo} position={[0, TOP + HDR_H + 0.02, 0]} rotation-x={-Math.PI / 2}>
          <meshBasicMaterial color={isFrom ? '#ffb020' : glow ? '#7fe0d0' : '#2fd4bd'} transparent opacity={glow && !hovered ? 0.55 : 1} />
        </mesh>
      )}
      <mesh geometry={triple ? hit3Geo : hitGeo} material={hitMat} position={[0, TOP + 0.45, 0]}
        onPointerOver={e => { e.stopPropagation(); useStore.setState({ hover: { id, text: hint(), x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }); document.body.style.cursor = 'pointer'; }}
        onPointerMove={e => { const h = useStore.getState().hover; if (h && h.id === id) useStore.setState({ hover: { ...h, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }); }}
        onPointerOut={() => { if (useStore.getState().hover?.id === id) useStore.setState({ hover: null }); document.body.style.cursor = ''; }}
        onClick={e => { e.stopPropagation(); onPick(); }} />
    </group>
  );
}

// Connecteur nappe (blanc) cliquable
export function RibbonConn({ x, z, n, id, hint, onPick, label, glow }) {
  const hovered = useStore(s => s.hover && s.hover.id === id);
  const pending = useStore(s => s.pending);
  const isFrom = pending && pending.id === id;
  const w = (n + 2) * P;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, TOP + 0.25, 0]} castShadow>
        <boxGeometry args={[w, 0.5, 0.9]} />
        <meshStandardMaterial color={hovered ? '#ffffff' : '#ecebe4'} roughness={0.5} />
        <Edges color={INK} />
      </mesh>
      <mesh position={[0, TOP + 0.51, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w - 0.35, 0.4]} />
        <meshBasicMaterial color={isFrom ? '#ffb020' : hovered ? '#2fd4bd' : glow ? '#7fe0d0' : '#9c9a90'} />
      </mesh>
      <mesh position={[0, TOP + 0.5, 0]}
        onPointerOver={e => { e.stopPropagation(); useStore.setState({ hover: { id, text: hint(), x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }); document.body.style.cursor = 'pointer'; }}
        onPointerMove={e => { const h = useStore.getState().hover; if (h && h.id === id) useStore.setState({ hover: { ...h, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }); }}
        onPointerOut={() => { if (useStore.getState().hover?.id === id) useStore.setState({ hover: null }); document.body.style.cursor = ''; }}
        onClick={e => { e.stopPropagation(); onPick(); }}>
        <boxGeometry args={[w + 0.1, 1.2, 1.1]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

export function Box({ args, position, color, rotation, edges = true, metal = 0, rough = 0.6, ...rest }) {
  return (
    <mesh position={position} rotation={rotation} castShadow {...rest}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} metalness={metal} roughness={rough} />
      {edges && <Edges color={INK} threshold={25} />}
    </mesh>
  );
}

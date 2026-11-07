import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Grid } from '@react-three/drei';
import { useStore, engine } from '../state.js';
import { placements, calloutSpots, calloutDom, sceneExtent } from '../layout.js';
import { PicBoard, ModuleBoard } from './Boards.jsx';
import { Wires, pointer } from './Wires.jsx';
import { cancelPending } from '../interact.js';

const HOME = { pos: new THREE.Vector3(0, 44, 38), target: new THREE.Vector3(0, 0, 7) };

function SimDriver() {
  const acc = useRef(0);
  useFrame((_, dt) => {
    const st = useStore.getState(), sim = engine.sim;
    if (sim && st.state === 'run') {
      dt = Math.min(dt, 0.05);
      const want = sim.pic.fcy * dt * st.speed;
      const t0 = performance.now(); sim.runCycles(want); const used = performance.now() - t0;
      const eff = used > dt * 900 ? (dt * 900 / used) : 1;
      acc.current += dt;
      st.afterFrame();
      if (acc.current > 0.2) { acc.current = 0; useStore.setState({ simTime: sim.pic.S.C / sim.pic.fcy, effSpeed: eff }); }
    }
  });
  return null;
}

function Expose() { const { camera, size } = useThree(); useEffect(() => { window.__piclab = Object.assign(window.__piclab || {}, { camera, size, THREE }); }, [camera, size]); return null; }
function CalloutSync() {
  const v = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    const spots = calloutSpots(useStore.getState().active);
    for (const sp of spots) {
      const el = calloutDom[sp.id]; if (!el) continue;
      v.current.set(...sp.pos).project(camera);
      const vis = v.current.z < 1;
      el.style.transform = `translate(-50%,-50%) translate(${(v.current.x * 0.5 + 0.5) * size.width}px, ${(-v.current.y * 0.5 + 0.5) * size.height}px)`;
      el.style.visibility = vis ? 'visible' : 'hidden';
    }
  });
  return null;
}
// déplacement au clavier : flèches, ZQSD ou WASD (A et D vont au clavier matriciel s'il est sur la table)
const panKeys = new Set();
if (typeof window !== 'undefined') {
  const inEd = e => e.target.closest && (e.target.closest('.cm-editor') || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName));
  const map = e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; const kp = useStore.getState().active.includes('keypad');
    if (k === 'ArrowUp' || k === 'z' || k === 'w') return 'f'; if (k === 'ArrowDown' || k === 's') return 'b';
    if (k === 'ArrowLeft' || k === 'q' || (k === 'a' && !kp)) return 'l'; if (k === 'ArrowRight' || (k === 'd' && !kp)) return 'r'; return null; };
  addEventListener('keydown', e => { if (inEd(e) || e.ctrlKey || e.metaKey) return; const d = map(e); if (d) { panKeys.add(d); if (e.key.startsWith('Arrow')) e.preventDefault(); } });
  addEventListener('keyup', e => { const d = map(e); if (d) panKeys.delete(d); });
  addEventListener('blur', () => panKeys.clear());
}
function CameraRig() {
  const { camera, controls } = useThree();
  const goal = useRef(null);
  const cmd = useStore(s => s.camCmd);
  const activeKey = useStore(s => s.active.join(','));
  const fitHome = () => { const { mx } = sceneExtent(useStore.getState().active); const k = Math.max(1, mx / 16); return { pos: HOME.target.clone().add(HOME.pos.clone().sub(HOME.target).multiplyScalar(k)), target: HOME.target.clone() }; };
  useEffect(() => { if (controls) goal.current = fitHome(); }, [activeKey, controls]);
  useEffect(() => {
    if (!cmd || !controls) return;
    const t = controls.target.clone(), off = camera.position.clone().sub(t);
    if (cmd.type === 'rot') off.applyAxisAngle(new THREE.Vector3(0, 1, 0), cmd.v);
    if (cmd.type === 'zoom') off.multiplyScalar(cmd.v);
    if (cmd.type === 'home') { goal.current = fitHome(); return; }
    if (cmd.type === 'top') { goal.current = { pos: new THREE.Vector3(0, 52, 0.5), target: new THREE.Vector3(0, 0, 0) }; return; }
    goal.current = { pos: t.clone().add(off), target: t };
  }, [cmd]);
  useFrame((_, dt) => {
    if (panKeys.size && controls) {
      const fwd = controls.target.clone().sub(camera.position); fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const sp = camera.position.distanceTo(controls.target) * 0.9 * Math.min(dt, 0.05);
      const mv = new THREE.Vector3();
      if (panKeys.has('f')) mv.add(fwd); if (panKeys.has('b')) mv.sub(fwd); if (panKeys.has('r')) mv.add(right); if (panKeys.has('l')) mv.sub(right);
      if (mv.lengthSq()) { mv.normalize().multiplyScalar(sp); camera.position.add(mv); controls.target.add(mv); controls.update(); goal.current = null; }
    }
    const g = goal.current; if (!g || !controls) return;
    camera.position.lerp(g.pos, 0.15); controls.target.lerp(g.target, 0.15); controls.update();
    if (camera.position.distanceTo(g.pos) < 0.05) goal.current = null;
  });
  return null;
}

export default function Scene() {
  const active = useStore(s => s.active);
  const pl = placements(active);
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: HOME.pos.toArray(), fov: 34, near: 0.5, far: 400 }}
      onPointerMissed={() => cancelPending()} gl={{ antialias: true }}>
      <color attach="background" args={['#f2ebdc']} />
      <ambientLight intensity={1.6} />
      <hemisphereLight args={['#fffaf0', '#c9bda4', 0.9]} />
      <directionalLight position={[12, 30, 14]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-bias={-0.0004} />
      <Grid position={[0, 0.001, 0]} args={[200, 200]} cellSize={1} cellThickness={0.6} cellColor="#e2d8c3" sectionSize={8} sectionThickness={1} sectionColor="#d4c7ab" fadeDistance={110} fadeStrength={1.5} infiniteGrid />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow
        onPointerMove={e => pointer.copy(e.point)}>
        <planeGeometry args={[400, 400]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
      <ContactShadows position={[0, 0.01, 0]} scale={90} blur={2.2} far={6} opacity={0.35} resolution={1024} color="#5a4a2a" />
      <PicBoard />
      {active.map(m => pl[m] && <ModuleBoard key={m} m={m} slot={pl[m]} />)}
      <Wires />
      <SimDriver />
      <CameraRig />
      <CalloutSync />
      <Expose />
      <OrbitControls makeDefault target={HOME.target.toArray()} enableDamping dampingFactor={0.12} minDistance={8} maxDistance={110} maxPolarAngle={Math.PI / 2.15} />
    </Canvas>
  );
}

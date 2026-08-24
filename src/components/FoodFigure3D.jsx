// ─────────────────────────────────────────────────────────────────────────────
// Figura 3D del mangiare — procedurale (solo primitive three.js, zero asset):
//   meal    → ciotola di ceramica scura + riso + vapore + bacchette
//   protein → ciotola + bocconcini che saltellano + guarnizione
//   water   → goccia pulsante + onde concentriche
// Vive ~2 secondi nel burst, poi si smonta.
// ─────────────────────────────────────────────────────────────────────────────
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';

// ── Vapore: sfere traslucide che salgono e si dissolvono in loop ──
function Steam({ color = '#ffffff' }) {
  const ref = useRef();
  const seeds = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    x: (i - 2) * 0.17, speed: 0.32 + (i % 3) * 0.12, phase: i * 1.35,
  })), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ref.current?.children.forEach((m, i) => {
      const s = seeds[i];
      const cycle = ((t * s.speed + s.phase) % 1.7) / 1.7;
      m.position.set(s.x + Math.sin(t * 2.1 + s.phase) * 0.07, 0.62 + cycle * 0.95, 0.05);
      m.scale.setScalar(0.5 + cycle * 1.05);
      m.material.opacity = 0.32 * (1 - cycle);
    });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Ciotola: profilo tornito + bordo oro ──
function Bowl() {
  const points = useMemo(() => {
    const p = [];
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      p.push(new THREE.Vector2(0.06 + Math.sin(t * Math.PI * 0.5) * 0.92, t * 0.7));
    }
    return p;
  }, []);
  return (
    <group>
      <mesh>
        <latheGeometry args={[points, 28]} />
        <meshStandardMaterial color="#2b1d16" roughness={0.5} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.71, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.96, 0.035, 10, 40]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.25} emissive="#b45309" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

// ── Riso: cupola di chicchi (deterministica) ──
function Rice() {
  const grains = useMemo(() => {
    let st = 42;
    const rnd = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
    return Array.from({ length: 42 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.66;
      return [Math.cos(a) * r, 0.52 + Math.max(0, 0.34 - r * r * 0.5) + rnd() * 0.12, Math.sin(a) * r];
    });
  }, []);
  return (
    <group>
      {grains.map((p, i) => (
        <mesh key={i} position={p} rotation={[i % 3, i % 5, 0]}>
          <sphereGeometry args={[0.075, 8, 8]} />
          <meshStandardMaterial color={i % 6 === 0 ? '#fff6d8' : '#f4f1e8'} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ── Bocconcini che saltellano (protein) ──
function Chunks() {
  const ref = useRef();
  const spots = useMemo(() => [
    { x: -0.34, z: 0.12, c: '#8a4b23', s: 0.21 },
    { x: 0.3, z: 0.2, c: '#a05a2c', s: 0.18 },
    { x: 0.02, z: -0.28, c: '#6f3a18', s: 0.23 },
    { x: 0.05, z: 0.34, c: '#3f9d4a', s: 0.11 }, // guarnizione verde
  ], []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ref.current?.children.forEach((m, i) => {
      m.position.y = 0.62 + Math.abs(Math.sin(t * 2.6 + i * 1.8)) * 0.16;
      m.rotation.y = t * (0.8 + i * 0.2);
    });
  });
  return (
    <group ref={ref}>
      {spots.map((s, i) => (
        <mesh key={i} position={[s.x, 0.62, s.z]} scale={s.s}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={s.c} roughness={0.55} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// ── Bacchette appoggiate ──
function Chopsticks() {
  return (
    <group position={[0.15, 0.78, 0.1]} rotation={[0.12, 0, -0.32]}>
      <mesh position={[0, 0, -0.05]} rotation={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.018, 0.026, 1.7, 8]} />
        <meshStandardMaterial color="#c9a06a" roughness={0.6} />
      </mesh>
      <mesh position={[0.1, 0.01, 0.09]} rotation={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.018, 0.026, 1.7, 8]} />
        <meshStandardMaterial color="#b8905c" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ── Goccia d'acqua: profilo a lacrima + anelli di onda ──
function Droplet() {
  const dropRef = useRef();
  const rippleRef = useRef();
  const profile = useMemo(() => {
    const p = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      const r = Math.sin(Math.PI * Math.min(1, t * 1.18)) * 0.52 * (1 - t * 0.3);
      p.push(new THREE.Vector2(Math.max(0.001, r), t * 1.4));
    }
    return p;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (dropRef.current) {
      dropRef.current.position.y = -0.15 + Math.sin(t * 2.2) * 0.09;
      dropRef.current.scale.setScalar(1 + Math.sin(t * 3.1) * 0.04);
    }
    rippleRef.current?.children.forEach((ring, i) => {
      const cycle = ((t * 0.9 + i * 0.5) % 1.5) / 1.5;
      ring.scale.setScalar(0.3 + cycle * 1.6);
      ring.material.opacity = 0.5 * (1 - cycle);
    });
  });
  return (
    <group>
      <mesh ref={dropRef} position={[0, -0.15, 0]}>
        <latheGeometry args={[profile, 26]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.85} roughness={0.15} metalness={0.1} emissive="#0ea5e9" emissiveIntensity={0.35} />
      </mesh>
      <group ref={rippleRef} position={[0, -0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {[0, 1].map((i) => (
          <mesh key={i}>
            <torusGeometry args={[0.55, 0.02, 8, 36]} />
            <meshBasicMaterial color="#7dd3fc" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── Scena: ingresso + rotazione lenta + respiro ──
function Scene({ kind }) {
  const group = useRef();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const g = group.current;
    if (!g) return;
    g.rotation.y = t * 0.55;
    const enter = Math.min(1, t * 2.4);
    g.scale.setScalar((0.55 + 0.45 * (1 - Math.pow(1 - enter, 3))) + Math.sin(t * 2.6) * 0.018);
    g.position.y = -0.42 + Math.sin(t * 1.7) * 0.045;
  });
  return (
    <group ref={group} position={[0, -0.42, 0]}>
      {kind === 'water' ? (
        <Droplet />
      ) : (
        <>
          <Bowl />
          {kind === 'protein' ? <Chunks /> : <Rice />}
          {kind === 'meal' && <Chopsticks />}
          <Steam />
        </>
      )}
    </group>
  );
}

export default function FoodFigure3D({ kind = 'meal' }) {
  return (
    <Canvas
      flat
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.2, 3.0], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      style={{ pointerEvents: 'none' }}
      aria-hidden>
      <ambientLight intensity={0.75} />
      <directionalLight position={[2.5, 3.5, 2]} intensity={1.15} />
      <pointLight position={[0, 1.6, 1.2]} intensity={26} color="#ffd27a" />
      <Scene kind={kind} />
    </Canvas>
  );
}

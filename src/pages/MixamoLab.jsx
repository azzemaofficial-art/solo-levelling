import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, useAnimations, useFBX } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const MIXAMO_TEST_ASSETS = {
  base: '/models/mixamo-test/orc-base.fbx',
  clips: {
    idle: '/models/mixamo-test/idle.fbx',
    walk: '/models/mixamo-test/walk.fbx',
    attack1h: '/models/mixamo-test/attack-1h.fbx',
    attack2h: '/models/mixamo-test/attack-2h.fbx',
    block: '/models/mixamo-test/block.fbx',
    hit: '/models/mixamo-test/hit.fbx',
    death: '/models/mixamo-test/death.fbx',
    taunt: '/models/mixamo-test/taunt.fbx'
  }
};

const getSceneStats = (root) => {
  const stats = { mesh: 0, skinned: 0, bones: 0, animations: root.animations?.length || 0 };
  root.traverse((node) => {
    if (node.isMesh) stats.mesh += 1;
    if (node.isSkinnedMesh) stats.skinned += 1;
    if (node.type === 'Bone') stats.bones += 1;
  });
  return stats;
};

const fitObjectToGround = (object, targetHeight = 2.35) => {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const rawScale = size.y > 0.001 ? targetHeight / size.y : 1;
  return {
    scale: Math.max(0.01, Math.min(2, rawScale)),
    center,
    minY: box.min.y
  };
};

const fitRigToGround = (object, targetHeight = 2.35) => {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const point = new THREE.Vector3();
  let hasBone = false;

  object.updateMatrixWorld(true);
  object.traverse((node) => {
    if (node.type !== 'Bone') return;
    node.getWorldPosition(point);
    min.min(point);
    max.max(point);
    hasBone = true;
  });

  if (!hasBone) return { scale: 1, center: new THREE.Vector3(), minY: 0 };

  const size = new THREE.Vector3().subVectors(max, min);
  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const scale = size.y > 0.001 ? targetHeight / size.y : 1;
  return {
    scale: Math.max(0.01, Math.min(2.4, scale)),
    center,
    minY: min.y
  };
};

const ClipMagicFx = ({ clipKey }) => {
  const sigilRef = useRef(null);
  const burstRef = useRef(null);
  const burstCoreRef = useRef(null);
  const shockwaveRef = useRef(null);
  const shockwaveCoreRef = useRef(null);
  const orbCoreRef = useRef(null);
  const orbShellRef = useRef(null);
  const trailRef = useRef(null);
  const trailCoreRef = useRef(null);
  const ringRef = useRef(null);
  const sparkRefs = useRef([]);
  const explosionShardRefs = useRef([]);
  const beamLightRef = useRef(null);
  const impactLightRef = useRef(null);
  const pulseRef = useRef(0);

  useEffect(() => {
    pulseRef.current = 1;
  }, [clipKey]);

  useFrame(({ clock }) => {
    const pulse = pulseRef.current;
    const travel = 1 - pulse;
    const oneHandActive = clipKey === 'attack1h';
    const twoHandActive = clipKey === 'attack2h';
    const offensiveActive = oneHandActive || twoHandActive;
    const defensiveActive = clipKey === 'taunt' || clipKey === 'block';
    const burstActive = offensiveActive || clipKey === 'death' || clipKey === 'hit';

    if (sigilRef.current) {
      const active = twoHandActive || defensiveActive;
      sigilRef.current.visible = active && pulse > 0.02;
      sigilRef.current.rotation.z -= 0.025;
      sigilRef.current.position.set(0.1, 0.05, -0.72);
      sigilRef.current.scale.setScalar(active ? 1.2 + (travel * 0.65) : 0.01);
      sigilRef.current.material.opacity = active ? pulse * 0.42 : 0;
    }

    if (orbCoreRef.current) {
      const active = offensiveActive;
      const x = oneHandActive ? 0.62 : 0.56;
      const y = oneHandActive ? 1.22 : 1.42;
      const z = oneHandActive ? -0.62 - (travel * 3.05) : -0.76 - (travel * 3.35);
      orbCoreRef.current.visible = active && pulse > 0.06;
      orbCoreRef.current.position.set(x, y, z);
      orbCoreRef.current.scale.setScalar(active ? (oneHandActive ? 0.52 : 0.72) + (pulse * 0.26) : 0.01);
      orbCoreRef.current.material.opacity = active ? 1 : 0;
    }

    if (orbShellRef.current) {
      const active = offensiveActive;
      const x = oneHandActive ? 0.62 : 0.56;
      const y = oneHandActive ? 1.22 : 1.42;
      const z = oneHandActive ? -0.62 - (travel * 3.05) : -0.76 - (travel * 3.35);
      orbShellRef.current.visible = active && pulse > 0.06;
      orbShellRef.current.position.set(x, y, z);
      orbShellRef.current.rotation.y += 0.09;
      orbShellRef.current.rotation.x += 0.05;
      orbShellRef.current.scale.setScalar(active ? (oneHandActive ? 0.94 : 1.24) + (travel * 0.32) : 0.01);
      orbShellRef.current.material.opacity = active ? 1 : 0;
    }

    if (trailRef.current) {
      const active = offensiveActive;
      trailRef.current.visible = active && pulse > 0.06;
      trailRef.current.position.set(oneHandActive ? 0.62 : 0.56, oneHandActive ? 1.22 : 1.42, oneHandActive ? -1.68 - (travel * 0.72) : -1.88 - (travel * 0.82));
      trailRef.current.rotation.set(0, 0, 0);
      trailRef.current.scale.set(active ? (oneHandActive ? 0.46 : 0.58) : 0.01, active ? (oneHandActive ? 0.46 : 0.58) : 0.01, active ? (oneHandActive ? 2.8 + (travel * 1.25) : 3.3 + (travel * 1.4)) : 0.01);
      trailRef.current.material.opacity = active ? 0.95 : 0;
    }

    if (trailCoreRef.current) {
      const active = offensiveActive;
      trailCoreRef.current.visible = active && pulse > 0.06;
      trailCoreRef.current.position.copy(trailRef.current.position);
      trailCoreRef.current.scale.set(
        active ? (oneHandActive ? 0.2 : 0.24) : 0.01,
        active ? (oneHandActive ? 0.2 : 0.24) : 0.01,
        active ? (oneHandActive ? 2.45 + (travel * 1.15) : 2.85 + (travel * 1.28)) : 0.01
      );
      trailCoreRef.current.material.opacity = active ? 1 : 0;
    }

    if (ringRef.current) {
      const active = twoHandActive || defensiveActive;
      ringRef.current.visible = active && pulse > 0.05;
      ringRef.current.position.set(twoHandActive ? 0.08 : 0.14, twoHandActive ? 1.34 : 1.08, twoHandActive ? -3.1 - (travel * 1.1) : -0.92);
      ringRef.current.rotation.z += 0.09;
      ringRef.current.scale.setScalar(active ? (twoHandActive ? 0.36 + (travel * 0.85) : 0.4 + (travel * 0.4)) : 0.01);
      ringRef.current.material.opacity = active ? pulse * 0.74 : 0;
    }

    if (burstRef.current) {
      burstRef.current.visible = burstActive && pulse > 0.02;
      burstRef.current.position.set(
        offensiveActive ? 0.56 : 0.56,
        offensiveActive ? (twoHandActive ? 1.34 : 1.18) : 1.06,
        offensiveActive ? -4.1 : -3.9
      );
      burstRef.current.scale.setScalar(
        burstActive
          ? clipKey === 'attack1h'
            ? 1.1 + (travel * 2.5)
            : clipKey === 'attack2h'
              ? 1.45 + (travel * 3.2)
              : 1.35 + (travel * 2.4)
          : 0.01
      );
      burstRef.current.material.opacity = burstActive
        ? clipKey === 'attack1h'
          ? pulse * 0.72
          : clipKey === 'attack2h'
            ? pulse * 0.95
            : pulse * 0.92
        : 0;
    }

    if (burstCoreRef.current) {
      burstCoreRef.current.visible = burstActive && pulse > 0.04;
      burstCoreRef.current.position.copy(burstRef.current.position);
      burstCoreRef.current.scale.setScalar(
        burstActive
          ? clipKey === 'attack2h'
            ? 0.8 + (travel * 1.6)
            : 0.56 + (travel * 1.2)
          : 0.01
      );
      burstCoreRef.current.material.opacity = burstActive ? pulse : 0;
    }

    if (shockwaveRef.current) {
      shockwaveRef.current.visible = burstActive && pulse > 0.04;
      shockwaveRef.current.position.set(burstRef.current.position.x, burstRef.current.position.y, burstRef.current.position.z);
      shockwaveRef.current.scale.setScalar(
        burstActive
          ? clipKey === 'attack2h'
            ? 0.8 + (travel * 3.6)
            : 0.6 + (travel * 2.5)
          : 0.01
      );
      shockwaveRef.current.material.opacity = burstActive ? pulse * 0.75 : 0;
    }

    if (shockwaveCoreRef.current) {
      shockwaveCoreRef.current.visible = burstActive && pulse > 0.04;
      shockwaveCoreRef.current.position.copy(shockwaveRef.current.position);
      shockwaveCoreRef.current.scale.setScalar(
        burstActive
          ? clipKey === 'attack2h'
            ? 0.55 + (travel * 2.4)
            : 0.42 + (travel * 1.8)
          : 0.01
      );
      shockwaveCoreRef.current.material.opacity = burstActive ? pulse * 0.95 : 0;
    }

    sparkRefs.current.forEach((spark, index) => {
      if (!spark) return;
      const active = offensiveActive;
      const spread = index - 2;
      spark.visible = active && pulse > 0.05;
      spark.position.set(
        (oneHandActive ? 0.62 : 0.56) + (spread * 0.18),
        (oneHandActive ? 1.22 : 1.42) + (Math.sin(clock.elapsedTime * 6 + index) * 0.08),
        (oneHandActive ? -1.15 : -1.25) - (travel * (1.55 + (index * 0.14)))
      );
      spark.scale.setScalar(active ? 0.08 + (pulse * 0.14) + (index * 0.012) : 0.01);
      spark.material.opacity = active ? pulse * 0.9 : 0;
    });

    explosionShardRefs.current.forEach((shard, index) => {
      if (!shard) return;
      const active = burstActive;
      const angle = (index / 8) * Math.PI * 2;
      const radius = clipKey === 'attack2h' ? 0.9 + (travel * 2.1) : 0.55 + (travel * 1.45);
      shard.visible = active && pulse > 0.04;
      shard.position.set(
        0.56 + Math.cos(angle) * radius * 0.7,
        (offensiveActive ? (twoHandActive ? 1.34 : 1.18) : 1.06) + Math.sin(angle * 1.4) * radius * 0.22,
        (offensiveActive ? -4.1 : -3.9) + Math.sin(angle) * radius
      );
      shard.rotation.set(angle + travel * 3, angle * 0.5, travel * 4);
      shard.scale.setScalar(active ? 0.1 + (pulse * 0.16) : 0.01);
      shard.material.opacity = active ? pulse * 0.95 : 0;
    });

    if (beamLightRef.current) {
      const active = offensiveActive;
      beamLightRef.current.visible = active && pulse > 0.05;
      beamLightRef.current.position.set(oneHandActive ? 0.62 : 0.56, oneHandActive ? 1.24 : 1.44, oneHandActive ? -2.2 : -2.45);
      beamLightRef.current.intensity = active ? 4.5 + (pulse * 4) : 0;
    }

    if (impactLightRef.current) {
      const active = burstActive;
      impactLightRef.current.visible = active && pulse > 0.05;
      impactLightRef.current.position.set(offensiveActive ? 0.56 : 0.56, offensiveActive ? (twoHandActive ? 1.34 : 1.18) : 1.06, offensiveActive ? -4.1 : -3.9);
      impactLightRef.current.intensity = active ? 4.5 + (pulse * 8.5) : 0;
    }

    if (pulseRef.current > 0) pulseRef.current = Math.max(0, pulseRef.current - 0.018);
  });

  return (
    <group position={[0, -0.48, -0.05]}>
      <mesh ref={sigilRef} rotation={[-Math.PI / 2, 0, 0]} position={[0.9, 0.05, -0.05]}>
        <ringGeometry args={[1.05, 1.38, 48]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={trailRef} position={[2.4, 1.18, -0.16]}>
        <boxGeometry args={[0.75, 0.75, 3.4]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={trailCoreRef} position={[2.4, 1.18, -0.16]}>
        <boxGeometry args={[0.26, 0.26, 3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={orbCoreRef} position={[1.35, 1.18, -0.16]}>
        <sphereGeometry args={[0.42, 28, 28]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.92} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={orbShellRef} position={[1.35, 1.18, -0.16]}>
        <icosahedronGeometry args={[0.72, 1]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0} wireframe blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} position={[2.35, 1.34, -0.2]}>
        <torusGeometry args={[0.42, 0.05, 12, 36]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {Array.from({ length: 5 }).map((_, index) => (
        <mesh
          key={`spark-${index}`}
          ref={(node) => {
            sparkRefs.current[index] = node;
          }}
          position={[0.56, 1.24, -1.3]}
        >
          <octahedronGeometry args={[0.12, 0]} />
          <meshBasicMaterial color={index % 2 === 0 ? '#a78bfa' : '#67e8f9'} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={burstRef} position={[4.72, 1.18, -0.24]}>
        <sphereGeometry args={[0.92, 28, 28]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={burstCoreRef} position={[4.72, 1.18, -0.24]}>
        <sphereGeometry args={[0.52, 24, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={shockwaveRef} position={[4.72, 1.18, -0.24]}>
        <torusGeometry args={[0.9, 0.14, 16, 48]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={shockwaveCoreRef} position={[4.72, 1.18, -0.24]}>
        <torusGeometry args={[0.64, 0.08, 14, 42]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {Array.from({ length: 8 }).map((_, index) => (
        <mesh
          key={`explosion-shard-${index}`}
          ref={(node) => {
            explosionShardRefs.current[index] = node;
          }}
          position={[0.56, 1.18, -4.1]}
        >
          <octahedronGeometry args={[0.16, 0]} />
          <meshBasicMaterial color={index % 2 === 0 ? '#e879f9' : '#67e8f9'} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      <pointLight ref={beamLightRef} color="#38bdf8" intensity={0} distance={7.5} decay={2} />
      <pointLight ref={impactLightRef} color="#c084fc" intensity={0} distance={6.5} decay={2} />
    </group>
  );
};

const TargetDummy = ({ clipKey }) => {
  const groupRef = useRef(null);
  const flashRef = useRef(null);
  const pulseRef = useRef(0);

  useEffect(() => {
    if (clipKey === 'attack1h' || clipKey === 'attack2h' || clipKey === 'death' || clipKey === 'hit') {
      pulseRef.current = 1;
    }
  }, [clipKey]);

  useFrame(() => {
    const pulse = pulseRef.current;
    if (groupRef.current) {
      groupRef.current.position.set(
        0.08,
        -0.78,
        -4.5 + ((1 - pulse) * 0.18)
      );
      groupRef.current.rotation.set(0, Math.PI + ((1 - pulse) * 0.08), 0);
    }
    if (flashRef.current) {
      flashRef.current.material.opacity = pulse > 0 ? pulse * 0.72 : 0;
      flashRef.current.scale.setScalar(1 + ((1 - pulse) * 0.55));
    }
    if (pulseRef.current > 0) pulseRef.current = Math.max(0, pulseRef.current - 0.045);
  });

  return (
    <group ref={groupRef} position={[0.08, -0.78, -4.5]}>
      <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.42, 1.45, 6, 14]} />
        <meshStandardMaterial color="#1f2937" roughness={0.88} metalness={0.18} />
      </mesh>
      <mesh position={[0, 2.1, 0]} castShadow>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color="#334155" roughness={0.82} metalness={0.22} />
      </mesh>
      <mesh ref={flashRef} position={[0, 1.18, -0.2]}>
        <planeGeometry args={[1.15, 1.55]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.22, -0.32]} rotation={[0.08, 0, 0]}>
        <planeGeometry args={[0.68, 0.22]} />
        <meshBasicMaterial color="#fb7185" transparent opacity={0.78} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.34, 0.52, 32]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

const AnimatedMixamoPreview = ({ clipPath, yOffset = -4.55 }) => {
  const scene = useFBX(MIXAMO_TEST_ASSETS.base);
  const clipScene = useFBX(clipPath);
  const model = useMemo(() => cloneSkinned(scene), [scene]);
  const fit = useMemo(() => fitRigToGround(model, 3.8), [model]);
  const clipAnimations = useMemo(
    () => (clipScene.animations || []).map((clip) => {
      const next = clip.clone();
      next.name = 'preview';
      return next;
    }),
    [clipScene]
  );
  const { actions } = useAnimations(clipAnimations, model);

  useEffect(() => {
    model.traverse((node) => {
      if (!(node.isMesh || node.isSkinnedMesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((mat) => {
        if (!mat) return;
        if (mat.color) mat.color = new THREE.Color('#d9dee8');
        if (mat.emissive) mat.emissive = new THREE.Color('#13253f');
        if (typeof mat.emissiveIntensity === 'number') mat.emissiveIntensity = 0.2;
        mat.transparent = false;
        mat.opacity = 1;
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      });
    });
  }, [model]);

  useEffect(() => {
    model.position.set(-fit.center.x, -fit.minY, -fit.center.z);
    model.rotation.set(0, Math.PI, 0);
  }, [model, fit]);

  useEffect(() => {
    Object.values(actions || {}).forEach((action) => action.stop());
    const preview = actions?.preview;
    if (!preview) return;
    preview.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.15).play();
    return () => preview.fadeOut(0.15);
  }, [actions, clipPath]);

  return (
    <group position={[0, yOffset, 0]} scale={fit.scale}>
      <primitive object={model} />
    </group>
  );
};

const SceneInfoCard = ({ title, stats, hint, accent = 'cyan' }) => (
  <div className={`rounded-sm border bg-black/40 p-3 ${accent === 'rose' ? 'border-rose-500/40' : 'border-cyan-500/40'}`}>
    <p className={`text-[10px] uppercase tracking-[0.28em] ${accent === 'rose' ? 'text-rose-300' : 'text-cyan-300'}`}>{title}</p>
    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/85">
      <div className="rounded-sm border border-white/10 bg-white/5 px-2 py-2">Mesh: {stats.mesh}</div>
      <div className="rounded-sm border border-white/10 bg-white/5 px-2 py-2">Skinned: {stats.skinned}</div>
      <div className="rounded-sm border border-white/10 bg-white/5 px-2 py-2">Bones: {stats.bones}</div>
      <div className="rounded-sm border border-white/10 bg-white/5 px-2 py-2">Anim: {stats.animations}</div>
    </div>
    <p className="mt-3 text-[11px] leading-relaxed text-white/65">{hint}</p>
  </div>
);

const MixamoLab = () => {
  const [selectedClip, setSelectedClip] = useState('idle');
  const baseScene = useFBX(MIXAMO_TEST_ASSETS.base);
  const selectedScene = useFBX(MIXAMO_TEST_ASSETS.clips[selectedClip]);

  const baseStats = useMemo(() => getSceneStats(baseScene), [baseScene]);
  const clipStats = useMemo(() => getSceneStats(selectedScene), [selectedScene]);
  const compatibleRig = baseStats.skinned > 0 && baseStats.bones > 0;

  return (
    <div className="min-h-full px-4 pb-28 pt-16">
      <div className="mb-4 rounded-sm border border-cyan-500/30 bg-black/35 p-4 backdrop-blur-md">
        <p className="text-[10px] uppercase tracking-[0.38em] text-cyan-300">Animation Test Lab</p>
        <h1 className="mt-2 text-2xl font-black uppercase italic text-white">Mixamo Probe</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Questa schermata non tocca il dungeon. Serve solo per vedere il modello base e capire se le clip Mixamo sono compatibili con lui.
        </p>
      </div>

      <div className="mb-4 grid gap-3">
        <SceneInfoCard
          title="Base Character"
          stats={baseStats}
          hint={compatibleRig ? 'Il modello base ha già rig e skin: in teoria può ricevere clip Mixamo.' : 'Il modello base è visibile ma non risulta riggato. Se vedi mesh senza bones/skinned, le clip Mixamo non possono animarlo direttamente.'}
        />
        <SceneInfoCard title="Selected Clip" stats={clipStats} hint="La clip selezionata viene applicata direttamente all'orco Mixamo nel preview qui sotto. Se cambia movimento, il binding tra base e animazioni funziona." accent="rose" />
      </div>

      <div className="mb-4 rounded-sm border border-white/10 bg-black/35 p-3">
        <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-white/50">Clip</p>
        <div className="grid grid-cols-3 gap-2">
          {Object.keys(MIXAMO_TEST_ASSETS.clips).map((clipKey) => (
            <button
              key={clipKey}
              onClick={() => setSelectedClip(clipKey)}
              className={`rounded-sm border px-2 py-3 text-[11px] font-bold uppercase tracking-wider transition ${
                selectedClip === clipKey
                  ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
              }`}
            >
              {clipKey}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="overflow-hidden rounded-sm border border-cyan-500/30 bg-black/45">
          <div className="border-b border-cyan-500/20 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-cyan-300">Unified Preview</div>
          <div className="h-[28rem]">
            <Canvas camera={{ position: [0, 1.45, 9.6], fov: 44 }}>
              <Suspense fallback={<Html center><span className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">Loading Lab</span></Html>}>
                <color attach="background" args={['#020617']} />
                <fog attach="fog" args={['#020617', 16, 30]} />
                <ambientLight intensity={0.88} />
                <hemisphereLight intensity={0.48} color="#cbd5e1" groundColor="#020617" />
                <directionalLight position={[3.2, 4.8, 2.4]} intensity={1.05} color="#f8fafc" />
                <pointLight position={[-1.4, 2.2, 2.2]} intensity={0.42} color="#38bdf8" />
                <pointLight position={[2.6, 1.9, 0.8]} intensity={0.38} color="#a78bfa" />
                <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
                  <circleGeometry args={[5.2, 64]} />
                  <meshStandardMaterial color="#030712" roughness={0.97} metalness={0.02} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -0.05]}>
                  <ringGeometry args={[1.2, 3.9, 48]} />
                  <meshBasicMaterial color="#0ea5e9" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
                <TargetDummy clipKey={selectedClip} />
                <AnimatedMixamoPreview key={selectedClip} clipPath={MIXAMO_TEST_ASSETS.clips[selectedClip]} />
                <ClipMagicFx clipKey={selectedClip} />
                <OrbitControls enablePan={false} minDistance={6.2} maxDistance={13.5} target={[0.8, -0.82, -0.05]} />
              </Suspense>
            </Canvas>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.values(MIXAMO_TEST_ASSETS).forEach((value) => {
  if (typeof value === 'string') useFBX.preload(value);
});
Object.values(MIXAMO_TEST_ASSETS.clips).forEach((path) => useFBX.preload(path));

export default MixamoLab;

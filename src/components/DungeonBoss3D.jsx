import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import * as THREE from 'three';

const IS_MOBILE = typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false;

const FLOOR_PROFILES = {
  1: { biome: 'Ironfang Gate - Orc Sentinel', modelPath: '/models/orc-warrior.glb', floor: '#141922', wall: '#11141d', arch: '#2d3240', crystal: '#b7e2ff', emissive: '#1a6fff', dust: '#c6d8ff', mist: '#7f9ad3', fog: '#07090d', haze: 'rgba(59,130,246,0.14)', targetSize: 2.6, baseZ: -1.65, groundY: 0.03, yawBias: -1.5708 },
  2: { biome: 'Ember Bastion - Orc Executor', modelPath: '/models/floor2-orc-sword.glb', floor: '#1a1615', wall: '#19110f', arch: '#45312a', crystal: '#ffd2aa', emissive: '#ff7c2f', dust: '#ffd1b8', mist: '#cf9473', fog: '#120b0a', haze: 'rgba(251,146,60,0.18)', targetSize: 2.7, baseZ: -1.6, groundY: 0.03, yawBias: -1.5708 },
  3: { biome: 'Frozen Crypt - Bone Marshal', modelPath: '/models/floor3-skeleton.glb', floor: '#0f1625', wall: '#0e1220', arch: '#2a3b60', crystal: '#d9f2ff', emissive: '#4fa8ff', dust: '#d2e9ff', mist: '#8fb0db', fog: '#080d1b', haze: 'rgba(96,165,250,0.18)', targetSize: 2.55, baseZ: -1.62, groundY: 0.02, yawBias: -1.5708 },
  4: { biome: 'Venom Nest - Widow Matriarch', modelPath: '/models/floor4-spider.glb', floor: '#11180f', wall: '#0f140f', arch: '#2a3a29', crystal: '#c5ffd2', emissive: '#31c56b', dust: '#cbf7d4', mist: '#7bc292', fog: '#081009', haze: 'rgba(16,185,129,0.16)', targetSize: 2.15, baseZ: -2.02, groundY: 0.015, yawBias: -1.5708, playNativeAnim: false },
  5: { biome: 'Infernal Hunt - Shadow Wolf', modelPath: '/models/custom/floor5-shadow-wolf.glb', floor: '#1b100f', wall: '#1f120f', arch: '#4c2a25', crystal: '#ffc3a5', emissive: '#ff4b2f', dust: '#ffccb9', mist: '#cf7d68', fog: '#150906', haze: 'rgba(239,68,68,0.24)', targetSize: 2.35, minScale: 0.35, baseZ: -2.12, groundY: 0.02, yawBias: -1.5708, playNativeAnim: false },
  6: { biome: 'Stone Core - Colossus Golem', modelPath: '/models/floor6-golem.glb', floor: '#171716', wall: '#1a1a18', arch: '#3d3b36', crystal: '#d7f0ff', emissive: '#2f7eff', dust: '#ced6df', mist: '#8b96a5', fog: '#0e0f10', haze: 'rgba(148,163,184,0.16)', targetSize: 2.45, baseZ: -2.08, groundY: 0.02, yawBias: -1.5708, playNativeAnim: false },
  7: { biome: 'Dragon Abyss - Prime Wyrm', modelPath: '/models/custom/floor7-dragon-prime.glb', floor: '#11101a', wall: '#120f1e', arch: '#2f2a4b', crystal: '#d8d0ff', emissive: '#6d6dff', dust: '#dbd5ff', mist: '#9394d9', fog: '#090814', haze: 'rgba(129,140,248,0.2)', targetSize: 3.75, baseZ: -2.2, groundY: 0.015, yawBias: -1.5708 },
  8: { biome: 'Knight Sanctum - Abyss Knight', modelPath: '/models/custom/floor8-demon-knight-v2.glb', floor: '#15111a', wall: '#130f18', arch: '#3b2a46', crystal: '#f0dcff', emissive: '#a855f7', dust: '#ead4ff', mist: '#a58bc5', fog: '#0c0912', haze: 'rgba(168,85,247,0.22)', targetSize: 3.1, baseZ: -1.85, groundY: 0.03, yawBias: -1.5708 },
  9: { biome: 'Eldritch Maw - Demonic Horror', modelPath: '/models/custom/floor9-demonic-creature.glb', floor: '#10151a', wall: '#0e1117', arch: '#23404a', crystal: '#aff7ff', emissive: '#14b8a6', dust: '#c4f4ff', mist: '#6cb5bf', fog: '#070d11', haze: 'rgba(20,184,166,0.2)', targetSize: 3.35, baseZ: -1.95, groundY: 0.015, yawBias: -1.5708 },
  10: { biome: 'Cosmic Vault - Astral Dragon', modelPath: '/models/custom/floor10-astral-dragon.glb', floor: '#0c1020', wall: '#090f23', arch: '#203266', crystal: '#d5ddff', emissive: '#4f7cff', dust: '#d0ddff', mist: '#7787cc', fog: '#040813', haze: 'rgba(79,124,255,0.22)', targetSize: 2.85, baseZ: -1.7, groundY: 0.03, yawBias: -1.5708 }
};

const getProfile = (floor) => {
  const base = FLOOR_PROFILES[1];
  const selected = FLOOR_PROFILES[floor] || base;
  if (floor === 1) return selected;
  return {
    ...selected,
    targetSize: base.targetSize,
    minScale: base.minScale,
    maxScale: base.maxScale,
    baseZ: base.baseZ,
    groundY: base.groundY,
    yawBias: base.yawBias,
    playNativeAnim: false
  };
};

const getRenderableBox = (root) => {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  let hasMesh = false;
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (!(node.isMesh || node.isSkinnedMesh) || !node.geometry) return;
    if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
    if (!node.geometry.boundingBox) return;
    tmp.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);
    if (!hasMesh) {
      box.copy(tmp);
      hasMesh = true;
    } else {
      box.union(tmp);
    }
  });
  return hasMesh ? box : new THREE.Box3().setFromObject(root);
};

const SETPIECE_MODELS = {
  gate: '/models/setpieces/arcane-gate.glb',
  throne: '/models/setpieces/dark-throne-statue.glb',
  dragon: '/models/setpieces/dragon-statue.glb',
  staff: '/models/setpieces/magic-staff.glb',
  crystal: '/models/setpieces/magical-crystal.glb',
  pillar: '/models/setpieces/mystical-pillar.glb',
  club: '/models/props/wooden-club.glb',
  hunterNinja: '/models/hunters/armored-ninja.glb',
  hunterDarkKnight: '/models/hunters/dark-knight.glb',
  hunterArmoredKnight: '/models/hunters/fantasy-armored-knight.glb',
  hunterMage: '/models/hunters/fantasy-mage.glb',
  hunterSwordswoman: '/models/hunters/fantasy-swordswoman.glb',
  hunterMedievalKnight: '/models/hunters/medieval-knight.glb'
};

// Player squad representation: these are allies, not dungeon enemies.
// Evolution path: as hunter tier increases, the avatar upgrades toward the final form.
const HUNTER_EVOLUTION_PATH = [
  // Requested order: 1 wooden -> 2 mage -> 3 ninja -> 4 knight -> 5 dark knight -> 6 golden knight
  SETPIECE_MODELS.club,
  SETPIECE_MODELS.hunterMage,
  SETPIECE_MODELS.hunterNinja,
  SETPIECE_MODELS.hunterMedievalKnight,
  SETPIECE_MODELS.hunterDarkKnight,
  SETPIECE_MODELS.hunterArmoredKnight
];

const getHunterSquadForTier = (tier = 1) => {
  const mainIndex = Math.max(0, Math.min(HUNTER_EVOLUTION_PATH.length - 1, Math.floor(tier - 1)));
  const leftIndex = Math.max(0, mainIndex - 1);
  const rightIndex = Math.min(HUNTER_EVOLUTION_PATH.length - 1, mainIndex + 1);
  return {
    left: HUNTER_EVOLUTION_PATH[leftIndex],
    right: HUNTER_EVOLUTION_PATH[rightIndex],
    reserve: HUNTER_EVOLUTION_PATH[mainIndex]
  };
};

const mapAvatarStageToTier = (avatarStage = 1) => {
  if (avatarStage <= 2) return 1;
  if (avatarStage === 3) return 2;
  if (avatarStage === 4) return 3;
  if (avatarStage === 5) return 4;
  if (avatarStage === 6) return 5;
  return 6;
};

const getDungeonSetpieces = (floor = 1) => {
  const side = floor % 2 === 0 ? 1 : -1;
  const tier = Math.min(4, Math.max(1, Math.ceil(floor / 3)));
  const throneFacing = -Math.PI * 0.5;
  const list = [];

  const add = (key, model, position, rotation, targetHeight, pedestal, extra = {}) => {
    list.push({ key: `${key}-${floor}`, model, position, rotation, targetHeight, pedestal, ...extra });
  };

  // Core lane: always visible and keeps combat center clear.
  add('gate', SETPIECE_MODELS.gate, [0, 0.02, -7.35], [0, 0, 0], 2.8, { radius: 1.74, height: 0.2, glow: 0.1 });
  add('throne', SETPIECE_MODELS.throne, [0, 0.02, -6.1], [0, throneFacing, 0], 3.7 + (tier * 0.2), { radius: 1.34, height: 0.18, glow: 0.08 });

  const addPillarPair = (x, z, height = 2.65) => {
    [-x, x].forEach((px, idx) => {
      add(`pillar-${x}-${z}-${idx}`, SETPIECE_MODELS.pillar, [px, 0.02, z], [0, px > 0 ? -0.06 : 0.06, 0], height, { radius: 0.72, height: 0.13, glow: 0.035 });
    });
  };
  const addCrystalPair = (x, z, crystalHeight = 1.55, wobble = 1.3) => {
    [-x, x].forEach((px, idx) => {
      add(
        `crystal-${x}-${z}-${idx}`,
        SETPIECE_MODELS.crystal,
        [px, 0.02, z],
        [0, px > 0 ? -0.18 : 0.18, 0],
        crystalHeight,
        { radius: 0.6, height: 0.1, glow: 0.115 },
        { bobAmp: 0.02, bobSpeed: wobble + (idx * 0.17) }
      );
    });
  };

  // Base framing on every floor.
  addPillarPair(5.35, -5.7, 2.7);
  addCrystalPair(3.65, -5.95, 1.5 + (tier * 0.05), 1.2);

  // Reserve arena clarity for active combat avatars (rendered separately).
  add('club-relic', SETPIECE_MODELS.club, [side * 5.45, 0.02, -5.55], [0, side > 0 ? -0.45 : 0.45, 0], 1.15, { radius: 0.45, height: 0.07, glow: 0.08 }, { spinSpeed: 0.05 });

  // Floor templates ordered by complexity, keeping wide non-overlapping lanes.
  if (floor <= 3) {
    addPillarPair(6.7, -7.25, 2.55);
    add('staff-side', SETPIECE_MODELS.staff, [side * 3.25, 0.02, -5.0], [0, side > 0 ? -0.12 : 0.12, 0], 1.3, { radius: 0.5, height: 0.085, glow: 0.095 }, { bobAmp: 0.018, bobSpeed: 1.35, spinSpeed: 0.12 });
  } else if (floor <= 6) {
    addPillarPair(6.8, -7.35, 2.75);
    addCrystalPair(5.15, -7.25, 1.62 + (tier * 0.06), 1.35);
    add('dragon-left', SETPIECE_MODELS.dragon, [-8.1, 0.02, -6.65], [0, Math.PI - 0.2, 0], 4.2 + (tier * 0.18), { radius: 1.12, height: 0.15, glow: 0.07 });
    add('staff-side', SETPIECE_MODELS.staff, [side * 3.2, 0.02, -5.1], [0, side > 0 ? -0.1 : 0.1, 0], 1.32, { radius: 0.5, height: 0.09, glow: 0.1 }, { bobAmp: 0.02, bobSpeed: 1.4, spinSpeed: 0.13 });
  } else if (floor <= 8) {
    addPillarPair(6.9, -7.45, 2.8);
    addCrystalPair(5.35, -7.35, 1.7 + (tier * 0.07), 1.42);
    add('dragon-left', SETPIECE_MODELS.dragon, [-8.2, 0.02, -6.7], [0, Math.PI - 0.2, 0], 4.5 + (tier * 0.2), { radius: 1.16, height: 0.17, glow: 0.08 });
    add('dragon-right', SETPIECE_MODELS.dragon, [8.2, 0.02, -6.7], [0, Math.PI + 0.2, 0], 4.5 + (tier * 0.2), { radius: 1.16, height: 0.17, glow: 0.08 });
    add('staff-core', SETPIECE_MODELS.staff, [0, 0.02, -4.65], [0, 0, 0], 1.42, { radius: 0.58, height: 0.1, glow: 0.11 }, { bobAmp: 0.022, bobSpeed: 1.55, spinSpeed: 0.14 });
  } else {
    addPillarPair(7.1, -7.55, 2.86);
    addCrystalPair(5.45, -7.45, 1.82 + (tier * 0.08), 1.5);
    add('dragon-left', SETPIECE_MODELS.dragon, [-8.3, 0.02, -6.75], [0, Math.PI - 0.2, 0], 4.9 + (tier * 0.22), { radius: 1.2, height: 0.18, glow: 0.09 });
    add('dragon-right', SETPIECE_MODELS.dragon, [8.3, 0.02, -6.75], [0, Math.PI + 0.2, 0], 4.9 + (tier * 0.22), { radius: 1.2, height: 0.18, glow: 0.09 });
    add('staff-core', SETPIECE_MODELS.staff, [0, 0.02, -4.6], [0, 0, 0], 1.5, { radius: 0.62, height: 0.1, glow: 0.12 }, { bobAmp: 0.024, bobSpeed: 1.65, spinSpeed: 0.16 });
    add('staff-side-l', SETPIECE_MODELS.staff, [-3.45, 0.02, -5.25], [0, 0.12, 0], 1.22, { radius: 0.46, height: 0.08, glow: 0.1 }, { bobAmp: 0.017, bobSpeed: 1.34, spinSpeed: 0.11 });
    add('staff-side-r', SETPIECE_MODELS.staff, [3.45, 0.02, -5.25], [0, -0.12, 0], 1.22, { radius: 0.46, height: 0.08, glow: 0.1 }, { bobAmp: 0.017, bobSpeed: 1.34, spinSpeed: 0.11 });
  }

  return list;
};

const SetpieceModel = ({ spec, profile, enraged = false }) => {
  const groupRef = useRef(null);
  const { scene } = useGLTF(spec.model);
  const model = useMemo(() => scene.clone(true), [scene]);
  const [fitScale, setFitScale] = useState(spec.scale || 1);
  const pedestal = spec.pedestal;

  useEffect(() => {
    const box = getRenderableBox(model);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    model.position.set(-center.x, -box.min.y, -center.z);
    if (spec.targetHeight && size.y > 0.001) setFitScale(spec.targetHeight / size.y);
    else setFitScale(spec.scale || 1);
    model.traverse((node) => {
      if (!(node.isMesh || node.isSkinnedMesh)) return;
      node.castShadow = false;
      node.receiveShadow = true;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((mat) => {
        if (!mat) return;
        if (mat.emissive && typeof mat.emissiveIntensity === 'number') {
          // Keep original GLB colors/material mood; only tiny boost in enraged state.
          mat.emissiveIntensity = enraged ? mat.emissiveIntensity * 1.06 : mat.emissiveIntensity;
        }
      });
    });
  }, [model, spec.scale, spec.targetHeight, profile.emissive, enraged]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const baseY = spec.position?.[1] || 0;
    const bob = (spec.bobAmp || 0) * Math.sin(t * (spec.bobSpeed || 1));
    const spin = (spec.spinSpeed || 0) * t;
    groupRef.current.position.set(spec.position[0], baseY + bob, spec.position[2]);
    groupRef.current.rotation.set(spec.rotation[0], spec.rotation[1] + spin, spec.rotation[2]);
    groupRef.current.scale.setScalar(fitScale);
  });

  return (
    <group>
      {pedestal && (
        <group>
          <mesh position={[spec.position[0], (spec.position[1] || 0) + (pedestal.height * 0.5), spec.position[2]]}>
            <cylinderGeometry args={[pedestal.radius * 1.04, pedestal.radius * 1.16, pedestal.height, 24]} />
            <meshStandardMaterial color={profile.arch} roughness={0.78} metalness={0.18} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[spec.position[0], (spec.position[1] || 0) + pedestal.height + 0.005, spec.position[2]]}>
            <ringGeometry args={[pedestal.radius * 0.58, pedestal.radius * 0.9, 32]} />
            <meshBasicMaterial color={profile.emissive} transparent opacity={(pedestal.glow || 0.1) * (enraged ? 1.3 : 1)} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      )}
      <group ref={groupRef}>
        <primitive object={model} />
      </group>
    </group>
  );
};

const DungeonSetpieces = ({ floor = 1, profile, enraged = false }) => {
  const pieces = useMemo(() => getDungeonSetpieces(floor), [floor]);
  return (
    <group>
      {pieces.map((spec) => (
        <SetpieceModel key={spec.key} spec={spec} profile={profile} enraged={enraged} />
      ))}
    </group>
  );
};

const getLayoutVariant = (floor) => {
  const variants = [
    { sideOffset: 0, bridgeZ: -4.2, laneTilt: 0.03, gateScale: 1 },
    { sideOffset: 1.1, bridgeZ: -4.9, laneTilt: -0.04, gateScale: 1.1 },
    { sideOffset: -1.2, bridgeZ: -5.4, laneTilt: 0.05, gateScale: 0.92 },
    { sideOffset: 1.6, bridgeZ: -4.7, laneTilt: -0.03, gateScale: 1.2 }
  ];
  return variants[(Math.max(1, floor) - 1) % variants.length];
};

const DungeonEnvironment = ({ profile, floor = 1, enraged = false }) => {
  const variant = getLayoutVariant(floor);
  const stoneFloor = '#2f2c28';
  const stoneWall = '#262320';
  const stoneArch = '#4b443c';
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[34, 34]} />
        <meshStandardMaterial color={stoneFloor} roughness={0.93} metalness={0.08} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, -0.015, 0]} receiveShadow>
        <ringGeometry args={[3.8, 4.8, 48]} />
        <meshStandardMaterial color={stoneArch} roughness={0.72} metalness={0.18} emissive={profile.emissive} emissiveIntensity={0.05} transparent opacity={0.85} />
      </mesh>

      <mesh position={[0, 2.2, -11.8]}>
        <boxGeometry args={[34, 5.4, 0.8]} />
        <meshStandardMaterial color={stoneWall} roughness={0.94} metalness={0.04} />
      </mesh>
      <mesh position={[-11.4, 2.2, 0]}>
        <boxGeometry args={[0.8, 5.4, 24]} />
        <meshStandardMaterial color={stoneWall} roughness={0.94} metalness={0.04} />
      </mesh>
      <mesh position={[11.4, 2.2, 0]}>
        <boxGeometry args={[0.8, 5.4, 24]} />
        <meshStandardMaterial color={stoneWall} roughness={0.94} metalness={0.04} />
      </mesh>
      <mesh position={[0, 4.8, 0]}>
        <boxGeometry args={[34, 0.6, 24]} />
        <meshStandardMaterial color={stoneWall} roughness={0.92} metalness={0.05} />
      </mesh>

      <mesh position={[variant.sideOffset * 0.6, 0.12, -4.8]} rotation={[0, variant.laneTilt * 0.6, 0]}>
        <boxGeometry args={[11.6, 0.22, 2.1]} />
        <meshStandardMaterial color={stoneArch} roughness={0.86} metalness={0.1} />
      </mesh>
      <mesh position={[variant.sideOffset * 0.6, 0.34, -4.8]} rotation={[0, variant.laneTilt * 0.6, 0]}>
        <boxGeometry args={[11.6, 0.1, 0.16]} />
        <meshStandardMaterial color={profile.emissive} emissive={profile.emissive} emissiveIntensity={0.16} roughness={0.25} metalness={0.45} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={`rib-${side}`} position={[side * 5.7, 2.2, -5.4]}>
          <mesh rotation-z={side * 0.42}>
            <boxGeometry args={[0.42, 4.6, 0.42]} />
            <meshStandardMaterial color={stoneArch} roughness={0.86} metalness={0.1} />
          </mesh>
          <mesh position={[0, 2.2, 0]} rotation-z={side * 0.12}>
            <boxGeometry args={[2.7, 0.26, 0.52]} />
            <meshStandardMaterial color={stoneArch} roughness={0.8} metalness={0.16} />
          </mesh>
        </group>
      ))}

      <group position={[0, 2.45, -7.2]}>
        <mesh>
          <torusGeometry args={[3.5 * variant.gateScale, 0.22, 16, 38, Math.PI]} />
          <meshStandardMaterial color={stoneArch} roughness={0.82} metalness={0.16} />
        </mesh>
        <mesh position={[0, -1.7, 0]}>
          <boxGeometry args={[7.2 * variant.gateScale, 0.26, 0.55]} />
          <meshStandardMaterial color={stoneArch} roughness={0.82} metalness={0.16} />
        </mesh>
      </group>

      {[-6.1, -2.1, 2.1, 6.1].map((x) => (
        <group key={`pillar-${x}`} position={[x, 1.95, -6.25]}>
          <mesh>
            <cylinderGeometry args={[0.44, 0.54, 3.95, 10]} />
            <meshStandardMaterial color={stoneArch} roughness={0.86} metalness={0.1} />
          </mesh>
          <mesh position={[0, -1.95, 0]}>
            <cylinderGeometry args={[0.72, 0.72, 0.2, 10]} />
            <meshStandardMaterial color={stoneArch} roughness={0.9} metalness={0.06} />
          </mesh>
          <mesh position={[0, 1.95, 0]}>
            <torusGeometry args={[0.5, 0.07, 8, 18]} />
            <meshStandardMaterial color={stoneArch} roughness={0.76} metalness={0.18} />
          </mesh>
        </group>
      ))}

      {[[-3.7, 0.58, -2.8], [3.7, 0.58, -2.8], [-4.4, 0.52, -4.35], [4.4, 0.52, -4.35]].map(([x, y, z], idx) => (
        <mesh key={`crystal-${idx}`} position={[x, y, z]} rotation-z={(idx % 2 ? -1 : 1) * 0.16}>
          <coneGeometry args={[0.22, 1.06, 7]} />
          <meshStandardMaterial color={profile.crystal} emissive={profile.emissive} emissiveIntensity={enraged ? 1.65 : 1.1} roughness={0.28} metalness={0.08} />
        </mesh>
      ))}

      <mesh position={[0, 0.04, -5.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9.6, 3.1]} />
        <meshBasicMaterial color={profile.emissive} transparent opacity={0.09} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

const FloatingDust = ({ profile }) => {
  const pointsRef = useRef(null);
  const data = useMemo(() => {
    const count = IS_MOBILE ? 300 : 980;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = Math.random() * 5.2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position.array;
    for (let i = 1; i < pos.length; i += 3) {
      pos[i] += delta * 0.1;
      if (pos[i] > 5.4) pos[i] = 0.05;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data, 3]} />
      </bufferGeometry>
      <pointsMaterial color={profile.dust} size={IS_MOBILE ? 0.02 : 0.03} transparent opacity={0.34} depthWrite={false} />
    </points>
  );
};

const FloorMist = ({ profile }) => {
  const refs = useRef([]);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    refs.current.forEach((mesh, idx) => {
      if (!mesh) return;
      mesh.rotation.z += 0.0008 * (idx % 2 ? -1 : 1);
      mesh.position.x = Math.sin(t * 0.3 + idx) * 0.15;
      mesh.position.z = Math.cos(t * 0.25 + idx) * 0.15 + (idx - 1) * 0.9;
    });
  });

  return (
    <>
      {[0, 1, 2].map((idx) => (
        <mesh
          key={`mist-${idx}`}
          ref={(el) => { refs.current[idx] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.05, (idx - 1) * 0.95]}
        >
          <planeGeometry args={[6.6 - (idx * 0.28), 6.3 - (idx * 0.3)]} />
          <meshBasicMaterial color={profile.mist} transparent opacity={0.032 - (idx * 0.006)} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </>
  );
};

const AmbientColorSparks = () => {
  const refs = useRef([]);
  const palettes = ['#8ec5ff', '#ffd699', '#b9f2c2'];
  const clouds = useMemo(() => palettes.map(() => {
    const count = IS_MOBILE ? 70 : 160;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 1] = 0.3 + Math.random() * 3.8;
      arr[i * 3 + 2] = -1 + (Math.random() - 0.5) * 18;
    }
    return arr;
  }), []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    refs.current.forEach((p, idx) => {
      if (!p) return;
      const pos = p.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 1] += delta * (0.04 + idx * 0.012);
        pos[i] += Math.sin(t * 0.4 + (i * 0.001)) * 0.0007;
        if (pos[i + 1] > 4.4) pos[i + 1] = 0.25;
      }
      p.geometry.attributes.position.needsUpdate = true;
    });
  });

  return (
    <group>
      {clouds.map((data, idx) => (
        <points key={`ambient-spark-${idx}`} ref={(el) => { refs.current[idx] = el; }}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[data, 3]} />
          </bufferGeometry>
          <pointsMaterial color={palettes[idx]} size={IS_MOBILE ? 0.012 : 0.018} transparent opacity={0.13} depthWrite={false} />
        </points>
      ))}
    </group>
  );
};

const CrystalBeams = ({ profile, enraged = false }) => {
  const refs = useRef([]);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    refs.current.forEach((beam, idx) => {
      if (!beam) return;
      beam.rotation.y = (idx * 0.85) + (Math.sin(t * (0.35 + (idx * 0.05))) * 0.14);
      beam.material.opacity = (enraged ? 0.18 : 0.11) + (Math.sin(t * 1.4 + idx) * 0.018);
    });
  });

  return (
    <>
      {[[-2.4, 1.3, -2.1], [2.4, 1.28, -2.1], [0, 1.15, -3.2]].map(([x, y, z], idx) => (
        <mesh key={`beam-${idx}`} ref={(el) => { refs.current[idx] = el; }} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.62, 3.8, 16, 1, true]} />
          <meshBasicMaterial color={profile.emissive} transparent opacity={0.11} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
};

const LevelUpBurst = ({ tick = 0 }) => {
  const ref = useRef(null);
  const burstData = useMemo(() => {
    const count = IS_MOBILE ? 50 : 140;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 1.2;
      pos[i * 3 + 2] = -1.6;
      vel[i * 3] = (Math.random() - 0.5) * 2.6;
      vel[i * 3 + 1] = 1 + Math.random() * 2.3;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 2.6;
    }
    return { pos, vel };
  }, []);
  const lifeRef = useRef(0);

  useEffect(() => {
    if (tick <= 0 || !ref.current) return;
    lifeRef.current = 1;
    const arr = ref.current.geometry.attributes.position.array;
    arr.set(burstData.pos);
    ref.current.geometry.attributes.position.needsUpdate = true;
  }, [tick, burstData.pos]);

  useFrame((_, delta) => {
    if (!ref.current || lifeRef.current <= 0) return;
    const arr = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < arr.length / 3; i += 1) {
      arr[i * 3] += burstData.vel[i * 3] * delta;
      arr[i * 3 + 1] += burstData.vel[i * 3 + 1] * delta;
      arr[i * 3 + 2] += burstData.vel[i * 3 + 2] * delta;
      burstData.vel[i * 3 + 1] -= 4.8 * delta;
    }
    ref.current.material.opacity = Math.max(0, lifeRef.current);
    ref.current.geometry.attributes.position.needsUpdate = true;
    lifeRef.current = Math.max(0, lifeRef.current - delta * 1.25);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[burstData.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffd700" size={0.045} transparent opacity={0} depthWrite={false} />
    </points>
  );
};

const CrystalLights = ({ profile, enraged = false }) => {
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const backRef = useRef(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const amp = enraged ? 0.35 : 0.2;
    if (leftRef.current) {
      leftRef.current.position.x = -2.2 + Math.sin(t * 1.2) * amp;
      leftRef.current.position.y = 1.5 + Math.sin(t * 1.7) * 0.15;
      leftRef.current.intensity = enraged ? 1.7 : 1.2;
    }
    if (rightRef.current) {
      rightRef.current.position.x = 2.2 + Math.cos(t * 1.05) * amp;
      rightRef.current.position.y = 1.45 + Math.cos(t * 1.4) * 0.15;
      rightRef.current.intensity = enraged ? 1.5 : 1.1;
    }
    if (backRef.current) {
      backRef.current.position.z = -2.2 + Math.sin(t * 0.8) * 0.2;
      backRef.current.intensity = enraged ? 0.95 : 0.7;
    }
  });

  return (
    <>
      <pointLight ref={leftRef} position={[-2.2, 1.5, 1.4]} intensity={1.2} color={profile.emissive} />
      <pointLight ref={rightRef} position={[2.2, 1.45, 1.4]} intensity={1.1} color={profile.emissive} />
      <pointLight ref={backRef} position={[0, 1.1, -2.2]} intensity={0.7} color={profile.emissive} />
    </>
  );
};

const SetpieceKeyLights = ({ floor = 1, profile }) => {
  const side = floor % 2 === 0 ? 1 : -1;
  return (
    <>
      <pointLight position={[0, 3.35, -5.7]} intensity={1.45} color="#fff2dc" />
      <pointLight position={[2.6 * side, 2.8, -5.7]} intensity={0.82} color="#f6efe6" />
      <pointLight position={[-4.8 * side, 3.1, -5.5]} intensity={0.96} color="#f8e7cf" />
      <pointLight position={[-3.5 * side, 3.3, -4.85]} intensity={1.18} color="#fff4de" />
      <pointLight position={[4.0 * side, 3.2, -5.0]} intensity={1.02} color="#ffe4b8" />
    </>
  );
};

const OrcModel = ({
  profile,
  rage = 0,
  hitTick = 0,
  enemyAttackTick = 0,
  manualMoveTick = 0,
  manualMoveType = 'idle',
  spawnTick = 0,
  defeated = false,
  onPointerDown
}) => {
  const groupRef = useRef(null);
  const hitImpactRef = useRef(0);
  const attackRef = useRef(0);
  const roarRef = useRef(0);
  const dashRef = useRef(0);
  const guardRef = useRef(0);
  const spawnRef = useRef(0);
  const deathRef = useRef(0);
  const { scene, animations } = useGLTF(profile.modelPath);
  const { actions } = useAnimations(animations, groupRef);
  const model = useMemo(() => scene.clone(true), [scene]);
  const [fitScale, setFitScale] = useState(1);
  const [groundOffset, setGroundOffset] = useState(profile.groundY || 0.03);

  useEffect(() => {
    const box = getRenderableBox(model);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    model.position.set(-center.x, -box.min.y, -center.z);
    const rawScale = (profile.targetSize || 2.6) / maxDim;
    const clampedScale = Math.max(profile.minScale || 0.22, Math.min(profile.maxScale || 3.8, rawScale));
    setFitScale(clampedScale);
    setGroundOffset(profile.groundY || 0.03);
  }, [model, profile.targetSize, profile.groundY, profile.minScale, profile.maxScale]);

  useEffect(() => {
    if (!actions) return;
    const names = Object.keys(actions);
    if (names.length === 0) return;
    if (profile.playNativeAnim === false) return;
    const actionName = names.find((name) => /idle|attack|roar|walk|run/i.test(name)) || names[0];
    const action = actions[actionName];
    if (!action) return;
    action.reset().fadeIn(0.25).play();
    return () => action.fadeOut(0.25);
  }, [actions, profile.playNativeAnim]);

  useEffect(() => { if (hitTick > 0) hitImpactRef.current = 1; }, [hitTick]);
  useEffect(() => { if (enemyAttackTick > 0) attackRef.current = 1; }, [enemyAttackTick]);
  useEffect(() => {
    if (manualMoveTick <= 0) return;
    if (manualMoveType === 'roar') roarRef.current = 1;
    if (manualMoveType === 'dash') dashRef.current = 1;
    if (manualMoveType === 'guard') guardRef.current = 1;
  }, [manualMoveTick, manualMoveType]);
  useEffect(() => { if (spawnTick > 0) { spawnRef.current = 1; deathRef.current = 0; } }, [spawnTick]);
  useEffect(() => { if (defeated) deathRef.current = 1; }, [defeated]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const intensity = 1 + rage * 0.6;
    const hit = hitImpactRef.current;
    const attack = attackRef.current;
    const roar = roarRef.current;
    const dash = dashRef.current;
    const guard = guardRef.current;
    const spawn = spawnRef.current;
    const death = deathRef.current;
    const lunge = Math.sin((1 - attack) * Math.PI) * (0.42 + rage * 0.12);
    const spawnBlend = 1 - Math.min(1, spawn * 1.25);
    const sideStep = Math.sin(t * (0.9 + rage * 0.4)) * 0.005 * spawnBlend;
    const strideBounce = Math.sin(t * (2 + rage * 0.8)) * 0.03;
    const spawnLift = spawn * 1.15;
    const spawnFront = spawn * 1.4;
    const sink = death * 1.25;
    const roarWave = Math.sin(t * 18) * 0.035 * roar;
    const dashBurst = Math.sin((1 - dash) * Math.PI) * 0.9;
    const guardDrop = guard * 0.24;

    groupRef.current.position.y = groundOffset + Math.sin(t * 1.8) * 0.04 * intensity + strideBounce + roarWave - guardDrop - spawnLift - sink;
    groupRef.current.position.x = (sideStep * 0.04) + (hit * Math.sin(t * 52) * 0.016);
    groupRef.current.position.z = (profile.baseZ || -1.65) + spawnFront + lunge + dashBurst - (hit * 0.28);
    const camYaw = Math.atan2(state.camera.position.x - groupRef.current.position.x, state.camera.position.z - groupRef.current.position.z);
    groupRef.current.rotation.y = camYaw + (profile.yawBias || 0) + Math.sin(t * 0.9) * 0.04 * intensity + (Math.sin(t * 14) * 0.12 * roar) - (lunge * 0.18) + death * 0.8;
    groupRef.current.rotation.x = -(hit * 0.3) - (dashBurst * 0.18) + (guard * 0.1) + death * 0.5;
    groupRef.current.rotation.z = (hit * Math.sin(t * 52) * 0.05) + Math.sin(t * 1.2) * 0.03;
    groupRef.current.scale.setScalar((fitScale + hit * 0.08 + attack * 0.04 + roar * 0.04) * (1 - death * 0.25));

    if (hitImpactRef.current > 0) hitImpactRef.current = Math.max(0, hitImpactRef.current - 0.045);
    if (attackRef.current > 0) attackRef.current = Math.max(0, attackRef.current - 0.06);
    if (roarRef.current > 0) roarRef.current = Math.max(0, roarRef.current - 0.045);
    if (dashRef.current > 0) dashRef.current = Math.max(0, dashRef.current - 0.085);
    if (guardRef.current > 0) guardRef.current = Math.max(0, guardRef.current - 0.03);
    if (spawnRef.current > 0) spawnRef.current = Math.max(0, spawnRef.current - 0.04);
    if (deathRef.current > 0 && deathRef.current < 1.4) deathRef.current = Math.min(1.4, deathRef.current + 0.03);
  });

  return (
    <group ref={groupRef} onPointerDown={onPointerDown}>
      <primitive object={model} />
    </group>
  );
};

const HunterAvatarModel = ({
  modelPath,
  side = 'center',
  tier = 1,
  level = 1,
  skillPower = 0,
  playerAttackTick = 0,
  enemyAttackTick = 0
}) => {
  const groupRef = useRef(null);
  const attackRef = useRef(0);
  const hitRef = useRef(0);
  const { scene } = useGLTF(modelPath);
  const model = useMemo(() => scene.clone(true), [scene]);
  const [fitScale, setFitScale] = useState(1);
  const sideSign = side === 'left' ? -1 : side === 'right' ? 1 : 0;
  const baseX = sideSign * 1.85;
  const baseY = 0.015;
  const baseZ = 1.05;
  const evolutionColor = useMemo(() => new THREE.Color(getHunterMagicColor(tier)), [tier]);
  const evolutionAuraStrength = Math.max(0.06, Math.min(0.32, 0.07 + (Math.max(0, tier - 1) * 0.03) + (Math.max(0, skillPower) * 0.02)));

  useEffect(() => {
    const box = getRenderableBox(model);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    model.position.set(-center.x, -box.min.y, -center.z);
    const targetHeight = 1.78 + (Math.min(6, Math.max(1, tier)) * 0.08);
    const rawScale = size.y > 0.001 ? targetHeight / size.y : 1;
    setFitScale(Math.max(0.42, Math.min(1.36, rawScale)));
    model.traverse((node) => {
      if (!(node.isMesh || node.isSkinnedMesh)) return;
      node.castShadow = false;
      node.receiveShadow = true;
      const mat = node.material;
      if (mat && typeof mat === 'object' && 'emissive' in mat && mat.emissive) {
        mat.emissive = mat.emissive.clone().lerp(evolutionColor, 0.24);
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0, evolutionAuraStrength);
      }
    });
  }, [model, tier, evolutionAuraStrength, evolutionColor, skillPower]);

  useEffect(() => {
    if (playerAttackTick > 0) attackRef.current = 1;
  }, [playerAttackTick]);

  useEffect(() => {
    if (enemyAttackTick > 0) hitRef.current = 1;
  }, [enemyAttackTick]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const attack = attackRef.current;
    const hit = hitRef.current;
    const lunge = Math.sin((1 - attack) * Math.PI) * (0.72 + (Math.min(6, tier) * 0.05));
    const recoil = Math.sin((1 - hit) * Math.PI) * 0.26;
    const idleBob = Math.sin(t * (1.8 + (sideSign * 0.1))) * 0.025;
    const idleSway = Math.sin(t * 1.1 + (sideSign * 0.3)) * 0.03;
    const levelAura = Math.min(0.12, Math.max(0, (level - 1) * 0.004));

    groupRef.current.position.set(
      baseX + (idleSway * 0.2) - (hit * sideSign * 0.05),
      baseY + idleBob + (attack * 0.04),
      baseZ - lunge + recoil
    );

    groupRef.current.rotation.set(
      (hit * 0.08) - (attack * 0.06),
      sideSign === 0 ? 0 : -sideSign * (0.26 + levelAura + (attack * 0.18)),
      (hit * sideSign * 0.06)
    );

    groupRef.current.scale.setScalar(fitScale * (1 + (attack * 0.07)));

    if (attackRef.current > 0) attackRef.current = Math.max(0, attackRef.current - 0.09);
    if (hitRef.current > 0) hitRef.current = Math.max(0, hitRef.current - 0.07);
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} />
      <mesh position={[0, 0.02, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.86, 48]} />
        <meshBasicMaterial
          color={evolutionColor}
          transparent
          opacity={Math.min(0.55, 0.16 + (Math.max(0, skillPower) * 0.08))}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

const HunterCombatSquad = ({
  tier = 1,
  avatarStage = 1,
  level = 1,
  skillPower = 0,
  playerAttackTick = 0,
  formSkillTick = 0,
  enemyAttackTick = 0,
  isDefeated = false
}) => {
  const resolvedTier = useMemo(() => Math.max(tier || 1, mapAvatarStageToTier(avatarStage || 1)), [tier, avatarStage]);
  const squad = useMemo(() => getHunterSquadForTier(resolvedTier), [resolvedTier]);
  return (
    <group>
      <HunterAvatarModel
        modelPath={squad.reserve}
        side="center"
        tier={resolvedTier}
        level={level}
        skillPower={skillPower}
        playerAttackTick={playerAttackTick}
        enemyAttackTick={enemyAttackTick}
      />
    </group>
  );
};

const getHunterMagicColor = (tier = 1) => {
  const palette = ['#9ca3af', '#a78bfa', '#22d3ee', '#60a5fa', '#f472b6', '#f59e0b'];
  return palette[Math.max(0, Math.min(palette.length - 1, Math.floor(tier - 1)))];
};

const HunterMagicFx = ({
  tier = 1,
  attackTick = 0,
  formSkillTick = 0,
  formFinisherTick = 0,
  enemyAttackTick = 0,
  enemyBaseZ = -1.6
}) => {
  const projectileRef = useRef(null);
  const ringRef = useRef(null);
  const impactRef = useRef(null);
  const slashRef = useRef(null);
  const lightningRef = useRef(null);
  const trailRef = useRef(null);
  const attackPulseRef = useRef(0);
  const skillPulseRef = useRef(0);
  const finisherPulseRef = useRef(0);
  const hurtPulseRef = useRef(0);
  const trailSeed = useMemo(() => {
    const count = IS_MOBILE ? 56 : 120;
    const base = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      base[i * 3] = (Math.random() - 0.5) * 0.28;
      base[i * 3 + 1] = 0.8 + (Math.random() * 0.5);
      base[i * 3 + 2] = 0.95 + (Math.random() * 0.15);
    }
    return base;
  }, []);
  const trailPos = useMemo(() => new Float32Array(trailSeed), [trailSeed]);
  const color = useMemo(() => getHunterMagicColor(tier), [tier]);

  useEffect(() => {
    if (attackTick > 0) attackPulseRef.current = 1;
  }, [attackTick]);
  useEffect(() => {
    if (formSkillTick > 0) skillPulseRef.current = 1;
  }, [formSkillTick]);
  useEffect(() => {
    if (formFinisherTick > 0) finisherPulseRef.current = 1;
  }, [formFinisherTick]);
  useEffect(() => {
    if (enemyAttackTick > 0) hurtPulseRef.current = 1;
  }, [enemyAttackTick]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const atk = attackPulseRef.current;
    const skl = skillPulseRef.current;
    const fin = finisherPulseRef.current;
    const hurt = hurtPulseRef.current;

    if (projectileRef.current) {
      projectileRef.current.visible = atk > 0.02 || skl > 0.02 || fin > 0.02;
      const atkTravel = 1 - Math.min(1, atk);
      const sklTravel = 1 - Math.min(1, skl);
      const finTravel = 1 - Math.min(1, fin);
      const z = skl > atk
        ? (fin > skl ? 0.9 - (finTravel * 3.7) : 0.9 - (sklTravel * 3.2))
        : (fin > atk ? 0.9 - (finTravel * 3.7) : 0.9 - (atkTravel * 2.4));
      projectileRef.current.position.set(
        Math.sin(t * 14) * 0.05,
        1.05 + Math.sin(t * 22) * 0.06 + (skl > 0 ? 0.08 : 0) + (fin > 0 ? 0.12 : 0),
        z
      );
      projectileRef.current.scale.setScalar(0.08 + (skl * 0.35) + (atk * 0.18) + (fin * 0.52));
      projectileRef.current.material.opacity = Math.min(1, 0.32 + atk + (skl * 1.4) + (fin * 1.8));
    }

    if (ringRef.current) {
      ringRef.current.visible = skl > 0.02;
      ringRef.current.position.set(0, 0.05, 1.0);
      ringRef.current.rotation.set(-Math.PI / 2, 0, t * 1.6);
      ringRef.current.scale.setScalar(0.6 + (1 - Math.min(1, skl)) * 2.2);
      ringRef.current.material.opacity = Math.max(0, skl * 0.85);
    }

    if (slashRef.current) {
      slashRef.current.visible = skl > 0.03 || fin > 0.03;
      slashRef.current.position.set(0, 1.0, enemyBaseZ + 0.45);
      slashRef.current.rotation.set(Math.sin(t * 5) * 0.18, 0, t * 5.8);
      slashRef.current.scale.set(0.9 + ((1 - Math.min(1, Math.max(skl, fin))) * 2.6) + (fin * 1.2), 0.9 + ((1 - Math.min(1, Math.max(skl, fin))) * 2.6) + (fin * 1.2), 1);
      slashRef.current.material.opacity = Math.max(0, (skl * 0.95) + (fin * 1.25));
    }

    if (lightningRef.current) {
      lightningRef.current.visible = skl > 0.05 || fin > 0.04;
      lightningRef.current.position.set(Math.sin(t * 33) * 0.08, 2.25, enemyBaseZ + 0.08);
      lightningRef.current.scale.set(1, 0.9 + (skl * 1.8) + (fin * 2.4), 1);
      lightningRef.current.material.opacity = Math.max(0, Math.min(1, (skl * 1.25) + (fin * 1.6) + (Math.sin(t * 44) * 0.1)));
    }

    if (trailRef.current) {
      trailRef.current.visible = skl > 0.02 || fin > 0.02;
      const arr = trailRef.current.geometry.attributes.position.array;
      const progress = 1 - Math.min(1, Math.max(skl, fin));
      for (let i = 0; i < arr.length / 3; i += 1) {
        const baseX = trailSeed[i * 3];
        const baseY = trailSeed[i * 3 + 1];
        const baseZ = trailSeed[i * 3 + 2];
        const lane = (i % 5) * 0.035 - 0.07;
        arr[i * 3] = baseX + lane + (Math.sin(t * 7 + i * 0.09) * 0.02);
        arr[i * 3 + 1] = baseY + (Math.cos(t * 8 + i * 0.06) * 0.03);
        arr[i * 3 + 2] = baseZ - (progress * (baseZ - (enemyBaseZ + 0.28)));
      }
      trailRef.current.geometry.attributes.position.needsUpdate = true;
      trailRef.current.material.opacity = Math.max(0, (skl * 0.6) + (fin * 0.9));
    }

    if (impactRef.current) {
      const pulse = Math.max(atk * 0.8, skl * 1.1, fin * 1.8, hurt * 0.75);
      impactRef.current.visible = pulse > 0.02;
      impactRef.current.position.set(0, 1.05, enemyBaseZ + 0.05);
      impactRef.current.scale.setScalar(0.35 + (1 - pulse) * 1.1 + (fin * 1.5));
      impactRef.current.material.opacity = Math.max(0, pulse);
    }

    if (attackPulseRef.current > 0) attackPulseRef.current = Math.max(0, attackPulseRef.current - 0.12);
    if (skillPulseRef.current > 0) skillPulseRef.current = Math.max(0, skillPulseRef.current - 0.065);
    if (finisherPulseRef.current > 0) finisherPulseRef.current = Math.max(0, finisherPulseRef.current - 0.05);
    if (hurtPulseRef.current > 0) hurtPulseRef.current = Math.max(0, hurtPulseRef.current - 0.1);
  });

  return (
    <group>
      <mesh ref={projectileRef} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} visible={false}>
        <ringGeometry args={[0.5, 0.86, 30]} />
        <meshBasicMaterial color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={slashRef} visible={false}>
        <torusGeometry args={[0.82, 0.12, 12, 32, Math.PI * 1.3]} />
        <meshBasicMaterial color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={lightningRef} visible={false}>
        <cylinderGeometry args={[0.03, 0.15, 2.8, 6, 1, true]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <points ref={trailRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPos, 3]} />
        </bufferGeometry>
        <pointsMaterial color={color} size={IS_MOBILE ? 0.028 : 0.036} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <mesh ref={impactRef} visible={false}>
        <sphereGeometry args={[1, 14, 14]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

const FormSkillCameraShake = ({ triggerTick = 0, enabled = true, targetZ = -1.6 }) => {
  const pulseRef = useRef(0);
  const seedRef = useRef(Math.random() * 1000);

  useEffect(() => {
    if (triggerTick > 0) pulseRef.current = 1;
  }, [triggerTick]);

  useFrame((state) => {
    if (!enabled) return;
    const pulse = pulseRef.current;
    if (pulse <= 0.001) return;
    const t = state.clock.getElapsedTime();
    const amp = pulse * 0.075;
    const x = Math.sin((t * 43) + seedRef.current) * amp;
    const y = Math.cos((t * 51) + seedRef.current * 0.7) * amp * 0.62;
    state.camera.position.x += x;
    state.camera.position.y += y;
    state.camera.lookAt(0, 1.05, targetZ);
    pulseRef.current = Math.max(0, pulseRef.current - 0.11);
  });

  return null;
};

const FinisherFlash = ({ triggerTick = 0, targetZ = -1.6 }) => {
  const ref = useRef(null);
  const pulseRef = useRef(0);

  useEffect(() => {
    if (triggerTick > 0) pulseRef.current = 1;
  }, [triggerTick]);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.visible = pulseRef.current > 0.01;
    ref.current.material.opacity = Math.max(0, pulseRef.current * 0.82);
    ref.current.scale.setScalar(1 + ((1 - pulseRef.current) * 2.4));
    if (pulseRef.current > 0) pulseRef.current = Math.max(0, pulseRef.current - 0.06);
  });

  return (
    <mesh ref={ref} visible={false} position={[0, 1.05, targetZ]}>
      <sphereGeometry args={[1.2, 20, 20]} />
      <meshBasicMaterial color="#fff7d6" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
};

const DungeonBoss3D = ({
  floor = 1,
  rage = 0,
  hitTick = 0,
  formSkillTick = 0,
  formFinisherTick = 0,
  enemyAttackTick = 0,
  manualMoveTick = 0,
  manualMoveType = 'idle',
  levelUpTick = 0,
  hunterTier = 1,
  hunterAvatarStage = 1,
  hunterLevel = 1,
  hunterSkillPower = 0,
  onModelClick,
  freeExplore = false,
  enemyKey = 'enemy',
  isDefeated = false,
  className = ''
}) => {
  const profile = getProfile(floor);
  const [spawnTick, setSpawnTick] = useState(0);
  const [hitFlash, setHitFlash] = useState(false);
  const [enemyAttackFlash, setEnemyAttackFlash] = useState(false);

  useEffect(() => { setSpawnTick((tick) => tick + 1); }, [enemyKey]);
  useEffect(() => {
    if (hitTick <= 0) return;
    setHitFlash(true);
    const timer = setTimeout(() => setHitFlash(false), 230);
    return () => clearTimeout(timer);
  }, [hitTick]);
  useEffect(() => {
    if (enemyAttackTick <= 0) return;
    setEnemyAttackFlash(true);
    const timer = setTimeout(() => setEnemyAttackFlash(false), 280);
    return () => clearTimeout(timer);
  }, [enemyAttackTick]);

  const enraged = rage >= 0.65 && !isDefeated;

  return (
    <div className={`relative h-64 w-full overflow-hidden rounded-sm border border-red-500/40 bg-black/40 ${className}`}>
      <Canvas camera={{ position: [0, 1.7, 5.9], fov: 60 }}>
        <color attach="background" args={[profile.fog]} />
        <fog attach="fog" args={[profile.fog, 9, 32]} />
        <ambientLight intensity={0.42} />
        <hemisphereLight intensity={0.58} groundColor="#0b1120" color={profile.crystal} />
        <directionalLight position={[2.5, 4.5, 3]} intensity={1.2} color="#e2e8f0" />
        <pointLight position={[0, 5.4, 0]} intensity={0.18} color="#ff8a3d" />
        <pointLight position={[-4.8, 2.4, -6.8]} intensity={0.42} color={profile.emissive} />
        <pointLight position={[4.8, 2.4, -6.8]} intensity={0.42} color={profile.emissive} />
        <SetpieceKeyLights floor={floor} profile={profile} />
        <DungeonEnvironment profile={profile} floor={floor} enraged={enraged} />
        <Suspense fallback={null}>
          <DungeonSetpieces floor={floor} profile={profile} enraged={enraged} />
        </Suspense>
        <Suspense fallback={null}>
          <HunterCombatSquad
            tier={hunterTier}
            avatarStage={hunterAvatarStage}
            level={hunterLevel}
            skillPower={hunterSkillPower}
            playerAttackTick={hitTick}
            formSkillTick={formSkillTick}
            enemyAttackTick={enemyAttackTick}
            isDefeated={isDefeated}
          />
        </Suspense>
        <HunterMagicFx
          tier={hunterTier}
          attackTick={hitTick}
          formSkillTick={formSkillTick}
          formFinisherTick={formFinisherTick}
          enemyAttackTick={enemyAttackTick}
          enemyBaseZ={profile.baseZ || -1.6}
        />
        <FinisherFlash triggerTick={formFinisherTick} targetZ={profile.baseZ || -1.6} />
        <FloatingDust profile={profile} />
        <AmbientColorSparks />
        <FloorMist profile={profile} />
        <CrystalBeams profile={profile} enraged={enraged} />
        <CrystalLights profile={profile} enraged={enraged} />
        <LevelUpBurst tick={levelUpTick} />
        <pointLight position={[1.5, 1.2, -1.5]} intensity={enraged ? 0.8 : 0.2} color={enraged ? '#ef4444' : profile.emissive} />
        <Suspense
          fallback={
            <Html center>
              <p className="text-[10px] uppercase tracking-widest text-red-300">Evocazione...</p>
            </Html>
          }
        >
          <OrcModel
            key={`${floor}-${enemyKey}-${profile.modelPath}`}
            profile={profile}
            rage={rage}
            hitTick={hitTick}
            enemyAttackTick={enemyAttackTick}
            manualMoveTick={manualMoveTick}
            manualMoveType={manualMoveType}
            spawnTick={spawnTick}
            defeated={isDefeated}
            onPointerDown={onModelClick}
          />
        </Suspense>
        <OrbitControls
          enabled
          enableZoom
          enablePan
          enableRotate
          enableDamping
          dampingFactor={0.08}
          minDistance={freeExplore ? 1.8 : 2.4}
          maxDistance={freeExplore ? 11 : 6.8}
          minPolarAngle={freeExplore ? 0.25 : 0.55}
          maxPolarAngle={freeExplore ? 2.2 : 1.65}
          target={[0, 1.05, profile.baseZ || -1.6]}
        />
        <FormSkillCameraShake
          triggerTick={formSkillTick}
          enabled
          targetZ={profile.baseZ || -1.6}
        />
      </Canvas>

      <p className="pointer-events-none absolute top-2 left-2 text-[9px] uppercase tracking-widest text-cyan-200/90">{profile.biome}</p>

      <AnimatePresence>
        {hitFlash && (
          <motion.div initial={{ opacity: 0.75, scale: 0.85 }} animate={{ opacity: 0, scale: 1.15 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/50 via-red-200/10 to-transparent mix-blend-screen" />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {enemyAttackFlash && (
          <motion.div initial={{ opacity: 0.8, scale: 0.7 }} animate={{ opacity: 0, scale: 1.3 }} exit={{ opacity: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }} className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(239,68,68,0.38),transparent_58%)]" />
        )}
      </AnimatePresence>

      <motion.div
        animate={enraged ? { opacity: [0.35, 0.62, 0.35] } : { opacity: 0.16 }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: 'radial-gradient(circle at 50% 60%, rgba(255,220,180,0.08), transparent 72%)' }}
        className="pointer-events-none absolute inset-0"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
      {enraged && <p className="pointer-events-none absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest text-red-300">Enraged</p>}
    </div>
  );
};

Object.values(FLOOR_PROFILES).forEach((profile) => useGLTF.preload(profile.modelPath));
Object.values(SETPIECE_MODELS).forEach((path) => useGLTF.preload(path));

export default DungeonBoss3D;

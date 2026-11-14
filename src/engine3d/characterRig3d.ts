import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ActorFace, AnimationClip3D, CharacterDef } from '../types/cartoon';
import {
  getClayFingerprintBumpTexture,
  getFabricWeaveTexture,
  getToonRampTexture,
} from './proceduralTextures';
import type { StylePreset3DRuntime } from './stylePresets';

export interface CharacterRigHandle {
  characterId: string;
  group: THREE.Group;
  bones: Record<string, THREE.Bone>;
  skeleton: THREE.Skeleton | null;
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<AnimationClip3D, THREE.AnimationAction>>;
  currentClip: AnimationClip3D;
  isCustomGlb: boolean;
  customClipNames: string[];
  setClip: (clip: AnimationClip3D, fadeSec?: number) => void;
  setExpression: (face: ActorFace, lipOpenness: number, timeSec: number, lookTarget?: string) => void;
  updateAnimation: (deltaSec: number, absoluteTimeSec?: number, stopMotionFps?: number) => void;
  dispose: () => void;
}

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

function qArr(x: number, y: number, z: number): number[] {
  _euler.set(x, y, z, 'XYZ');
  _quat.setFromEuler(_euler);
  return [_quat.x, _quat.y, _quat.z, _quat.w];
}

function makeMat(
  colorHex: string,
  style: StylePreset3DRuntime,
  opts: { roughness?: number; metalness?: number; isCloth?: boolean; isSkin?: boolean } = {}
): THREE.Material {
  const baseRough = Math.max(0.15, Math.min(0.98, (opts.roughness ?? 0.65) + style.roughnessBias));
  const baseMetal = Math.max(0.0, Math.min(0.85, (opts.metalness ?? 0.05) + style.metalnessBias));

  if (style.toonMode) {
    return new THREE.MeshToonMaterial({
      color: new THREE.Color(colorHex),
      gradientMap: getToonRampTexture(),
    });
  }

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: baseRough,
    metalness: baseMetal,
    bumpMap: style.clayBumpScale > 0 ? getClayFingerprintBumpTexture() : opts.isCloth ? getFabricWeaveTexture() : null,
    bumpScale: style.clayBumpScale > 0 ? style.clayBumpScale : opts.isCloth ? 0.006 : 0,
  });
}

function buildClipTracks(clipName: AnimationClip3D, hipsRestY: number): THREE.KeyframeTrack[] {
  const tracks: THREE.KeyframeTrack[] = [];
  const addQ = (bone: string, times: number[], rots: Array<[number, number, number]>) => {
    const vals: number[] = [];
    for (const [rx, ry, rz] of rots) vals.push(...qArr(rx, ry, rz));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, vals));
  };
  const addPos = (bone: string, times: number[], pts: Array<[number, number, number]>) => {
    const vals: number[] = [];
    for (const [px, py, pz] of pts) vals.push(px, py, pz);
    tracks.push(new THREE.VectorKeyframeTrack(`${bone}.position`, times, vals));
  };

  switch (clipName) {
    case 'Walk': {
      const t = [0, 0.25, 0.5, 0.75, 1.0];
      addPos('hips', t, [
        [0, hipsRestY, 0],
        [0, hipsRestY + 0.04, 0],
        [0, hipsRestY, 0],
        [0, hipsRestY + 0.04, 0],
        [0, hipsRestY, 0],
      ]);
      addQ('hips', t, [[0.03, 0.06, 0], [0.04, 0, 0.03], [0.03, -0.06, 0], [0.04, 0, -0.03], [0.03, 0.06, 0]]);
      addQ('thighL', t, [[0.48, 0, 0], [0, 0, 0], [-0.48, 0, 0], [0, 0, 0], [0.48, 0, 0]]);
      addQ('shinL', t, [[-0.15, 0, 0], [-0.55, 0, 0], [-0.1, 0, 0], [-0.15, 0, 0], [-0.15, 0, 0]]);
      addQ('thighR', t, [[-0.48, 0, 0], [0, 0, 0], [0.48, 0, 0], [0, 0, 0], [-0.48, 0, 0]]);
      addQ('shinR', t, [[-0.1, 0, 0], [-0.15, 0, 0], [-0.15, 0, 0], [-0.55, 0, 0], [-0.1, 0, 0]]);
      addQ('upperArmL', t, [[-0.38, 0, 0.08], [0, 0, 0.08], [0.38, 0, 0.08], [0, 0, 0.08], [-0.38, 0, 0.08]]);
      addQ('upperArmR', t, [[0.38, 0, -0.08], [0, 0, -0.08], [-0.38, 0, -0.08], [0, 0, -0.08], [0.38, 0, -0.08]]);
      addQ('spine', t, [[0.04, -0.05, 0], [0.04, 0, 0], [0.04, 0.05, 0], [0.04, 0, 0], [0.04, -0.05, 0]]);
      break;
    }
    case 'Run': {
      const t = [0, 0.16, 0.32, 0.48, 0.64];
      addPos('hips', t, [
        [0, hipsRestY + 0.06, 0],
        [0, hipsRestY - 0.02, 0],
        [0, hipsRestY + 0.06, 0],
        [0, hipsRestY - 0.02, 0],
        [0, hipsRestY + 0.06, 0],
      ]);
      addQ('spine', [0, 0.64], [[0.22, 0, 0], [0.22, 0, 0]]);
      addQ('thighL', t, [[0.85, 0, 0], [0, 0, 0], [-0.72, 0, 0], [0.1, 0, 0], [0.85, 0, 0]]);
      addQ('shinL', t, [[-0.25, 0, 0], [-0.95, 0, 0], [-0.3, 0, 0], [-0.8, 0, 0], [-0.25, 0, 0]]);
      addQ('thighR', t, [[-0.72, 0, 0], [0.1, 0, 0], [0.85, 0, 0], [0, 0, 0], [-0.72, 0, 0]]);
      addQ('shinR', t, [[-0.3, 0, 0], [-0.8, 0, 0], [-0.25, 0, 0], [-0.95, 0, 0], [-0.3, 0, 0]]);
      addQ('upperArmL', t, [[-0.8, 0, 0.12], [0, 0, 0.12], [0.8, 0, 0.12], [0, 0, 0.12], [-0.8, 0, 0.12]]);
      addQ('forearmL', [0, 0.64], [[0.85, 0, 0], [0.85, 0, 0]]);
      addQ('upperArmR', t, [[0.8, 0, -0.12], [0, 0, -0.12], [-0.8, 0, -0.12], [0, 0, -0.12], [0.8, 0, -0.12]]);
      addQ('forearmR', [0, 0.64], [[0.85, 0, 0], [0.85, 0, 0]]);
      break;
    }
    case 'Jump': {
      const t = [0, 0.25, 0.65, 1.05, 1.3];
      addPos('hips', t, [
        [0, hipsRestY - 0.12, 0],
        [0, hipsRestY + 0.58, 0],
        [0, hipsRestY + 0.72, 0],
        [0, hipsRestY - 0.1, 0],
        [0, hipsRestY, 0],
      ]);
      addQ('thighL', t, [[0.45, 0, 0], [-0.2, 0, 0], [0.55, 0, 0], [0.35, 0, 0], [0, 0, 0]]);
      addQ('thighR', t, [[0.45, 0, 0], [-0.2, 0, 0], [0.55, 0, 0], [0.35, 0, 0], [0, 0, 0]]);
      addQ('upperArmL', t, [[-0.3, 0, 0.2], [0.1, 0, 2.4], [0.2, 0, 2.6], [-0.2, 0, 0.4], [0, 0, 0.1]]);
      addQ('upperArmR', t, [[-0.3, 0, -0.2], [0.1, 0, -2.4], [0.2, 0, -2.6], [-0.2, 0, -0.4], [0, 0, -0.1]]);
      break;
    }
    case 'Sit': {
      const t = [0, 1.2, 2.4];
      addPos('hips', t, [
        [0, hipsRestY - 0.34, -0.06],
        [0, hipsRestY - 0.35, -0.06],
        [0, hipsRestY - 0.34, -0.06],
      ]);
      addQ('thighL', t, [[1.38, 0, 0.06], [1.38, 0, 0.06], [1.38, 0, 0.06]]);
      addQ('shinL', t, [[-1.35, 0, 0], [-1.35, 0, 0], [-1.35, 0, 0]]);
      addQ('thighR', t, [[1.38, 0, -0.06], [1.38, 0, -0.06], [1.38, 0, -0.06]]);
      addQ('shinR', t, [[-1.35, 0, 0], [-1.35, 0, 0], [-1.35, 0, 0]]);
      addQ('upperArmL', t, [[0.4, 0, 0.1], [0.42, 0, 0.12], [0.4, 0, 0.1]]);
      addQ('upperArmR', t, [[0.4, 0, -0.1], [0.42, 0, -0.12], [0.4, 0, -0.1]]);
      addQ('spine', t, [[0.03, 0, 0], [0.06, 0.03, 0], [0.03, 0, 0]]);
      break;
    }
    case 'Talk': {
      const t = [0, 0.4, 0.85, 1.3, 1.7];
      addPos('hips', t, [
        [0, hipsRestY, 0],
        [0, hipsRestY + 0.015, 0],
        [0, hipsRestY, 0],
        [0, hipsRestY + 0.015, 0],
        [0, hipsRestY, 0],
      ]);
      addQ('spine', t, [[0, 0, 0], [0.05, 0.08, 0], [0.02, -0.06, 0], [0.06, 0.04, 0], [0, 0, 0]]);
      addQ('upperArmR', t, [[0.45, 0, -0.25], [0.85, 0.25, -0.4], [0.55, -0.1, -0.2], [0.95, 0.2, -0.35], [0.45, 0, -0.25]]);
      addQ('forearmR', t, [[0.7, 0, 0], [1.1, 0, 0], [0.65, 0, 0], [1.05, 0, 0], [0.7, 0, 0]]);
      addQ('upperArmL', t, [[0.2, 0, 0.15], [0.5, -0.15, 0.28], [0.25, 0, 0.18], [0.4, 0.1, 0.22], [0.2, 0, 0.15]]);
      addQ('forearmL', t, [[0.4, 0, 0], [0.85, 0, 0], [0.45, 0, 0], [0.75, 0, 0], [0.4, 0, 0]]);
      break;
    }
    case 'Turn': {
      const t = [0, 0.6, 1.2, 1.8];
      addQ('hips', t, [[0, 0, 0], [0, 0.8, 0], [0, -0.8, 0], [0, 0, 0]]);
      addQ('spine', t, [[0, 0, 0], [0, 0.25, 0], [0, -0.25, 0], [0, 0, 0]]);
      addQ('upperArmL', t, [[0, 0, 0.15], [0.2, 0, 0.25], [-0.2, 0, 0.2], [0, 0, 0.15]]);
      addQ('upperArmR', t, [[0, 0, -0.15], [-0.2, 0, -0.2], [0.2, 0, -0.25], [0, 0, -0.15]]);
      break;
    }
    case 'LookAround': {
      const t = [0, 0.65, 1.4, 2.1, 2.8];
      addQ('neck', t, [[0, 0, 0], [0.05, 0.45, 0.04], [0, 0.05, 0], [0.05, -0.45, -0.04], [0, 0, 0]]);
      addQ('spine', t, [[0, 0, 0], [0.02, 0.12, 0], [0, 0, 0], [0.02, -0.12, 0], [0, 0, 0]]);
      addQ('upperArmL', t, [[0.15, 0, 0.12], [0.3, 0, 0.18], [0.15, 0, 0.12], [0.25, 0, 0.15], [0.15, 0, 0.12]]);
      addQ('upperArmR', t, [[0.15, 0, -0.12], [0.25, 0, -0.15], [0.15, 0, -0.12], [0.3, 0, -0.18], [0.15, 0, -0.12]]);
      break;
    }
    case 'Fear': {
      const t = [0, 0.18, 0.36, 0.54, 0.72];
      addPos('hips', t, [
        [0, hipsRestY - 0.08, 0],
        [0, hipsRestY - 0.1, 0],
        [0, hipsRestY - 0.08, 0],
        [0, hipsRestY - 0.1, 0],
        [0, hipsRestY - 0.08, 0],
      ]);
      addQ('spine', t, [[-0.14, 0.04, 0], [-0.16, -0.04, 0], [-0.14, 0.04, 0], [-0.16, -0.04, 0], [-0.14, 0.04, 0]]);
      addQ('upperArmL', t, [[0.9, 0, 0.45], [0.95, 0, 0.52], [0.9, 0, 0.45], [0.95, 0, 0.52], [0.9, 0, 0.45]]);
      addQ('forearmL', t, [[1.2, 0, 0], [1.3, 0, 0], [1.2, 0, 0], [1.3, 0, 0], [1.2, 0, 0]]);
      addQ('upperArmR', t, [[0.9, 0, -0.45], [0.95, 0, -0.52], [0.9, 0, -0.45], [0.95, 0, -0.52], [0.9, 0, -0.45]]);
      addQ('forearmR', t, [[1.2, 0, 0], [1.3, 0, 0], [1.2, 0, 0], [1.3, 0, 0], [1.2, 0, 0]]);
      break;
    }
    case 'Smile': {
      const t = [0, 0.45, 0.9, 1.35];
      addPos('hips', t, [
        [0, hipsRestY, 0],
        [0, hipsRestY + 0.05, 0],
        [0, hipsRestY, 0],
        [0, hipsRestY, 0],
      ]);
      addQ('upperArmL', t, [[0.15, 0, 0.25], [0.35, 0, 0.9], [0.2, 0, 0.35], [0.15, 0, 0.25]]);
      addQ('upperArmR', t, [[0.15, 0, -0.25], [0.35, 0, -0.9], [0.2, 0, -0.35], [0.15, 0, -0.25]]);
      addQ('neck', t, [[0, 0, 0], [-0.08, 0.06, 0.08], [0, 0, -0.05], [0, 0, 0]]);
      break;
    }
    case 'Cry': {
      const t = [0, 0.35, 0.7, 1.05, 1.4];
      addPos('hips', t, [
        [0, hipsRestY - 0.05, 0],
        [0, hipsRestY - 0.07, 0],
        [0, hipsRestY - 0.05, 0],
        [0, hipsRestY - 0.07, 0],
        [0, hipsRestY - 0.05, 0],
      ]);
      addQ('spine', t, [[0.22, 0, 0], [0.28, 0, 0.03], [0.22, 0, 0], [0.28, 0, -0.03], [0.22, 0, 0]]);
      addQ('neck', t, [[0.25, 0, 0], [0.32, 0, 0], [0.25, 0, 0], [0.32, 0, 0], [0.25, 0, 0]]);
      addQ('upperArmL', [0, 1.4], [[1.15, 0.2, 0.1], [1.15, 0.2, 0.1]]);
      addQ('forearmL', [0, 1.4], [[1.35, 0, 0], [1.35, 0, 0]]);
      addQ('upperArmR', [0, 1.4], [[1.15, -0.2, -0.1], [1.15, -0.2, -0.1]]);
      addQ('forearmR', [0, 1.4], [[1.35, 0, 0], [1.35, 0, 0]]);
      break;
    }
    case 'Action': {
      const t = [0, 0.3, 0.65, 1.0, 1.3];
      addPos('hips', t, [
        [0, hipsRestY, 0],
        [0, hipsRestY + 0.06, 0],
        [0, hipsRestY + 0.02, 0],
        [0, hipsRestY + 0.05, 0],
        [0, hipsRestY, 0],
      ]);
      addQ('spine', t, [[0, 0, 0], [-0.08, -0.22, 0], [0.12, 0.28, 0], [0.05, 0.1, 0], [0, 0, 0]]);
      addQ('upperArmR', t, [[0.2, 0, -0.2], [0.4, 0, -1.6], [1.55, 0.25, -0.2], [0.7, 0, -0.5], [0.2, 0, -0.2]]);
      addQ('forearmR', t, [[0.4, 0, 0], [0.7, 0, 0], [0.2, 0, 0], [0.5, 0, 0], [0.4, 0, 0]]);
      addQ('upperArmL', t, [[0.2, 0, 0.2], [0.3, 0, 0.6], [-0.3, 0, 0.3], [0.1, 0, 0.2], [0.2, 0, 0.2]]);
      break;
    }
    case 'Idle':
    default: {
      const t = [0, 1.2, 2.4];
      addPos('hips', t, [
        [0, hipsRestY, 0],
        [0, hipsRestY + 0.02, 0],
        [0, hipsRestY, 0],
      ]);
      addQ('spine', t, [[0, 0, 0], [-0.025, 0, 0], [0, 0, 0]]);
      addQ('upperArmL', t, [[0.04, 0, 0.12], [0.07, 0, 0.15], [0.04, 0, 0.12]]);
      addQ('upperArmR', t, [[0.04, 0, -0.12], [0.07, 0, -0.15], [0.04, 0, -0.12]]);
      break;
    }
  }

  return tracks;
}

/**
 * Builds a complete hierarchical THREE.Bone + THREE.Skeleton + THREE.AnimationClip
 * procedural 3D character rig with facial expression & jaw lip-sync support.
 */
export function buildProceduralCharacterRig(
  char: CharacterDef,
  style: StylePreset3DRuntime
): CharacterRigHandle {
  const group = new THREE.Group();
  group.name = `char_${char.id}`;

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  // Proportions derived from age, body, and 3D style preset
  const ageScale = char.age === 'child' ? 0.78 : char.age === 'elder' ? 0.96 : 1.0;
  const bodyWidth = char.body === 'chubby' ? 1.22 : char.body === 'slim' ? 0.86 : 1.0;
  const propHeadScale =
    char.proportion3d === 'chibi' ? 1.32 : char.proportion3d === 'realistic' ? 0.88 : style.headScale;
  const legLen = char.proportion3d === 'chibi' ? 0.56 : 0.72;
  const torsoH = char.proportion3d === 'chibi' ? 0.48 : 0.58;
  const hipsRestY = legLen;

  // Materials
  const skinMat = track(makeMat(char.skin || '#f2c8a2', style, { roughness: 0.58, isSkin: true }));
  const shirtMat = track(makeMat(char.shirt || '#3b82f6', style, { roughness: 0.75, isCloth: true }));
  const accentMat = track(makeMat(char.outfitAccent || '#f59e0b', style, { roughness: 0.65 }));
  const pantsMat = track(makeMat(char.pants || '#334155', style, { roughness: 0.8, isCloth: true }));
  const shoeMat = track(makeMat(char.shoes || '#1e293b', style, { roughness: 0.55 }));
  const hairMat = track(makeMat(char.hair || '#2b2522', style, { roughness: 0.62 }));
  const eyeWhiteMat = track(makeMat('#ffffff', style, { roughness: 0.2 }));
  const pupilMat = track(makeMat('#151722', style, { roughness: 0.12 }));
  const browMat = track(makeMat(char.hair || '#2b2522', style, { roughness: 0.5 }));
  const mouthMat = track(makeMat('#8b2635', style, { roughness: 0.45 }));

  // Helper to optionally add subtle anime toon outline mesh
  const addMeshWithOutline = (
    parent: THREE.Object3D,
    geom: THREE.BufferGeometry,
    mat: THREE.Material,
    pos?: [number, number, number],
    rot?: [number, number, number]
  ) => {
    track(geom);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(mesh);

    if (style.outlineWidth > 0) {
      const outMat = track(
        new THREE.MeshBasicMaterial({
          color: 0x161224,
          side: THREE.BackSide,
        })
      );
      const outMesh = new THREE.Mesh(geom, outMat);
      outMesh.scale.setScalar(1 + style.outlineWidth);
      mesh.add(outMesh);
    }
    return mesh;
  };

  // --- Skeleton Bone Hierarchy ---
  const rootBone = new THREE.Bone();
  rootBone.name = 'root';

  const hips = new THREE.Bone();
  hips.name = 'hips';
  hips.position.set(0, hipsRestY, 0);
  rootBone.add(hips);

  const spine = new THREE.Bone();
  spine.name = 'spine';
  spine.position.set(0, 0.14, 0);
  hips.add(spine);

  const chest = new THREE.Bone();
  chest.name = 'chest';
  chest.position.set(0, torsoH * 0.52, 0);
  spine.add(chest);

  const neck = new THREE.Bone();
  neck.name = 'neck';
  neck.position.set(0, torsoH * 0.44, 0);
  chest.add(neck);

  const head = new THREE.Bone();
  head.name = 'head';
  head.position.set(0, 0.12, 0);
  neck.add(head);

  const jaw = new THREE.Bone();
  jaw.name = 'jaw';
  jaw.position.set(0, 0.08 * propHeadScale, 0.16 * propHeadScale);
  head.add(jaw);

  // Arms
  const shoulderOffsetX = 0.165 * bodyWidth;
  const shoulderL = new THREE.Bone();
  shoulderL.name = 'shoulderL';
  shoulderL.position.set(shoulderOffsetX, torsoH * 0.3, 0);
  chest.add(shoulderL);

  const upperArmL = new THREE.Bone();
  upperArmL.name = 'upperArmL';
  upperArmL.position.set(0.03, 0, 0);
  shoulderL.add(upperArmL);

  const forearmL = new THREE.Bone();
  forearmL.name = 'forearmL';
  forearmL.position.set(0, -0.24, 0);
  upperArmL.add(forearmL);

  const handL = new THREE.Bone();
  handL.name = 'handL';
  handL.position.set(0, -0.22, 0);
  forearmL.add(handL);

  const shoulderR = new THREE.Bone();
  shoulderR.name = 'shoulderR';
  shoulderR.position.set(-shoulderOffsetX, torsoH * 0.3, 0);
  chest.add(shoulderR);

  const upperArmR = new THREE.Bone();
  upperArmR.name = 'upperArmR';
  upperArmR.position.set(-0.03, 0, 0);
  shoulderR.add(upperArmR);

  const forearmR = new THREE.Bone();
  forearmR.name = 'forearmR';
  forearmR.position.set(0, -0.24, 0);
  upperArmR.add(forearmR);

  const handR = new THREE.Bone();
  handR.name = 'handR';
  handR.position.set(0, -0.22, 0);
  forearmR.add(handR);

  // Legs
  const hipOffsetX = 0.105 * bodyWidth;
  const thighL = new THREE.Bone();
  thighL.name = 'thighL';
  thighL.position.set(hipOffsetX, 0.0, 0);
  hips.add(thighL);

  const shinL = new THREE.Bone();
  shinL.name = 'shinL';
  shinL.position.set(0, -legLen * 0.46, 0);
  thighL.add(shinL);

  const footL = new THREE.Bone();
  footL.name = 'footL';
  footL.position.set(0, -legLen * 0.45, 0.04);
  shinL.add(footL);

  const thighR = new THREE.Bone();
  thighR.name = 'thighR';
  thighR.position.set(-hipOffsetX, 0.0, 0);
  hips.add(thighR);

  const shinR = new THREE.Bone();
  shinR.name = 'shinR';
  shinR.position.set(0, -legLen * 0.46, 0);
  thighR.add(shinR);

  const footR = new THREE.Bone();
  footR.name = 'footR';
  footR.position.set(0, -legLen * 0.45, 0.04);
  shinR.add(footR);

  // --- Geometry Attached to Bones ---
  // Pelvis / Hips
  addMeshWithOutline(
    hips,
    new THREE.CylinderGeometry(0.16 * bodyWidth, 0.17 * bodyWidth, 0.18, 16),
    char.outfit === 'dress' ? shirtMat : pantsMat,
    [0, 0.04, 0]
  );

  // Dress skirt or Suit coat tails
  if (char.outfit === 'dress' || char.outfit === 'apron') {
    addMeshWithOutline(
      hips,
      new THREE.CylinderGeometry(0.17 * bodyWidth, 0.28 * bodyWidth, 0.34, 18),
      char.outfit === 'apron' ? accentMat : shirtMat,
      [0, -0.1, 0]
    );
  }

  // Spine + Chest Torso
  addMeshWithOutline(
    spine,
    new THREE.CapsuleGeometry(0.165 * bodyWidth, torsoH * 0.55, 8, 16),
    shirtMat,
    [0, torsoH * 0.34, 0]
  );

  // Outfit collar / tie / hoodie hood / plaid accent
  if (char.outfit === 'hoodie') {
    addMeshWithOutline(
      chest,
      new THREE.TorusGeometry(0.14 * bodyWidth, 0.045, 10, 18),
      shirtMat,
      [0, torsoH * 0.34, -0.02],
      [Math.PI / 2.2, 0, 0]
    );
  } else if (char.outfit === 'suit' || char.outfit === 'uniform') {
    addMeshWithOutline(
      chest,
      new THREE.BoxGeometry(0.06, 0.24, 0.04),
      accentMat,
      [0, torsoH * 0.16, 0.15 * bodyWidth]
    );
  } else if (char.outfit === 'coat' || char.outfit === 'plaid_shirt') {
    addMeshWithOutline(
      chest,
      new THREE.BoxGeometry(0.28 * bodyWidth, 0.28, 0.05),
      accentMat,
      [0, torsoH * 0.12, 0.14 * bodyWidth]
    );
  }

  // Backpack accessory
  if (char.accessories?.includes('backpack')) {
    addMeshWithOutline(
      chest,
      new THREE.BoxGeometry(0.26, 0.32, 0.16),
      accentMat,
      [0, torsoH * 0.12, -0.22 * bodyWidth]
    );
  }
  if (char.accessories?.includes('scarf')) {
    addMeshWithOutline(
      neck,
      new THREE.TorusGeometry(0.11, 0.045, 10, 18),
      accentMat,
      [0, 0.02, 0],
      [Math.PI / 2, 0, 0]
    );
  }

  // Neck
  addMeshWithOutline(neck, new THREE.CylinderGeometry(0.06, 0.07, 0.12, 12), skinMat, [0, 0.06, 0]);

  // Head Sphere (scaled by propHeadScale)
  const hr = 0.22 * propHeadScale;
  addMeshWithOutline(head, new THREE.SphereGeometry(hr, 22, 18), skinMat, [0, hr * 0.92, 0]);

  // Ears (Human or Cat/Dog)
  if (char.species === 'cat' || char.species === 'dog') {
    const earG = new THREE.ConeGeometry(hr * 0.28, hr * 0.55, 8);
    addMeshWithOutline(head, earG, hairMat, [-hr * 0.6, hr * 1.72, 0], [0, 0, 0.35]);
    addMeshWithOutline(head, earG.clone(), hairMat, [hr * 0.6, hr * 1.72, 0], [0, 0, -0.35]);
  } else {
    const earG = new THREE.SphereGeometry(hr * 0.2, 10, 10);
    addMeshWithOutline(head, earG, skinMat, [-hr * 0.96, hr * 0.9, 0]);
    addMeshWithOutline(head, earG.clone(), skinMat, [hr * 0.96, hr * 0.9, 0]);
  }

  // Eyes & Brows
  const eyeY = hr * 1.0;
  const eyeZ = hr * 0.86;
  const eyeX = hr * 0.38;
  const eyeLGroup = new THREE.Group();
  eyeLGroup.position.set(eyeX, eyeY, eyeZ);
  const eyeRGroup = new THREE.Group();
  eyeRGroup.position.set(-eyeX, eyeY, eyeZ);
  head.add(eyeLGroup, eyeRGroup);

  const scleraGeo = new THREE.SphereGeometry(hr * 0.19, 12, 12);
  const pupilGeo = new THREE.SphereGeometry(hr * 0.1, 10, 10);
  addMeshWithOutline(eyeLGroup, scleraGeo, eyeWhiteMat, [0, 0, 0]);
  addMeshWithOutline(eyeLGroup, pupilGeo, pupilMat, [0, 0, hr * 0.13]);
  addMeshWithOutline(eyeRGroup, scleraGeo.clone(), eyeWhiteMat, [0, 0, 0]);
  addMeshWithOutline(eyeRGroup, pupilGeo.clone(), pupilMat, [0, 0, hr * 0.13]);

  const browGeo = new THREE.BoxGeometry(hr * 0.32, hr * 0.055, hr * 0.06);
  const browL = addMeshWithOutline(head, browGeo, browMat, [eyeX, eyeY + hr * 0.24, eyeZ + 0.02]);
  const browR = addMeshWithOutline(head, browGeo.clone(), browMat, [-eyeX, eyeY + hr * 0.24, eyeZ + 0.02]);

  // Nose
  addMeshWithOutline(
    head,
    new THREE.SphereGeometry(hr * 0.11, 10, 10),
    skinMat,
    [0, hr * 0.82, hr * 0.98]
  );

  // Mouth / Jaw mesh
  const mouthMesh = addMeshWithOutline(
    jaw,
    new THREE.BoxGeometry(hr * 0.38, hr * 0.1, hr * 0.08),
    mouthMat,
    [0, 0, 0]
  );
  jaw.position.set(0, hr * 0.56, hr * 0.86);

  // Hair Styles (smooth contoured cap + natural fringe + temple side locks)
  if (char.hairStyle !== 'bald') {
    addMeshWithOutline(
      head,
      new THREE.SphereGeometry(hr * 1.08, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat,
      [0, hr * 0.98, -hr * 0.04]
    );
    // Smooth tucked forehead fringe hugging the skull line (no protruding bumps)
    const fringeCrown = new THREE.SphereGeometry(hr * 0.84, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
    fringeCrown.scale(1.12, 0.52, 0.78);
    addMeshWithOutline(head, fringeCrown, hairMat, [0, hr * 1.38, hr * 0.36], [0.28, 0, 0]);
    const fringeSide = new THREE.SphereGeometry(hr * 0.36, 12, 10);
    fringeSide.scale(1.1, 0.65, 0.72);
    addMeshWithOutline(head, fringeSide, hairMat, [-hr * 0.42, hr * 1.34, hr * 0.58], [0.22, 0, 0.25]);
    // Tapered temple side locks
    const templeGeo = new THREE.CapsuleGeometry(hr * 0.12, hr * 0.34, 4, 8);
    addMeshWithOutline(head, templeGeo, hairMat, [-hr * 0.88, hr * 1.12, hr * 0.02]);
    addMeshWithOutline(head, templeGeo.clone(), hairMat, [hr * 0.88, hr * 1.12, hr * 0.02]);
    if (char.hairStyle === 'long') {
      addMeshWithOutline(
        head,
        new THREE.CapsuleGeometry(hr * 0.85, hr * 0.9, 6, 14),
        hairMat,
        [0, hr * 0.45, -hr * 0.32]
      );
    } else if (char.hairStyle === 'bun') {
      addMeshWithOutline(
        head,
        new THREE.SphereGeometry(hr * 0.46, 14, 12),
        hairMat,
        [0, hr * 1.85, -hr * 0.48]
      );
    } else if (char.hairStyle === 'ponytail') {
      addMeshWithOutline(
        head,
        new THREE.ConeGeometry(hr * 0.35, hr * 1.05, 12),
        hairMat,
        [0, hr * 0.9, -hr * 1.15],
        [-2.3, 0, 0]
      );
    } else if (char.hairStyle === 'curly') {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        addMeshWithOutline(
          head,
          new THREE.SphereGeometry(hr * 0.38, 10, 10),
          hairMat,
          [Math.cos(ang) * hr * 0.65, hr * 1.55, Math.sin(ang) * hr * 0.65 - hr * 0.1]
        );
      }
    }
  }

  // Glasses
  if (char.glasses || char.accessories?.includes('glasses')) {
    const glassMat = track(makeMat('#1e293b', style, { roughness: 0.25, metalness: 0.6 }));
    const rimGeo = new THREE.TorusGeometry(hr * 0.24, hr * 0.025, 8, 20);
    addMeshWithOutline(head, rimGeo, glassMat, [eyeX, eyeY, eyeZ + hr * 0.16]);
    addMeshWithOutline(head, rimGeo.clone(), glassMat, [-eyeX, eyeY, eyeZ + hr * 0.16]);
    addMeshWithOutline(
      head,
      new THREE.BoxGeometry(hr * 0.28, hr * 0.028, hr * 0.028),
      glassMat,
      [0, eyeY + hr * 0.03, eyeZ + hr * 0.16]
    );
  }

  // Hat / Cap / Flower Hat / Headphones
  if (
    char.hairStyle === 'cap' ||
    char.accessories?.includes('hat') ||
    char.accessories?.includes('flower_hat')
  ) {
    const hatMat = track(
      makeMat(char.accessories?.includes('flower_hat') ? '#eab308' : '#334155', style, {
        roughness: 0.7,
      })
    );
    addMeshWithOutline(head, new THREE.CylinderGeometry(hr * 0.95, hr * 1.05, hr * 0.45, 16), hatMat, [
      0,
      hr * 1.75,
      0,
    ]);
    addMeshWithOutline(head, new THREE.CylinderGeometry(hr * 1.4, hr * 1.4, hr * 0.08, 18), hatMat, [
      0,
      hr * 1.56,
      0.04,
    ]);
  }
  if (char.accessories?.includes('headphones')) {
    const hpMat = track(makeMat('#0f172a', style, { roughness: 0.3, metalness: 0.5 }));
    addMeshWithOutline(head, new THREE.TorusGeometry(hr * 1.06, hr * 0.06, 8, 20, Math.PI), hpMat, [
      0,
      hr * 1.0,
      0,
    ]);
    addMeshWithOutline(head, new THREE.CylinderGeometry(hr * 0.26, hr * 0.26, hr * 0.12, 12), hpMat, [
      hr * 1.06,
      hr * 0.95,
      0,
    ], [0, 0, Math.PI / 2]);
    addMeshWithOutline(head, new THREE.CylinderGeometry(hr * 0.26, hr * 0.26, hr * 0.12, 12), hpMat, [
      -hr * 1.06,
      hr * 0.95,
      0,
    ], [0, 0, Math.PI / 2]);
  }

  // Arms geometry (seamless shoulder caps + long sleeve support)
  const armR = 0.068 * bodyWidth;
  const longSleeve =
    char.outfit === 'hoodie' ||
    char.outfit === 'coat' ||
    char.outfit === 'suit' ||
    char.outfit === 'uniform' ||
    char.outfit === 'plaid_shirt';
  const forearmMat = longSleeve ? shirtMat : skinMat;
  addMeshWithOutline(shoulderL, new THREE.SphereGeometry(armR * 1.08, 12, 10), shirtMat, [0.02, -0.01, 0]);
  addMeshWithOutline(upperArmL, new THREE.CapsuleGeometry(armR, 0.18, 6, 10), shirtMat, [0, -0.11, 0]);
  addMeshWithOutline(forearmL, new THREE.CapsuleGeometry(armR * 0.86, 0.16, 6, 10), forearmMat, [0, -0.11, 0]);
  addMeshWithOutline(handL, new THREE.SphereGeometry(armR * 0.98, 10, 10), skinMat, [0, -0.02, 0]);

  addMeshWithOutline(shoulderR, new THREE.SphereGeometry(armR * 1.08, 12, 10), shirtMat, [-0.02, -0.01, 0]);
  addMeshWithOutline(upperArmR, new THREE.CapsuleGeometry(armR, 0.18, 6, 10), shirtMat, [0, -0.11, 0]);
  addMeshWithOutline(forearmR, new THREE.CapsuleGeometry(armR * 0.86, 0.16, 6, 10), forearmMat, [0, -0.11, 0]);
  addMeshWithOutline(handR, new THREE.SphereGeometry(armR * 0.98, 10, 10), skinMat, [0, -0.02, 0]);

  // Legs geometry (tighter hip/knee overlap for clean silhouette)
  const legR = 0.09 * bodyWidth;
  addMeshWithOutline(thighL, new THREE.CapsuleGeometry(legR, legLen * 0.38, 6, 12), pantsMat, [0, -legLen * 0.22, 0]);
  addMeshWithOutline(shinL, new THREE.CapsuleGeometry(legR * 0.85, legLen * 0.36, 6, 12), pantsMat, [0, -legLen * 0.22, 0]);
  addMeshWithOutline(footL, new THREE.BoxGeometry(0.14, 0.09, 0.24), shoeMat, [0, -0.02, 0.04]);

  addMeshWithOutline(thighR, new THREE.CapsuleGeometry(legR, legLen * 0.38, 6, 12), pantsMat, [0, -legLen * 0.22, 0]);
  addMeshWithOutline(shinR, new THREE.CapsuleGeometry(legR * 0.85, legLen * 0.36, 6, 12), pantsMat, [0, -legLen * 0.22, 0]);
  addMeshWithOutline(footR, new THREE.BoxGeometry(0.14, 0.09, 0.24), shoeMat, [0, -0.02, 0.04]);

  // Robot visor detail if species === 'robot'
  if (char.species === 'robot') {
    const visorMat = track(
      new THREE.MeshStandardMaterial({
        color: '#0ea5e9',
        emissive: '#0284c7',
        emissiveIntensity: 0.7,
        roughness: 0.2,
      })
    );
    addMeshWithOutline(head, new THREE.BoxGeometry(hr * 1.35, hr * 0.36, hr * 0.2), visorMat, [
      0,
      eyeY,
      eyeZ + 0.05,
    ]);
  }

  group.add(rootBone);
  group.scale.setScalar(ageScale);

  const allBones: THREE.Bone[] = [];
  rootBone.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) allBones.push(obj as THREE.Bone);
  });
  const bonesMap: Record<string, THREE.Bone> = {};
  for (const b of allBones) bonesMap[b.name] = b;

  const skeleton = new THREE.Skeleton(allBones);
  const mixer = new THREE.AnimationMixer(rootBone);

  const allClipNames: AnimationClip3D[] = [
    'Idle',
    'Walk',
    'Run',
    'Turn',
    'Jump',
    'Sit',
    'Talk',
    'LookAround',
    'Fear',
    'Smile',
    'Cry',
    'Action',
  ];

  const actions: Partial<Record<AnimationClip3D, THREE.AnimationAction>> = {};
  for (const name of allClipNames) {
    const tracks = buildClipTracks(name, hipsRestY);
    const clip = new THREE.AnimationClip(name, -1, tracks);
    const action = mixer.clipAction(clip);
    actions[name] = action;
  }

  let currentClip: AnimationClip3D = 'Idle';
  actions.Idle?.play();

  let quantizedAccum = 0;

  const handle: CharacterRigHandle = {
    characterId: char.id,
    group,
    bones: bonesMap,
    skeleton,
    mixer,
    actions,
    currentClip,
    isCustomGlb: false,
    customClipNames: allClipNames,
    setClip: (clipName: AnimationClip3D, fadeSec = 0.25) => {
      if (handle.currentClip === clipName) return;
      const next = actions[clipName] || actions.Idle;
      const prev = actions[handle.currentClip];
      if (!next) return;
      next.reset();
      next.play();
      if (prev && prev !== next) {
        if (fadeSec > 0) {
          prev.crossFadeTo(next, fadeSec, false);
        } else {
          prev.stop();
        }
      }
      handle.currentClip = clipName;
    },
    setExpression: (face: ActorFace, lipOpenness: number, timeSec: number, lookTarget = 'camera') => {
      // Automatic natural blinking every ~3.4 seconds
      const blinkCycle = timeSec % 3.4;
      const blinkScaleY = blinkCycle > 3.24 && blinkCycle < 3.38 ? 0.12 : 1.0;
      const wideEye = face === 'scared' || face === 'surprised' ? 1.24 : 1.0;
      eyeLGroup.scale.set(1, blinkScaleY * wideEye, 1);
      eyeRGroup.scale.set(1, blinkScaleY * wideEye, 1);

      // Eyebrow rotation & height by face emotion
      let browAngle = 0;
      let browLift = 0;
      if (face === 'angry') {
        browAngle = 0.28;
        browLift = -0.02;
      } else if (face === 'sad' || face === 'worried') {
        browAngle = -0.24;
        browLift = 0.015;
      } else if (face === 'surprised' || face === 'scared') {
        browLift = 0.045;
      } else if (face === 'happy' || face === 'smirk') {
        browLift = 0.025;
      }
      browL.rotation.z = -browAngle;
      browR.rotation.z = browAngle;
      browL.position.y = eyeY + hr * 0.24 + browLift;
      browR.position.y = eyeY + hr * 0.24 + browLift;

      // Mouth / Jaw lip-sync + expression curve
      const openScale = 0.4 + Math.max(0, Math.min(1, lipOpenness)) * 2.1;
      const smileWidth = face === 'happy' || face === 'smirk' ? 1.28 : face === 'surprised' ? 0.72 : 1.0;
      mouthMesh.scale.set(smileWidth, openScale, 1);
      jaw.position.y = hr * 0.56 - Math.max(0, Math.min(1, lipOpenness)) * hr * 0.08;

      // Subtle head tracking
      if (lookTarget === 'left') head.rotation.y = 0.28;
      else if (lookTarget === 'right') head.rotation.y = -0.28;
      else head.rotation.y = Math.sin(timeSec * 0.9) * 0.05;
    },
    updateAnimation: (deltaSec: number, absoluteTimeSec?: number, stopMotionFps = 0) => {
      if (typeof absoluteTimeSec === 'number') {
        const effTime =
          stopMotionFps > 0
            ? Math.floor(absoluteTimeSec * stopMotionFps) / stopMotionFps
            : absoluteTimeSec;
        mixer.setTime(effTime);
        return;
      }
      if (stopMotionFps > 0) {
        quantizedAccum += deltaSec;
        const step = 1 / stopMotionFps;
        if (quantizedAccum >= step) {
          const steps = Math.floor(quantizedAccum / step);
          quantizedAccum -= steps * step;
          mixer.update(steps * step);
        }
      } else {
        mixer.update(deltaSec);
      }
    },
    dispose: () => {
      mixer.stopAllAction();
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          // ignore
        }
      }
    },
  };

  return handle;
}

export interface GlbInspectResult {
  hasSkeleton: boolean;
  boneNames: string[];
  clipNames: string[];
  meshCount: number;
}

/**
 * Parses and inspects an uploaded .glb/.gltf Blob using Three.js GLTFLoader.
 * Honestly reports bones & animation clips without pretending un-rigged meshes are skeletal.
 */
export async function inspectGlbBlob(blob: Blob): Promise<GlbInspectResult> {
  const loader = new GLTFLoader();
  const ab = await blob.arrayBuffer();
  const gltf = await loader.parseAsync(ab, '');
  const boneNames: string[] = [];
  let hasSkeleton = false;
  let meshCount = 0;

  gltf.scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshCount++;
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) hasSkeleton = true;
    if ((obj as THREE.Bone).isBone) {
      hasSkeleton = true;
      boneNames.push(obj.name || `bone_${boneNames.length}`);
    }
  });

  const clipNames = (gltf.animations || []).map((c, idx) => c.name || `Clip_${idx + 1}`);
  return {
    hasSkeleton,
    boneNames: boneNames.slice(0, 48),
    clipNames,
    meshCount,
  };
}

/**
 * Loads a user-uploaded .glb/.gltf Blob as an animated CharacterRigHandle in the 3D scene.
 */
export async function buildGlbCharacterRig(
  char: CharacterDef,
  blob: Blob
): Promise<CharacterRigHandle> {
  const loader = new GLTFLoader();
  const ab = await blob.arrayBuffer();
  const gltf = await loader.parseAsync(ab, '');
  const root = gltf.scene;

  // Normalize bounding box height to ~1.65m and ground base at y=0
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scaleFactor = size.y > 0.01 ? 1.65 / size.y : 1;
  root.scale.multiplyScalar(scaleFactor);
  root.position.set(-center.x * scaleFactor, -box.min.y * scaleFactor, -center.z * scaleFactor);

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  const group = new THREE.Group();
  group.add(root);

  const mixer = new THREE.AnimationMixer(root);
  const actions: Partial<Record<AnimationClip3D, THREE.AnimationAction>> = {};
  const rawClips = gltf.animations || [];
  const customClipNames = rawClips.map((c) => c.name || 'Clip');

  const clipKeys: AnimationClip3D[] = [
    'Idle',
    'Walk',
    'Run',
    'Turn',
    'Jump',
    'Sit',
    'Talk',
    'LookAround',
    'Fear',
    'Smile',
    'Cry',
    'Action',
  ];

  // Match GLB clips by name fuzzily, fallback to first clip if present
  for (const key of clipKeys) {
    const matched =
      rawClips.find((c) => c.name.toLowerCase().includes(key.toLowerCase())) || rawClips[0];
    if (matched) {
      actions[key] = mixer.clipAction(matched);
    }
  }
  if (actions.Idle) actions.Idle.play();

  const handle: CharacterRigHandle = {
    characterId: char.id,
    group,
    bones: {},
    skeleton: null,
    mixer,
    actions,
    currentClip: 'Idle',
    isCustomGlb: true,
    customClipNames,
    setClip: (clipName: AnimationClip3D, fadeSec = 0.25) => {
      const next = actions[clipName] || actions.Idle;
      const prev = actions[handle.currentClip];
      if (!next || next === prev) return;
      next.reset();
      next.play();
      if (prev && fadeSec > 0) prev.crossFadeTo(next, fadeSec, false);
      else prev?.stop();
      handle.currentClip = clipName;
    },
    setExpression: () => {
      // Custom GLB models rely on their embedded skeletal/morph animations
    },
    updateAnimation: (deltaSec: number, absoluteTimeSec?: number) => {
      if (rawClips.length === 0) {
        // Gentle idle bob when external GLB contains zero animation clips
        const t = absoluteTimeSec ?? performance.now() / 1000;
        root.position.y = -box.min.y * scaleFactor + Math.sin(t * 2.2) * 0.015;
        return;
      }
      if (typeof absoluteTimeSec === 'number') mixer.setTime(absoluteTimeSec);
      else mixer.update(deltaSec);
    },
    dispose: () => {
      mixer.stopAllAction();
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat?.dispose();
        }
      });
    },
  };

  return handle;
}

import * as THREE from 'three';
import type { EnvironmentConfig3D, SceneProp } from '../types/cartoon';
import { getGroundSoilTexture, getWoodPlankTexture } from './proceduralTextures';
import type { StylePreset3DRuntime } from './stylePresets';

export interface EnvironmentHandle {
  group: THREE.Group;
  update: (timeSec: number, env: EnvironmentConfig3D) => void;
  dispose: () => void;
}

function seededRand(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildEnvironment3D(
  env: EnvironmentConfig3D,
  style: StylePreset3DRuntime,
  props: SceneProp[] = [],
  options: { particleMultiplier?: number; foliageMultiplier?: number; volumetricsEnabled?: boolean } = {}
): EnvironmentHandle {
  const group = new THREE.Group();
  group.name = `env_${env.preset}`;

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const partMult = options.particleMultiplier ?? 1;
  const folMult = options.foliageMultiplier ?? 1;
  const volumetrics = options.volumetricsEnabled ?? true;

  // Time of day palette
  const tod = env.timeOfDay || 'golden';
  const skyColors: Record<string, [string, string]> = {
    dawn: ['#3b4978', '#f5a87a'],
    day: ['#4ba3e3', '#cbe9ff'],
    golden: ['#4f6d9a', '#f7b267'],
    dusk: ['#1f254f', '#d96b52'],
    night: ['#060916', '#162040'],
  };
  const [skyTop, skyHor] = skyColors[tod] || skyColors.golden;

  // Sky Dome (Procedural gradient canvas)
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4;
  skyCanvas.height = 128;
  const sctx = skyCanvas.getContext('2d')!;
  const grad = sctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, skyTop);
  grad.addColorStop(0.68, skyHor);
  grad.addColorStop(1, style.fogColor);
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 4, 128);
  const skyTex = track(new THREE.CanvasTexture(skyCanvas));
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyMat = track(
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
  );
  const skyGeo = track(new THREE.SphereGeometry(65, 24, 16));
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyDome);

  // Ground Plane (large horizon ground)
  const groundSize = 90;
  const groundMatColor =
    env.preset === 'cozy_living_room'
      ? '#6b472b'
      : env.preset === 'neon_city_night'
        ? '#141923'
        : env.preset === 'thai_temple'
          ? '#a89f91'
          : env.preset === 'studio_stage'
            ? '#222638'
            : '#3e5434';

  const groundMat = track(
    new THREE.MeshStandardMaterial({
      color: groundMatColor,
      map:
        env.preset === 'cozy_living_room'
          ? getWoodPlankTexture()
          : env.preset === 'forest_trail' || env.preset === 'riverside_sunset'
            ? getGroundSoilTexture()
            : null,
      roughness: env.preset === 'neon_city_night' ? 0.22 : 0.88,
      metalness: env.preset === 'neon_city_night' ? 0.25 : 0.04,
    })
  );
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(groundSize, groundSize)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Animated Water Plane for Riverside Sunset
  let waterMesh: THREE.Mesh | null = null;
  let waterPosAttr: THREE.BufferAttribute | null = null;
  let waterBaseY: Float32Array | null = null;

  if (env.preset === 'riverside_sunset') {
    const waterGeo = track(new THREE.PlaneGeometry(45, 22, 32, 16));
    waterGeo.rotateX(-Math.PI / 2);
    waterPosAttr = waterGeo.attributes.position as THREE.BufferAttribute;
    waterBaseY = new Float32Array(waterPosAttr.count);
    for (let i = 0; i < waterPosAttr.count; i++) waterBaseY[i] = waterPosAttr.getY(i);

    const waterMat = track(
      new THREE.MeshStandardMaterial({
        color: tod === 'night' ? '#0f294a' : '#2a5f82',
        roughness: 0.14,
        metalness: 0.55,
      })
    );
    waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(0, 0.03, -8.5);
    waterMesh.receiveShadow = true;
    group.add(waterMesh);

    // Wooden pier / boardwalk
    const dockMat = track(
      new THREE.MeshStandardMaterial({ map: getWoodPlankTexture(), roughness: 0.8 })
    );
    const dock = new THREE.Mesh(track(new THREE.BoxGeometry(4.2, 0.18, 4.4)), dockMat);
    dock.position.set(0, 0.09, -0.4);
    dock.receiveShadow = true;
    dock.castShadow = true;
    group.add(dock);
  }

  // Preset-specific 3D architecture & multi-part foliage
  const rand = seededRand(888);
  const treeCount = Math.round((env.treesDensity ?? 0.6) * 28 * folMult);

  if (
    treeCount > 0 &&
    (env.preset === 'forest_trail' || env.preset === 'riverside_sunset' || env.preset === 'thai_temple')
  ) {
    const trunkGeo = track(new THREE.CylinderGeometry(0.14, 0.24, 2.2, 8));
    const trunkMat = track(new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 }));
    const crownGeo = track(new THREE.ConeGeometry(1.1, 2.5, 9));
    const crownMat = track(
      new THREE.MeshStandardMaterial({
        color: env.preset === 'riverside_sunset' ? '#2d5a3c' : '#2f6b3d',
        roughness: 0.85,
      })
    );

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
    trunks.castShadow = true;
    crowns.castShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < treeCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (2.6 + rand() * 11);
      const z = -1.5 - rand() * 18;
      const sc = 0.75 + rand() * 0.9;
      dummy.position.set(x, 1.1 * sc, z);
      dummy.scale.set(sc, sc, sc);
      dummy.rotation.y = rand() * Math.PI * 2;
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, 2.65 * sc, z);
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    group.add(trunks, crowns);
  }

  // Grass tufts on trail / riverside
  if (env.preset === 'forest_trail' || env.preset === 'riverside_sunset') {
    const grassCount = Math.round(50 * folMult);
    const bladeGeo = track(new THREE.ConeGeometry(0.06, 0.32, 4));
    const bladeMat = track(new THREE.MeshStandardMaterial({ color: '#5d8a42', roughness: 0.85 }));
    const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < grassCount; i++) {
      dummy.position.set((rand() - 0.5) * 14, 0.14, (rand() - 0.5) * 10 - 1.5);
      dummy.rotation.set((rand() - 0.5) * 0.2, rand() * Math.PI, (rand() - 0.5) * 0.2);
      dummy.scale.setScalar(0.7 + rand() * 0.8);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    grass.instanceMatrix.needsUpdate = true;
    group.add(grass);
  }

  // Cozy Living Room walls, rug & warm window glow
  if (env.preset === 'cozy_living_room') {
    const wallMat = track(new THREE.MeshStandardMaterial({ color: '#d6c3a5', roughness: 0.9 }));
    const backWall = new THREE.Mesh(track(new THREE.BoxGeometry(12, 5.5, 0.25)), wallMat);
    backWall.position.set(0, 2.75, -3.5);
    backWall.receiveShadow = true;
    group.add(backWall);

    const rugMat = track(new THREE.MeshStandardMaterial({ color: '#9a4f3f', roughness: 0.95 }));
    const rug = new THREE.Mesh(track(new THREE.CylinderGeometry(2.2, 2.2, 0.03, 28)), rugMat);
    rug.position.set(0, 0.015, 0);
    rug.receiveShadow = true;
    group.add(rug);

    const winFrame = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.2, 1.8, 0.15)),
      track(new THREE.MeshBasicMaterial({ color: tod === 'night' ? '#334e7b' : '#ffe5b4' }))
    );
    winFrame.position.set(-2.2, 2.3, -3.32);
    group.add(winFrame);
  }

  // Neon City Night buildings & glowing sign panels
  if (env.preset === 'neon_city_night') {
    const bCount = 18;
    const bGeo = track(new THREE.BoxGeometry(1.8, 1, 1.8));
    const bMat = track(new THREE.MeshStandardMaterial({ color: '#1b2234', roughness: 0.65, metalness: 0.2 }));
    const bInst = new THREE.InstancedMesh(bGeo, bMat, bCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < bCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (3.8 + rand() * 6);
      const z = -2 - i * 1.4;
      const h = 4 + rand() * 9;
      dummy.position.set(x, h / 2, z);
      dummy.scale.set(1 + rand() * 0.7, h, 1 + rand() * 0.6);
      dummy.updateMatrix();
      bInst.setMatrixAt(i, dummy.matrix);
    }
    bInst.instanceMatrix.needsUpdate = true;
    group.add(bInst);

    const neonColors = ['#06b6d4', '#ec4899', '#8b5cf6', '#f59e0b'];
    for (let i = 0; i < 6; i++) {
      const signMat = track(
        new THREE.MeshStandardMaterial({
          color: neonColors[i % neonColors.length],
          emissive: neonColors[i % neonColors.length],
          emissiveIntensity: 1.6,
        })
      );
      const sign = new THREE.Mesh(track(new THREE.BoxGeometry(0.9, 1.4, 0.12)), signMat);
      sign.position.set((i % 2 === 0 ? -1 : 1) * 3.1, 2.2 + (i % 3) * 0.8, -2.5 - i * 2.4);
      group.add(sign);
    }
  }

  // Thai Temple Pillars & Tiered Roof Arch
  if (env.preset === 'thai_temple') {
    const pillarMat = track(new THREE.MeshStandardMaterial({ color: '#e2dcd0', roughness: 0.75 }));
    const goldMat = track(new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.35, metalness: 0.65 }));
    for (const px of [-2.4, 2.4]) {
      const pillar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.22, 0.28, 3.6, 12)), pillarMat);
      pillar.position.set(px, 1.8, -2.8);
      pillar.castShadow = true;
      group.add(pillar);
    }
    const roof = new THREE.Mesh(track(new THREE.ConeGeometry(3.8, 1.8, 4)), goldMat);
    roof.position.set(0, 4.4, -2.8);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  }

  // Studio Stage cyclorama platform
  if (env.preset === 'studio_stage') {
    const stageMat = track(new THREE.MeshStandardMaterial({ color: '#2b3048', roughness: 0.55, metalness: 0.1 }));
    const stage = new THREE.Mesh(track(new THREE.CylinderGeometry(3.2, 3.4, 0.16, 36)), stageMat);
    stage.position.set(0, 0.08, 0);
    stage.receiveShadow = true;
    group.add(stage);
  }

  // Scene Props (door, lantern, lamp, sofa, bench, tree, rock)
  for (const prop of props) {
    const px = (prop.x - 0.5) * 4.5;
    const pz = prop.z ?? -0.5;
    const sc = prop.scale ?? 1;
    if (prop.kind === 'lantern') {
      const post = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 8)),
        track(new THREE.MeshStandardMaterial({ color: '#3b2f2f', roughness: 0.8 }))
      );
      post.position.set(px, 0.55, pz);
      const glow = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.14 * sc, 12, 12)),
        track(
          new THREE.MeshStandardMaterial({
            color: '#ffb74d',
            emissive: '#ff9100',
            emissiveIntensity: 2.2,
          })
        )
      );
      glow.position.set(px, 1.12, pz);
      const pLight = new THREE.PointLight('#ff9d3b', 2.4, 7, 1.5);
      pLight.position.set(px, 1.15, pz);
      group.add(post, glow, pLight);
    } else if (prop.kind === 'lamp') {
      const stand = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.05, 0.2, 1.65, 10)),
        track(new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.5 }))
      );
      stand.position.set(px, 0.82, pz);
      const shade = new THREE.Mesh(
        track(new THREE.ConeGeometry(0.32, 0.35, 14, 1, true)),
        track(
          new THREE.MeshStandardMaterial({
            color: '#fde68a',
            emissive: '#f59e0b',
            emissiveIntensity: 1.1,
            side: THREE.DoubleSide,
          })
        )
      );
      shade.position.set(px, 1.68, pz);
      const pLight = new THREE.PointLight('#ffd280', 2.0, 6);
      pLight.position.set(px, 1.6, pz);
      group.add(stand, shade, pLight);
    } else if (prop.kind === 'sofa') {
      const sofaMat = track(new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.85 }));
      const base = new THREE.Mesh(track(new THREE.BoxGeometry(2.1 * sc, 0.45, 0.9)), sofaMat);
      base.position.set(px, 0.25, pz);
      const back = new THREE.Mesh(track(new THREE.BoxGeometry(2.1 * sc, 0.65, 0.22)), sofaMat);
      back.position.set(px, 0.65, pz - 0.34);
      base.castShadow = true;
      back.castShadow = true;
      group.add(base, back);
    } else if (prop.kind === 'bench') {
      const benchMat = track(new THREE.MeshStandardMaterial({ map: getWoodPlankTexture(), roughness: 0.8 }));
      const seat = new THREE.Mesh(track(new THREE.BoxGeometry(1.5 * sc, 0.1, 0.55)), benchMat);
      seat.position.set(px, 0.46, pz);
      seat.castShadow = true;
      group.add(seat);
    }
  }

  // Translucent Volumetric-style Sun Rays (lightweight additive cones)
  if (volumetrics && (env.sunRays ?? 0) > 0.08) {
    const rayMat = track(
      new THREE.MeshBasicMaterial({
        color: tod === 'night' ? '#93c5fd' : '#ffe29a',
        transparent: true,
        opacity: Math.min(0.16, (env.sunRays ?? 0.3) * 0.18),
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    const rayGeo = track(new THREE.ConeGeometry(2.8, 9.5, 16, 1, true));
    const rayMesh = new THREE.Mesh(rayGeo, rayMat);
    rayMesh.position.set(-2.2, 4.2, -1.6);
    rayMesh.rotation.set(0.25, 0, -0.35);
    group.add(rayMesh);
  }

  // Atmospheric Dust / Fireflies / Rain Particles
  let dustPoints: THREE.Points | null = null;
  let dustPositions: Float32Array | null = null;
  const dustCount = Math.round((env.dustAmount ?? 0.3) * 140 * partMult);
  if (dustCount > 5) {
    const geo = track(new THREE.BufferGeometry());
    dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (rand() - 0.5) * 12;
      dustPositions[i * 3 + 1] = 0.2 + rand() * 4.2;
      dustPositions[i * 3 + 2] = (rand() - 0.5) * 10;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const mat = track(
      new THREE.PointsMaterial({
        color: tod === 'night' ? '#fde047' : '#fff3d1',
        size: 0.055,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    dustPoints = new THREE.Points(geo, mat);
    group.add(dustPoints);
  }

  let rainPoints: THREE.Points | null = null;
  let rainPositions: Float32Array | null = null;
  const rainCount = Math.round((env.rainIntensity ?? 0) * 300 * partMult);
  if (rainCount > 10) {
    const geo = track(new THREE.BufferGeometry());
    rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (rand() - 0.5) * 12;
      rainPositions[i * 3 + 1] = rand() * 6.5;
      rainPositions[i * 3 + 2] = (rand() - 0.5) * 10;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const mat = track(
      new THREE.PointsMaterial({
        color: '#bae6fd',
        size: 0.06,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      })
    );
    rainPoints = new THREE.Points(geo, mat);
    group.add(rainPoints);
  }

  return {
    group,
    update: (timeSec: number, curEnv: EnvironmentConfig3D) => {
      if (waterMesh && waterPosAttr && waterBaseY && curEnv.waterRipple !== false) {
        const count = waterPosAttr.count;
        for (let i = 0; i < count; i++) {
          const x = waterPosAttr.getX(i);
          const z = waterPosAttr.getZ(i);
          const wave = Math.sin(x * 0.9 + timeSec * 2.2) * 0.03 + Math.cos(z * 1.1 + timeSec * 1.7) * 0.025;
          waterPosAttr.setY(i, waterBaseY[i] + wave);
        }
        waterPosAttr.needsUpdate = true;
      }
      if (dustPoints && dustPositions) {
        for (let i = 0; i < dustCount; i++) {
          dustPositions[i * 3 + 1] += Math.sin(timeSec * 0.8 + i) * 0.0025;
          dustPositions[i * 3] += Math.cos(timeSec * 0.5 + i) * (curEnv.windStrength ?? 0.2) * 0.003;
        }
        (dustPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
      if (rainPoints && rainPositions) {
        for (let i = 0; i < rainCount; i++) {
          let y = rainPositions[i * 3 + 1] - 0.18;
          if (y < 0) y = 6.5;
          rainPositions[i * 3 + 1] = y;
        }
        (rainPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
    },
    dispose: () => {
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          // ignore
        }
      }
    },
  };
}

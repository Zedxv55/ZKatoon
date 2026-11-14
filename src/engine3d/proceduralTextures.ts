import * as THREE from 'three';

let cachedWoodTex: THREE.CanvasTexture | null = null;
let cachedGroundTex: THREE.CanvasTexture | null = null;
let cachedFabricTex: THREE.CanvasTexture | null = null;
let cachedClayBumpTex: THREE.CanvasTexture | null = null;
let cachedToonRamp3: THREE.DataTexture | null = null;

function seededRand(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getWoodPlankTexture(): THREE.CanvasTexture {
  if (cachedWoodTex) return cachedWoodTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const rand = seededRand(101);
  ctx.fillStyle = '#8b5e3c';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = `rgba(40, 22, 10, ${0.12 + rand() * 0.1})`;
    ctx.fillRect(0, y, 256, 2);
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,210,170,0.06)' : 'rgba(30,15,5,0.08)';
      ctx.fillRect(rand() * 256, y + rand() * 30, 12 + rand() * 55, 1.5);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  cachedWoodTex = tex;
  return tex;
}

export function getGroundSoilTexture(): THREE.CanvasTexture {
  if (cachedGroundTex) return cachedGroundTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const rand = seededRand(202);
  ctx.fillStyle = '#4f5d3f';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle =
      rand() > 0.55
        ? 'rgba(130, 148, 88, 0.22)'
        : rand() > 0.3
          ? 'rgba(52, 62, 40, 0.25)'
          : 'rgba(110, 92, 68, 0.16)';
    ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 4, 1 + rand() * 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  cachedGroundTex = tex;
  return tex;
}

export function getFabricWeaveTexture(): THREE.CanvasTexture {
  if (cachedFabricTex) return cachedFabricTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 128; i += 4) {
    ctx.fillRect(i, 0, 1, 128);
    ctx.fillRect(0, i, 128, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  cachedFabricTex = tex;
  return tex;
}

export function getClayFingerprintBumpTexture(): THREE.CanvasTexture {
  if (cachedClayBumpTex) return cachedClayBumpTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const rand = seededRand(777);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 180; i++) {
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(210,210,210,0.16)' : 'rgba(60,60,60,0.16)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(rand() * 128, rand() * 128, 4 + rand() * 14, 0, Math.PI * 1.4);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  cachedClayBumpTex = tex;
  return tex;
}

export function getToonRampTexture(): THREE.DataTexture {
  if (cachedToonRamp3) return cachedToonRamp3;
  const colors = new Uint8Array([
    68, 72, 92, 255,
    158, 162, 180, 255,
    248, 248, 252, 255,
  ]);
  const tex = new THREE.DataTexture(colors, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cachedToonRamp3 = tex;
  return tex;
}

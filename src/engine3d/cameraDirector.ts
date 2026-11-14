import * as THREE from 'three';
import type { CameraMove, CameraShotType } from '../types/cartoon';

export interface CameraPose {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  fov: number;
}

const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _target = new THREE.Vector3();
const _secondary = new THREE.Vector3();

/**
 * Deterministic 17-shot cinematic Camera Director.
 * Zero per-frame allocation (mutates and returns cached pose vectors).
 */
export function evaluateCameraShot(params: {
  shotType: CameraShotType;
  cameraMove?: CameraMove;
  progress: number; // 0..1 within scene
  primaryActorPos: THREE.Vector3;
  secondaryActorPos?: THREE.Vector3;
  cameraShakeStrength?: number;
  timeSec?: number;
}): CameraPose {
  const {
    shotType,
    cameraMove = 'static',
    progress,
    primaryActorPos,
    secondaryActorPos,
    timeSec = 0,
  } = params;
  const p = Math.max(0, Math.min(1, progress));
  const ease = p * p * (3 - 2 * p);

  _target.copy(primaryActorPos);
  if (secondaryActorPos) {
    _secondary.copy(secondaryActorPos);
  } else {
    _secondary.set(primaryActorPos.x + 1.1, primaryActorPos.y, primaryActorPos.z - 0.5);
  }

  let fov = 42;
  const headY = _target.y + 1.38;
  const chestY = _target.y + 1.05;

  switch (shotType) {
    case 'extreme_wide':
      fov = 52;
      _camPos.set(_target.x * 0.4, 3.4, 11.2 - ease * 0.8);
      _camLook.set(0, 1.1, -1.0);
      break;
    case 'establishing_wide':
      fov = 48;
      _camPos.set(-0.6 + ease * 1.1, 2.35, 7.6 - ease * 0.7);
      _camLook.set(_target.x * 0.6, 1.15, _target.z);
      break;
    case 'medium':
      fov = 40;
      _camPos.set(_target.x + 0.35, chestY + 0.25, _target.z + 3.8);
      _camLook.set(_target.x, chestY + 0.1, _target.z);
      break;
    case 'closeup':
      fov = 34;
      _camPos.set(_target.x + 0.18, headY + 0.05, _target.z + 1.85);
      _camLook.set(_target.x, headY, _target.z);
      break;
    case 'extreme_closeup':
      fov = 28;
      _camPos.set(_target.x + 0.08, headY + 0.04, _target.z + 1.15 - ease * 0.12);
      _camLook.set(_target.x, headY + 0.02, _target.z);
      break;
    case 'over_the_shoulder': {
      fov = 36;
      const midX = (_target.x + _secondary.x) * 0.5;
      _camPos.set(_target.x - 0.65, headY + 0.14, _target.z + 1.55);
      _camLook.set(midX + 0.35, headY - 0.05, _secondary.z);
      break;
    }
    case 'low_angle':
      fov = 42;
      _camPos.set(_target.x + 0.4, 0.48, _target.z + 3.2);
      _camLook.set(_target.x, headY + 0.15, _target.z);
      break;
    case 'high_angle':
      fov = 44;
      _camPos.set(_target.x + 0.4, 3.9, _target.z + 3.6);
      _camLook.set(_target.x, chestY - 0.1, _target.z);
      break;
    case 'birds_eye':
      fov = 48;
      _camPos.set(_target.x, 7.8, _target.z + 1.4);
      _camLook.set(_target.x, 0.5, _target.z);
      break;
    case 'tracking':
      fov = 40;
      _camPos.set(_target.x + 0.8, 1.55, _target.z + 3.9);
      _camLook.set(_target.x, chestY + 0.1, _target.z);
      break;
    case 'dolly_in':
      fov = 38;
      _camPos.set(_target.x + 0.2, headY - 0.05, _target.z + 4.3 - ease * 2.1);
      _camLook.set(_target.x, headY - 0.1, _target.z);
      break;
    case 'dolly_out':
      fov = 42;
      _camPos.set(_target.x + 0.25, chestY + 0.35, _target.z + 2.1 + ease * 3.0);
      _camLook.set(_target.x, chestY + 0.1, _target.z);
      break;
    case 'pan':
      fov = 42;
      _camPos.set(0, 1.75, 4.8);
      _camLook.set(-1.3 + ease * 2.6, 1.25, -0.3);
      break;
    case 'tilt':
      fov = 40;
      _camPos.set(_target.x + 0.2, 1.4, _target.z + 3.9);
      _camLook.set(_target.x, 0.4 + ease * 1.45, _target.z);
      break;
    case 'orbit': {
      fov = 40;
      const angle = (p - 0.5) * Math.PI * 0.72;
      const radius = 3.7;
      _camPos.set(
        _target.x + Math.sin(angle) * radius,
        1.75 + Math.sin(p * Math.PI) * 0.35,
        _target.z + Math.cos(angle) * radius
      );
      _camLook.set(_target.x, chestY + 0.15, _target.z);
      break;
    }
    case 'crane':
      fov = 44;
      _camPos.set(_target.x + ease * 0.6, 1.4 + ease * 3.6, _target.z + 3.2 + ease * 3.4);
      _camLook.set(_target.x, chestY + 0.1, _target.z);
      break;
    case 'pov':
      fov = 52;
      _camPos.set(_target.x, headY + 0.05, _target.z + 0.12);
      _camLook.set(_secondary.x, headY - 0.08, _secondary.z - 2.2);
      break;
  }

  // Layer optional legacy CameraMove nuances smoothly on top
  if (cameraMove === 'push_in' && shotType !== 'dolly_in') {
    _camPos.z -= ease * 0.65;
  } else if (cameraMove === 'pull_out' && shotType !== 'dolly_out') {
    _camPos.z += ease * 0.75;
  } else if (cameraMove === 'pan_left') {
    _camPos.x -= (ease - 0.5) * 0.7;
  } else if (cameraMove === 'pan_right') {
    _camPos.x += (ease - 0.5) * 0.7;
  } else if (cameraMove === 'tilt_up') {
    _camLook.y += ease * 0.45;
  } else if (cameraMove === 'shake') {
    _camPos.x += Math.sin(timeSec * 28) * 0.06;
    _camPos.y += Math.cos(timeSec * 33) * 0.05;
  }

  return {
    position: _camPos,
    lookAt: _camLook,
    fov,
  };
}

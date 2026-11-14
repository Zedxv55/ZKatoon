import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {
  ActorFace,
  AnimationClip3D,
  CartoonProject,
  CharacterDef,
  EnvironmentConfig3D,
  PerformancePreset,
  SceneAudioRecord,
  SceneDef,
  StylePreset3D,
  TimelineSegment,
} from '../types/cartoon';
import { detectSoftwareWebGL, PERFORMANCE_PRESETS } from '../utils/capabilities';
import { getLipSyncOpennessAt } from '../utils/projectLogic';
import { getGlbAsset } from '../utils/workspaceStore';
import { evaluateCameraShot } from './cameraDirector';
import {
  buildGlbCharacterRig,
  buildProceduralCharacterRig,
  type CharacterRigHandle,
} from './characterRig3d';
import { buildEnvironment3D, type EnvironmentHandle } from './environment3d';
import { render3DOverlay2D } from './overlayRenderer';
import { resolveStyle3DConfig, type StylePreset3DRuntime } from './stylePresets';

const _primaryVec = new THREE.Vector3(0, 0, 0);
const _secondaryVec = new THREE.Vector3(1.2, 0, -0.5);

function createAfterDrawScheduler(
  gl: WebGLRenderingContext | WebGL2RenderingContext | null,
  isSoftwareGl: boolean
) {
  let active = true;
  let timerId = 0;
  let rafId = 0;

  const schedule = (fn: () => void) => {
    if (!active) return;
    if (!isSoftwareGl) {
      rafId = requestAnimationFrame(fn);
      return;
    }

    const isGl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    if (!gl || !isGl2) {
      timerId = window.setTimeout(fn, 80);
      return;
    }

    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      timerId = window.setTimeout(fn, 80);
      return;
    }

    const start = performance.now();
    const poll = () => {
      if (!active) {
        gl.deleteSync(sync);
        return;
      }
      const status = gl.clientWaitSync(sync, 0, 0);
      if (
        status === gl.ALREADY_SIGNALED ||
        status === gl.CONDITION_SATISFIED ||
        performance.now() - start >= 80
      ) {
        gl.deleteSync(sync);
        fn();
      } else {
        timerId = window.setTimeout(poll, 16);
      }
    };
    timerId = window.setTimeout(poll, 16);
  };

  const cancel = () => {
    active = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (timerId) clearTimeout(timerId);
  };

  return { schedule, cancel };
}

/**
 * Interactive 3D Character Turnaround & Animation Preview Stage
 * Used in the "Characters" menu — uses on-demand coalesced rendering when paused,
 * and software-GL-friendly afterDraw loop when auto-rotating or animating.
 */
export class CharacterPreviewStage {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private pedestal: THREE.Mesh;
  private rig: CharacterRigHandle | null = null;
  private isSoftwareGl: boolean;
  private resizeObs: ResizeObserver;
  private rafHandle: { schedule: (fn: () => void) => void; cancel: () => void } | null = null;
  private dirty = false;
  private lastTickTime = performance.now();
  private autoRotate = true;
  private activeClip: AnimationClip3D = 'Idle';
  private activeFace: ActorFace = 'happy';
  private styleRuntime: StylePreset3DRuntime;
  private disposed = false;

  constructor(container: HTMLElement, stylePreset: StylePreset3D = 'cinematic_3d') {
    this.container = container;
    const glProbe = detectSoftwareWebGL();
    this.isSoftwareGl = glProbe.isSoftwareGl;
    this.styleRuntime = resolveStyle3DConfig(stylePreset);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = this.styleRuntime.toneMapping;
    this.renderer.toneMappingExposure = this.styleRuntime.exposure;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#131624');
    this.scene.fog = new THREE.FogExp2('#131624', 0.035);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.camera.position.set(0.3, 1.35, 3.6);
    this.camera.lookAt(0, 0.95, 0);

    this.hemiLight = new THREE.HemisphereLight('#b7dcff', '#312c3b', 0.9);
    this.keyLight = new THREE.DirectionalLight('#fff2dd', 2.4);
    this.keyLight.position.set(3, 5, 4);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.fillLight = new THREE.DirectionalLight('#7ea6e0', 0.8);
    this.fillLight.position.set(-4, 2, 2);
    this.rimLight = new THREE.DirectionalLight('#7dd3fc', 1.4);
    this.rimLight.position.set(-1.5, 3.5, -4);
    this.scene.add(this.hemiLight, this.keyLight, this.fillLight, this.rimLight);

    const pedMat = new THREE.MeshStandardMaterial({ color: '#24293d', roughness: 0.65, metalness: 0.15 });
    this.pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.14, 32), pedMat);
    this.pedestal.position.y = -0.07;
    this.pedestal.receiveShadow = true;
    this.scene.add(this.pedestal);

    this.updateSize();
    this.resizeObs = new ResizeObserver(() => this.updateSize());
    this.resizeObs.observe(container);

    this.startLoop();
  }

  private updateSize() {
    if (this.disposed) return;
    const w = Math.max(240, this.container.clientWidth || 360);
    const h = Math.max(240, this.container.clientHeight || 360);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  public requestRender() {
    if (this.dirty || this.disposed) return;
    this.dirty = true;
    requestAnimationFrame(() => {
      if (this.disposed) return;
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
    });
  }

  public async setCharacter(char: CharacterDef, stylePreset: StylePreset3D) {
    if (this.disposed) return;
    this.styleRuntime = resolveStyle3DConfig(stylePreset);
    this.applyLighting();

    if (this.rig) {
      this.scene.remove(this.rig.group);
      this.rig.dispose();
      this.rig = null;
    }

    if (char.glbAssetId) {
      try {
        const asset = await getGlbAsset(char.glbAssetId);
        if (asset) {
          this.rig = await buildGlbCharacterRig(char, asset.blob);
        }
      } catch {
        this.rig = null;
      }
    }
    if (!this.rig) {
      this.rig = buildProceduralCharacterRig(char, this.styleRuntime);
    }

    this.scene.add(this.rig.group);
    this.rig.setClip(this.activeClip, 0);
    this.requestRender();
  }

  public setClip(clip: AnimationClip3D) {
    this.activeClip = clip;
    this.rig?.setClip(clip, 0.2);
  }

  public setFace(face: ActorFace) {
    this.activeFace = face;
  }

  public setAutoRotate(val: boolean) {
    this.autoRotate = val;
  }

  public setYaw(rad: number) {
    if (this.rig) {
      this.rig.group.rotation.y = rad;
      this.requestRender();
    }
  }

  private applyLighting() {
    const s = this.styleRuntime;
    this.keyLight.color.set(s.keyLightColor);
    this.keyLight.intensity = s.keyLightIntensity;
    this.fillLight.color.set(s.fillLightColor);
    this.fillLight.intensity = s.fillLightIntensity;
    this.rimLight.color.set(s.rimLightColor);
    this.rimLight.intensity = s.rimLightIntensity;
    this.hemiLight.color.set(s.hemiSkyColor);
    this.hemiLight.groundColor.set(s.hemiGroundColor);
    this.hemiLight.intensity = s.hemiIntensity;
    this.renderer.toneMapping = s.toneMapping;
    this.renderer.toneMappingExposure = s.exposure;
  }

  private startLoop() {
    const gl = this.renderer.getContext();
    this.rafHandle = createAfterDrawScheduler(gl, this.isSoftwareGl);
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.lastTickTime) / 1000);
      this.lastTickTime = now;

      if (this.rig) {
        if (this.autoRotate) {
          this.rig.group.rotation.y += dt * 0.55;
        }
        const talkOpen = this.activeClip === 'Talk' ? 0.4 + 0.4 * Math.sin((now / 1000) * 11) : 0;
        this.rig.setExpression(this.activeFace, talkOpen, now / 1000);
        this.rig.updateAnimation(dt, undefined, this.styleRuntime.stopMotionFps);
      }

      this.renderer.render(this.scene, this.camera);
      this.rafHandle?.schedule(tick);
    };
    this.rafHandle.schedule(tick);
  }

  public dispose() {
    this.disposed = true;
    this.rafHandle?.cancel();
    this.resizeObs.disconnect();
    this.rig?.dispose();
    this.pedestal.geometry.dispose();
    (this.pedestal.material as THREE.Material).dispose();
    this.envRT.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/**
 * Main Cinematic 3D Stage for Video Studio Preview & Deterministic Export.
 */
export class ThreeSceneStage {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rigs = new Map<string, CharacterRigHandle>();
  private envHandle: EnvironmentHandle | null = null;
  private activeSceneKey = '';
  private activePreset: PerformancePreset;
  private isSoftwareGl: boolean;
  private styleRuntime: StylePreset3DRuntime;
  private disposed = false;

  // Separate overlay canvas for crisp Thai subtitles & HUD
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private resizeObs: ResizeObserver | null = null;
  private container: HTMLElement | null = null;

  constructor(options: {
    container?: HTMLElement;
    width?: number;
    height?: number;
    preset?: PerformancePreset;
    style3d?: StylePreset3D;
    onContextLost?: () => void;
    onContextRestored?: () => void;
  }) {
    const glProbe = detectSoftwareWebGL();
    this.isSoftwareGl = glProbe.isSoftwareGl;
    this.activePreset = options.preset || (this.isSoftwareGl ? 'low' : 'balanced');
    const perf = PERFORMANCE_PRESETS[this.activePreset];
    this.styleRuntime = resolveStyle3DConfig(options.style3d || 'cinematic_3d');

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && perf.antialias,
      alpha: false,
      preserveDrawingBuffer: !options.container, // needed only for offscreen VideoFrame copy
      powerPreference: 'high-performance',
    });

    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, perf.pixelRatioCap)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && perf.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = this.styleRuntime.toneMapping;
    this.renderer.toneMappingExposure = this.styleRuntime.exposure;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.styleRuntime.fogColor);
    this.scene.fog = new THREE.FogExp2(this.styleRuntime.fogColor, this.styleRuntime.fogDensity);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;

    this.camera = new THREE.PerspectiveCamera(42, 9 / 16, 0.1, 150);
    this.camera.position.set(0, 1.7, 5);

    this.hemiLight = new THREE.HemisphereLight('#b7dcff', '#312c3b', 0.9);
    this.keyLight = new THREE.DirectionalLight('#fff2dd', 2.4);
    this.keyLight.position.set(4, 7, 5);
    this.keyLight.castShadow = !this.isSoftwareGl && perf.shadowsEnabled;
    this.keyLight.shadow.mapSize.set(perf.shadowMapSize, perf.shadowMapSize);
    this.fillLight = new THREE.DirectionalLight('#7ea6e0', 0.8);
    this.fillLight.position.set(-5, 3, 3);
    this.rimLight = new THREE.DirectionalLight('#7dd3fc', 1.4);
    this.rimLight.position.set(-2, 4, -5);
    this.scene.add(this.hemiLight, this.keyLight, this.fillLight, this.rimLight);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      options.onContextLost?.();
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      options.onContextRestored?.();
    });

    if (options.container) {
      this.container = options.container;
      this.renderer.domElement.style.position = 'absolute';
      this.renderer.domElement.style.inset = '0';
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.display = 'block';
      options.container.appendChild(this.renderer.domElement);

      this.overlayCanvas = document.createElement('canvas');
      this.overlayCanvas.style.position = 'absolute';
      this.overlayCanvas.style.inset = '0';
      this.overlayCanvas.style.width = '100%';
      this.overlayCanvas.style.height = '100%';
      this.overlayCanvas.style.pointerEvents = 'none';
      this.overlayCtx = this.overlayCanvas.getContext('2d');
      options.container.appendChild(this.overlayCanvas);

      this.updateContainerSize();
      this.resizeObs = new ResizeObserver(() => this.updateContainerSize());
      this.resizeObs.observe(options.container);
    } else {
      const w = options.width || 720;
      const h = options.height || 1280;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  public getIsSoftwareGl(): boolean {
    return this.isSoftwareGl;
  }

  public getWebGLCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public setPerformancePreset(preset: PerformancePreset) {
    this.activePreset = preset;
    const perf = PERFORMANCE_PRESETS[preset];
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, perf.pixelRatioCap)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && perf.shadowsEnabled;
    this.keyLight.castShadow = !this.isSoftwareGl && perf.shadowsEnabled;
    this.activeSceneKey = ''; // force env rebuild cleanly
  }

  private updateContainerSize() {
    if (!this.container || this.disposed) return;
    const w = Math.max(240, this.container.clientWidth || 360);
    const h = Math.max(360, this.container.clientHeight || 640);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.overlayCanvas) {
      const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      this.overlayCanvas.width = Math.round(w * dpr);
      this.overlayCanvas.height = Math.round(h * dpr);
    }
  }

  public async syncProjectAssets(project: CartoonProject) {
    this.styleRuntime = resolveStyle3DConfig(project.style3d || 'cinematic_3d', project.customStyle3d);

    // Build any missing characters
    const validIds = new Set(project.characters.map((c) => c.id));
    for (const [id, rig] of this.rigs.entries()) {
      if (!validIds.has(id)) {
        this.scene.remove(rig.group);
        rig.dispose();
        this.rigs.delete(id);
      }
    }

    for (const char of project.characters) {
      if (this.rigs.has(char.id)) continue;
      let rig: CharacterRigHandle | null = null;
      if (char.glbAssetId) {
        try {
          const asset = await getGlbAsset(char.glbAssetId);
          if (asset) rig = await buildGlbCharacterRig(char, asset.blob);
        } catch {
          rig = null;
        }
      }
      if (!rig) rig = buildProceduralCharacterRig(char, this.styleRuntime);
      rig.group.visible = false;
      this.scene.add(rig.group);
      this.rigs.set(char.id, rig);
    }
  }

  public rebuildAllCharacters(project: CartoonProject) {
    for (const rig of this.rigs.values()) {
      this.scene.remove(rig.group);
      rig.dispose();
    }
    this.rigs.clear();
    void this.syncProjectAssets(project);
  }

  private ensureSceneEnvironment(sceneDef: SceneDef) {
    const envCfg: EnvironmentConfig3D = sceneDef.env3d || {
      preset: 'forest_trail',
      timeOfDay: 'golden',
      fogDensity: 0.22,
    };
    const key = `${sceneDef.id || ''}_${envCfg.preset}_${envCfg.timeOfDay}_${envCfg.treesDensity}_${envCfg.rainIntensity}_${this.activePreset}`;
    if (key === this.activeSceneKey && this.envHandle) return;
    this.activeSceneKey = key;

    if (this.envHandle) {
      this.scene.remove(this.envHandle.group);
      this.envHandle.dispose();
      this.envHandle = null;
    }

    const perf = PERFORMANCE_PRESETS[this.activePreset];
    this.envHandle = buildEnvironment3D(envCfg, this.styleRuntime, sceneDef.props || [], {
      particleMultiplier: perf.particleMultiplier,
      foliageMultiplier: perf.foliageMultiplier,
      volumetricsEnabled: perf.volumetricsEnabled,
    });
    this.scene.add(this.envHandle.group);
  }

  private applyStyleAndSceneLighting(sceneDef: SceneDef) {
    const s = this.styleRuntime;
    const tod = sceneDef.env3d?.timeOfDay || 'golden';
    const todMult = tod === 'night' ? 0.55 : tod === 'dusk' ? 0.78 : 1.0;

    this.keyLight.color.set(sceneDef.look?.keyLightColor || s.keyLightColor);
    this.keyLight.intensity = (sceneDef.look?.keyLightIntensity ?? 1) * s.keyLightIntensity * todMult;
    this.fillLight.color.set(s.fillLightColor);
    this.fillLight.intensity = s.fillLightIntensity * (tod === 'night' ? 0.75 : 1);
    this.rimLight.color.set(s.rimLightColor);
    this.rimLight.intensity = s.rimLightIntensity;
    this.hemiLight.color.set(s.hemiSkyColor);
    this.hemiLight.groundColor.set(s.hemiGroundColor);
    this.hemiLight.intensity = s.hemiIntensity * todMult;

    const fogDensity = Math.max(0.002, s.fogDensity * (0.4 + (sceneDef.env3d?.fogDensity ?? 0.25) * 1.4));
    const fogColor = tod === 'night' ? '#070b18' : s.fogColor;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(fogColor);
      this.scene.fog.density = fogDensity;
    }
    this.scene.background = new THREE.Color(fogColor);
    this.renderer.toneMapping = s.toneMapping;
    this.renderer.toneMappingExposure = s.exposure;
  }

  /**
   * Renders one deterministic 3D frame at `timeSec`, optionally compositing HUD & subtitles
   * onto either the live overlay canvas OR an external export 2D canvas.
   */
  public renderFrameAt(
    project: CartoonProject,
    timeline: TimelineSegment[],
    timeSec: number,
    options: {
      envelope?: number[];
      leadSec?: number;
      speechStartSec?: number;
      subtitleScale?: 'normal' | 'large';
      sceneAudioMap?: Record<string, SceneAudioRecord>;
      target2dCanvas?: HTMLCanvasElement;
    } = {}
  ) {
    if (this.disposed || timeline.length === 0) return;

    this.styleRuntime = resolveStyle3DConfig(project.style3d || 'cinematic_3d', project.customStyle3d);
    const seg =
      timeline.find((s) => timeSec < s.b) ||
      timeline[timeline.length - 1];
    const sceneDef = seg.s;
    const dur = Math.max(0.5, seg.b - seg.a);
    const localT = Math.max(0, timeSec - seg.a);
    const progress = Math.min(1, localT / dur);

    this.ensureSceneEnvironment(sceneDef);
    this.applyStyleAndSceneLighting(sceneDef);

    // Hide all actors first, then position active scene actors
    for (const rig of this.rigs.values()) rig.group.visible = false;

    const lipOpenness = getLipSyncOpennessAt(
      timeSec,
      seg,
      options.sceneAudioMap,
      options.envelope || [],
      options.leadSec ?? 0.4,
      options.speechStartSec ?? 0
    );

    let primaryPosSet = false;
    sceneDef.actors.forEach((act, idx) => {
      const rig = this.rigs.get(act.char);
      if (!rig) return;
      rig.group.visible = true;

      // World mapping: x [0.1..0.9] -> [-2.0..2.0], z default 0
      const startX = (act.x - 0.5) * 4.4;
      const startZ = act.z ?? 0;
      let curX = startX;
      let curZ = startZ;

      if (act.moveTo) {
        const endX = (act.moveTo.x - 0.5) * 4.4;
        const endZ = act.moveTo.z ?? startZ;
        curX = startX + (endX - startX) * progress;
        curZ = startZ + (endZ - startZ) * progress;
      }

      rig.group.position.set(curX, act.y ?? 0, curZ);
      rig.group.scale.setScalar(act.scale ?? 1);
      const baseRotY = act.rotY ?? (act.flip ? -0.45 : 0.25);
      rig.group.rotation.y = baseRotY;

      if (idx === 0) {
        _primaryVec.set(curX, act.y ?? 0, curZ);
        primaryPosSet = true;
      } else if (idx === 1) {
        _secondaryVec.set(curX, act.y ?? 0, curZ);
      }

      const clip = act.clip3d || 'Idle';
      rig.setClip(clip, 0);
      rig.setExpression(act.face || 'neutral', lipOpenness, timeSec, act.lookTarget);
      rig.updateAnimation(0, timeSec, this.styleRuntime.stopMotionFps);
    });

    if (!primaryPosSet) {
      _primaryVec.set(0, 0, 0);
      _secondaryVec.set(1.2, 0, -0.5);
    }

    // Update environment ripples/particles
    if (this.envHandle && sceneDef.env3d) {
      this.envHandle.update(timeSec, sceneDef.env3d);
    }

    // Evaluate Cinematic Camera Shot
    const camPose = evaluateCameraShot({
      shotType: sceneDef.shotType3d || 'medium',
      cameraMove: sceneDef.camera,
      progress,
      primaryActorPos: _primaryVec,
      secondaryActorPos: sceneDef.actors.length > 1 ? _secondaryVec : undefined,
      timeSec,
    });
    this.camera.position.copy(camPose.position);
    this.camera.lookAt(camPose.lookAt);
    if (Math.abs(this.camera.fov - camPose.fov) > 0.1) {
      this.camera.fov = camPose.fov;
      this.camera.updateProjectionMatrix();
    }

    // Render 3D WebGL Frame
    this.renderer.render(this.scene, this.camera);

    // Render 2D Subtitles + HUD Overlay
    if (options.target2dCanvas) {
      const ctx2d = options.target2dCanvas.getContext('2d');
      if (ctx2d) {
        const w = options.target2dCanvas.width;
        const h = options.target2dCanvas.height;
        ctx2d.clearRect(0, 0, w, h);
        ctx2d.drawImage(this.renderer.domElement, 0, 0, w, h);
        render3DOverlay2D(ctx2d, w, h, project, timeline, timeSec, {
          subtitleScale: options.subtitleScale,
          sceneAudioMap: options.sceneAudioMap,
        });
      }
    } else if (this.overlayCanvas && this.overlayCtx) {
      const w = this.overlayCanvas.width;
      const h = this.overlayCanvas.height;
      this.overlayCtx.clearRect(0, 0, w, h);
      render3DOverlay2D(this.overlayCtx, w, h, project, timeline, timeSec, {
        subtitleScale: options.subtitleScale,
        sceneAudioMap: options.sceneAudioMap,
      });
    }
  }

  public createPlaybackLoop(onFrame: (nowMs: number) => boolean) {
    const gl = this.renderer.getContext();
    const scheduler = createAfterDrawScheduler(gl, this.isSoftwareGl);
    const tick = () => {
      if (this.disposed) return;
      const keepGoing = onFrame(performance.now());
      if (keepGoing) scheduler.schedule(tick);
    };
    scheduler.schedule(tick);
    return () => scheduler.cancel();
  }

  public dispose() {
    this.disposed = true;
    this.resizeObs?.disconnect();
    for (const rig of this.rigs.values()) rig.dispose();
    this.rigs.clear();
    this.envHandle?.dispose();
    this.envRT.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlayCanvas?.remove();
  }
}

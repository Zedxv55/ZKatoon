import type { ExportFps, HardwareCapabilities, PerformancePreset } from '../types/cartoon';

export interface PerformanceSettings {
  pixelRatioCap: number;
  shadowMapSize: number;
  shadowsEnabled: boolean;
  antialias: boolean;
  particleMultiplier: number;
  foliageMultiplier: number;
  volumetricsEnabled: boolean;
}

export const PERFORMANCE_PRESETS: Record<PerformancePreset, PerformanceSettings> = {
  low: {
    pixelRatioCap: 1.0,
    shadowMapSize: 512,
    shadowsEnabled: false,
    antialias: false,
    particleMultiplier: 0.35,
    foliageMultiplier: 0.45,
    volumetricsEnabled: false,
  },
  balanced: {
    pixelRatioCap: 1.5,
    shadowMapSize: 1024,
    shadowsEnabled: true,
    antialias: true,
    particleMultiplier: 0.75,
    foliageMultiplier: 0.75,
    volumetricsEnabled: true,
  },
  high: {
    pixelRatioCap: 2.0,
    shadowMapSize: 2048,
    shadowsEnabled: true,
    antialias: true,
    particleMultiplier: 1.0,
    foliageMultiplier: 1.0,
    volumetricsEnabled: true,
  },
  ultra: {
    pixelRatioCap: 2.0,
    shadowMapSize: 2048,
    shadowsEnabled: true,
    antialias: true,
    particleMultiplier: 1.4,
    foliageMultiplier: 1.35,
    volumetricsEnabled: true,
  },
};

export function detectSoftwareWebGL(): {
  webgl2: boolean;
  webgl1: boolean;
  isSoftwareGl: boolean;
  rendererName: string;
} {
  if (typeof document === 'undefined') {
    return { webgl2: false, webgl1: false, isSoftwareGl: true, rendererName: 'SSR/Node' };
  }
  const probeCanvas = document.createElement('canvas');
  const gl2 = probeCanvas.getContext('webgl2');
  const gl = gl2 || probeCanvas.getContext('webgl');
  if (!gl) {
    return { webgl2: false, webgl1: false, isSoftwareGl: true, rendererName: 'Unavailable' };
  }
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const rendererName = String(gl.getParameter(param) || 'WebGL Renderer');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName);
  return {
    webgl2: Boolean(gl2),
    webgl1: Boolean(gl),
    isSoftwareGl,
    rendererName,
  };
}

export async function probeHardwareCapabilities(): Promise<HardwareCapabilities> {
  const glInfo = detectSoftwareWebGL();
  const deviceMemoryGB =
    typeof navigator !== 'undefined' && 'deviceMemory' in navigator
      ? Number((navigator as unknown as { deviceMemory?: number }).deviceMemory || 0) || null
      : null;
  const hardwareConcurrency =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

  const webCodecsSupported = typeof VideoEncoder !== 'undefined';
  let mp4H264Supported = false;
  if (webCodecsSupported) {
    for (const codec of ['avc1.42001f', 'avc1.42E01E', 'avc1.4d0028', 'avc1.640028']) {
      try {
        const res = await VideoEncoder.isConfigSupported({
          codec,
          width: 720,
          height: 1280,
          bitrate: 4_000_000,
        });
        if (res.supported) {
          mp4H264Supported = true;
          break;
        }
      } catch {
        // try next
      }
    }
  }

  let aacSupported = false;
  if (typeof AudioEncoder !== 'undefined') {
    try {
      const res = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        numberOfChannels: 2,
        sampleRate: 48000,
        bitrate: 128_000,
      });
      aacSupported = Boolean(res.supported);
    } catch {
      aacSupported = false;
    }
  }

  const webmFallbackSupported =
    typeof MediaRecorder !== 'undefined' &&
    (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ||
      MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ||
      MediaRecorder.isTypeSupported('video/webm'));

  let recommendedPreset: PerformancePreset = 'balanced';
  let maxRecommendedFps: ExportFps = 30;
  if (glInfo.isSoftwareGl || (deviceMemoryGB !== null && deviceMemoryGB <= 2)) {
    recommendedPreset = 'low';
    maxRecommendedFps = 24;
  } else if (
    !glInfo.isSoftwareGl &&
    hardwareConcurrency >= 8 &&
    (deviceMemoryGB === null || deviceMemoryGB >= 8)
  ) {
    recommendedPreset = 'high';
    maxRecommendedFps = 60;
  }

  return {
    webgl2: glInfo.webgl2,
    webgl1: glInfo.webgl1,
    isSoftwareGl: glInfo.isSoftwareGl,
    rendererName: glInfo.rendererName,
    deviceMemoryGB,
    hardwareConcurrency,
    webCodecsSupported,
    mp4H264Supported,
    aacSupported,
    webmFallbackSupported,
    maxRecommendedFps,
    recommendedPreset,
  };
}

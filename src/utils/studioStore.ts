import type { AppConfig, StudioProject, UserAudioAsset } from '../types/studio';
import { DEFAULT_APP_CONFIG } from './studioData';

const DB_NAME = 'zkatoon_studio_v3';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_ASSETS = 'audio_assets';
const STORE_META = 'app_meta';

const CONFIG_LS_KEY = 'zkatoon_studio_config_v3';

let ramOnlyKeys: Partial<
  Pick<AppConfig, 'openRouterKey' | 'customLlmKey' | 'elevenLabsKey' | 'openAiTtsKey' | 'googleTtsKey' | 'freesoundKey'>
> = {};

function openStudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('ไม่สามารถเปิด IndexedDB ได้'));
  });
}

export async function listStoredProjects(): Promise<StudioProject[]> {
  try {
    const db = await openStudioDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).getAll();
      req.onsuccess = () => {
        const rows = (req.result as StudioProject[]) || [];
        resolve(rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveStoredProject(project: StudioProject): Promise<void> {
  const db = await openStudioDb();
  const payload: StudioProject = { ...project, updatedAt: Date.now() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).put(payload);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteStoredProject(projectId: string): Promise<void> {
  const db = await openStudioDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).delete(projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listAudioAssets(): Promise<UserAudioAsset[]> {
  try {
    const db = await openStudioDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSETS, 'readonly');
      const req = tx.objectStore(STORE_ASSETS).getAll();
      req.onsuccess = () => resolve((req.result as UserAudioAsset[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveAudioAsset(asset: UserAudioAsset): Promise<void> {
  const db = await openStudioDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readwrite');
    tx.objectStore(STORE_ASSETS).put(asset);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAudioAsset(id: string): Promise<UserAudioAsset | null> {
  try {
    const db = await openStudioDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSETS, 'readonly');
      const req = tx.objectStore(STORE_ASSETS).get(id);
      req.onsuccess = () => resolve((req.result as UserAudioAsset) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteAudioAsset(id: string): Promise<void> {
  const db = await openStudioDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readwrite');
    tx.objectStore(STORE_ASSETS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveAppMeta(key: string, value: unknown): Promise<void> {
  const db = await openStudioDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAppMeta<T>(key: string): Promise<T | null> {
  try {
    const db = await openStudioDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get(key);
      req.onsuccess = () => resolve((req.result?.value as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export function loadAppConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(CONFIG_LS_KEY);
    if (!raw) return { ...DEFAULT_APP_CONFIG, ...ramOnlyKeys };
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const merged: AppConfig = {
      ...DEFAULT_APP_CONFIG,
      ...parsed,
      promptTemplates: {
        ...DEFAULT_APP_CONFIG.promptTemplates,
        ...(parsed.promptTemplates || {}),
      },
      speakerVoices: {
        ...DEFAULT_APP_CONFIG.speakerVoices,
        ...(parsed.speakerVoices || {}),
      },
    };
    if (merged.dontRememberKeys) {
      return {
        ...merged,
        openRouterKey: ramOnlyKeys.openRouterKey || '',
        customLlmKey: ramOnlyKeys.customLlmKey || '',
        elevenLabsKey: ramOnlyKeys.elevenLabsKey || '',
        openAiTtsKey: ramOnlyKeys.openAiTtsKey || '',
        googleTtsKey: ramOnlyKeys.googleTtsKey || '',
        freesoundKey: ramOnlyKeys.freesoundKey || '',
      };
    }
    return merged;
  } catch {
    return { ...DEFAULT_APP_CONFIG, ...ramOnlyKeys };
  }
}

export function saveAppConfig(config: AppConfig): void {
  ramOnlyKeys = {
    openRouterKey: config.openRouterKey,
    customLlmKey: config.customLlmKey,
    elevenLabsKey: config.elevenLabsKey,
    openAiTtsKey: config.openAiTtsKey,
    googleTtsKey: config.googleTtsKey,
    freesoundKey: config.freesoundKey,
  };

  const toPersist: AppConfig = config.dontRememberKeys
    ? {
        ...config,
        openRouterKey: '',
        customLlmKey: '',
        elevenLabsKey: '',
        openAiTtsKey: '',
        googleTtsKey: '',
        freesoundKey: '',
      }
    : config;

  try {
    localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(toPersist));
  } catch {
    // ignore storage quota errors on non-critical preference save
  }
}

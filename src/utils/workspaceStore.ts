import type {
  GlbAssetRecord,
  PronunciationEntry,
  SavedProjectRecord,
  SceneAudioRecord,
  StudioSettings,
  VoicePreset,
  WorkspaceMeta,
  WorkspaceSecrets,
} from '../types/cartoon';
import { DEFAULT_SETTINGS } from './cartoonData';
import {
  createPassphraseVerifier,
  decryptWorkspaceSecrets,
  encryptWorkspaceSecrets,
  generateUuid,
  verifyAndUnlockPassphrase,
} from './workspaceCrypto';
import { filterWorkspacesForAccount, resolveAccountScopeKey } from './accountLifecycle';

const DB_NAME = 'zkatoon_workspace_db';
const DB_VERSION = 2;

const STORE_WORKSPACES = 'workspaces';
const STORE_PROJECTS = 'projects';
const STORE_SCENE_AUDIO = 'scene_audio';
const STORE_VOICE_PRESETS = 'voice_presets';
const STORE_PRONUNCIATION = 'pronunciation_dict';
const STORE_GLB_ASSETS = 'glb_assets';

const ACTIVE_WORKSPACE_KEY = 'zkatoon_active_workspace_id';
const DEVICE_UUID_KEY = 'zkatoon_local_device_uuid';
const SETTINGS_PREFIX = 'zkatoon_settings_ws_';

const DEFAULT_DICTIONARY: PronunciationEntry[] = [
  { id: 'd1', word: 'ZKatoon', reading: 'ซีคาตูน', note: 'ชื่อสตูดิโอ' },
  { id: 'd2', word: 'กทม.', reading: 'กรุงเทพมหานคร', note: 'ตัวย่อจังหวัด' },
];

let dbPromise: Promise<IDBDatabase> | null = null;

function openWorkspaceDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_WORKSPACES)) {
          db.createObjectStore(STORE_WORKSPACES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const ps = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          ps.createIndex('by_workspace', 'workspaceId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SCENE_AUDIO)) {
          const sa = db.createObjectStore(STORE_SCENE_AUDIO, { keyPath: 'key' });
          sa.createIndex('by_workspace', 'workspaceId', { unique: false });
          sa.createIndex('by_project', 'projectId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_VOICE_PRESETS)) {
          const vp = db.createObjectStore(STORE_VOICE_PRESETS, { keyPath: 'id' });
          vp.createIndex('by_workspace', 'workspaceId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_PRONUNCIATION)) {
          db.createObjectStore(STORE_PRONUNCIATION, { keyPath: 'workspaceId' });
        }
        if (!db.objectStoreNames.contains(STORE_GLB_ASSETS)) {
          const ga = db.createObjectStore(STORE_GLB_ASSETS, { keyPath: 'id' });
          ga.createIndex('by_workspace', 'workspaceId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function idbGetAllStrict<T>(storeName: string): Promise<T[]> {
  const db = await openWorkspaceDb();
  return await new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error || new Error(`อ่านข้อมูลจาก ${storeName} ไม่สำเร็จ`));
  });
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  try {
    return await idbGetAllStrict<T>(storeName);
  } catch {
    return [];
  }
}

async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  try {
    const db = await openWorkspaceDb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

async function idbPut<T>(storeName: string, value: T): Promise<void> {
  const db = await openWorkspaceDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openWorkspaceDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Local-only Random UUID (never transmitted to any server, zero browser fingerprinting)
export function getOrCreateLocalDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_UUID_KEY);
    if (existing) return existing;
    const created = generateUuid();
    window.localStorage.setItem(DEVICE_UUID_KEY, created);
    return created;
  } catch {
    return generateUuid();
  }
}

const wsInitPromises = new Map<string, Promise<WorkspaceMeta[]>>();

export async function listWorkspaces(accountUid?: string | null): Promise<WorkspaceMeta[]> {
  const scope = resolveAccountScopeKey(accountUid);
  const existingPromise = wsInitPromises.get(scope);
  if (existingPromise) return existingPromise;

  const run = async (): Promise<WorkspaceMeta[]> => {
    // Use strict read so an IndexedDB failure never masquerades as an empty workspace list
    const all = await idbGetAllStrict<WorkspaceMeta>(STORE_WORKSPACES);
    const scoped = filterWorkspacesForAccount(all, scope);
    if (scoped.length === 0) {
      const defaultId = scope === 'guest' ? 'ws_default' : `ws_${scope.slice(0, 16)}_default`;
      const defaultName = scope === 'guest' ? 'พื้นที่ทำงานหลัก (Default)' : 'Workspace บัญชีหลัก';
      const initial = await createWorkspace(defaultName, defaultId, scope);
      return [initial];
    }
    return scoped;
  };

  const p = run().finally(() => {
    wsInitPromises.delete(scope);
  });
  wsInitPromises.set(scope, p);
  return p;
}

function activeWorkspaceStorageKey(accountUid?: string | null): string {
  const scope = resolveAccountScopeKey(accountUid);
  return scope === 'guest' ? ACTIVE_WORKSPACE_KEY : `${ACTIVE_WORKSPACE_KEY}_${scope}`;
}

export async function getActiveWorkspace(accountUid?: string | null): Promise<WorkspaceMeta> {
  const scope = resolveAccountScopeKey(accountUid);
  const scopedList = await listWorkspaces(scope);
  let activeId = '';
  try {
    activeId = window.localStorage.getItem(activeWorkspaceStorageKey(scope)) || '';
  } catch {
    activeId = '';
  }
  const found = scopedList.find((w) => w.id === activeId) || scopedList[0];
  setActiveWorkspaceId(found.id, scope);
  return found;
}

export function setActiveWorkspaceId(workspaceId: string, accountUid?: string | null): void {
  try {
    window.localStorage.setItem(activeWorkspaceStorageKey(accountUid), workspaceId);
  } catch {
    // ignore storage restriction
  }
}

export async function createWorkspace(
  name: string,
  fixedId?: string,
  accountUid?: string | null
): Promise<WorkspaceMeta> {
  const scope = resolveAccountScopeKey(accountUid);
  const now = Date.now();
  const ws: WorkspaceMeta = {
    id: fixedId || `ws_${generateUuid()}`,
    name: name.trim() || 'Workspace ใหม่',
    deviceId: getOrCreateLocalDeviceId(),
    ownerUid: scope,
    createdAt: now,
    updatedAt: now,
    hasPassphrase: false,
    plainSecrets: {},
  };
  await idbPut(STORE_WORKSPACES, ws);
  await idbPut(STORE_PRONUNCIATION, { workspaceId: ws.id, entries: DEFAULT_DICTIONARY });
  setActiveWorkspaceId(ws.id, scope);
  return ws;
}

export async function renameWorkspace(workspaceId: string, newName: string): Promise<WorkspaceMeta | null> {
  const ws = await idbGet<WorkspaceMeta>(STORE_WORKSPACES, workspaceId);
  if (!ws) return null;
  const updated: WorkspaceMeta = {
    ...ws,
    name: newName.trim() || ws.name,
    updatedAt: Date.now(),
  };
  await idbPut(STORE_WORKSPACES, updated);
  return updated;
}

export async function deleteWorkspace(workspaceId: string, accountUid?: string | null): Promise<void> {
  const scope = resolveAccountScopeKey(accountUid);
  const all = await listWorkspaces(scope);
  if (all.length <= 1) {
    throw new Error('ต้องมีอย่างน้อย 1 Workspace ในบัญชีนี้');
  }
  await idbDelete(STORE_WORKSPACES, workspaceId);
  await idbDelete(STORE_PRONUNCIATION, workspaceId);

  const projects = await listWorkspaceProjects(workspaceId);
  for (const p of projects) {
    await idbDelete(STORE_PROJECTS, p.id);
  }
  const audios = await listWorkspaceAudioRecords(workspaceId);
  for (const a of audios) {
    await idbDelete(STORE_SCENE_AUDIO, a.key);
  }
  const presets = await listVoicePresets(workspaceId);
  for (const pr of presets) {
    await idbDelete(STORE_VOICE_PRESETS, pr.id);
  }
  const glbs = await listGlbAssets(workspaceId);
  for (const g of glbs) {
    await idbDelete(STORE_GLB_ASSETS, g.id);
  }
  try {
    window.localStorage.removeItem(`${SETTINGS_PREFIX}${workspaceId}`);
  } catch {
    // ignore
  }
}

// PIN / Passphrase protection via PBKDF2 + AES-GCM
export async function enableWorkspacePassphrase(
  workspaceId: string,
  passphrase: string,
  currentSecrets: WorkspaceSecrets
): Promise<{ workspace: WorkspaceMeta; cryptoKey: CryptoKey }> {
  const ws = await idbGet<WorkspaceMeta>(STORE_WORKSPACES, workspaceId);
  if (!ws) throw new Error('ไม่พบ Workspace');
  const trimmed = passphrase.trim();
  if (trimmed.length < 4) {
    throw new Error('รหัสผ่าน PIN / Passphrase ต้องยาวอย่างน้อย 4 ตัวอักษร');
  }
  const verifier = await createPassphraseVerifier(trimmed);
  const encrypted = await encryptWorkspaceSecrets(currentSecrets, verifier.key);
  const updated: WorkspaceMeta = {
    ...ws,
    hasPassphrase: true,
    saltB64: verifier.saltB64,
    keyCheckCipherB64: verifier.keyCheckCipherB64,
    keyCheckIvB64: verifier.keyCheckIvB64,
    encryptedSecretsCipherB64: encrypted.cipherB64,
    encryptedSecretsIvB64: encrypted.ivB64,
    plainSecrets: undefined,
    updatedAt: Date.now(),
  };
  await idbPut(STORE_WORKSPACES, updated);
  return { workspace: updated, cryptoKey: verifier.key };
}

export async function unlockWorkspace(
  workspace: WorkspaceMeta,
  passphrase: string
): Promise<{ secrets: WorkspaceSecrets; cryptoKey: CryptoKey } | null> {
  if (
    !workspace.hasPassphrase ||
    !workspace.saltB64 ||
    !workspace.keyCheckCipherB64 ||
    !workspace.keyCheckIvB64
  ) {
    return null;
  }
  const key = await verifyAndUnlockPassphrase(
    passphrase,
    workspace.saltB64,
    workspace.keyCheckCipherB64,
    workspace.keyCheckIvB64
  );
  if (!key) return null;

  let secrets: WorkspaceSecrets = {};
  if (workspace.encryptedSecretsCipherB64 && workspace.encryptedSecretsIvB64) {
    secrets = await decryptWorkspaceSecrets(
      workspace.encryptedSecretsCipherB64,
      workspace.encryptedSecretsIvB64,
      key
    );
  }
  return { secrets, cryptoKey: key };
}

export async function removeWorkspacePassphrase(
  workspaceId: string,
  secrets: WorkspaceSecrets
): Promise<WorkspaceMeta | null> {
  const ws = await idbGet<WorkspaceMeta>(STORE_WORKSPACES, workspaceId);
  if (!ws) return null;
  const updated: WorkspaceMeta = {
    ...ws,
    hasPassphrase: false,
    saltB64: undefined,
    keyCheckCipherB64: undefined,
    keyCheckIvB64: undefined,
    encryptedSecretsCipherB64: undefined,
    encryptedSecretsIvB64: undefined,
    plainSecrets: secrets,
    updatedAt: Date.now(),
  };
  await idbPut(STORE_WORKSPACES, updated);
  return updated;
}

export async function saveWorkspaceSecrets(
  workspaceId: string,
  secrets: WorkspaceSecrets,
  unlockedCryptoKey: CryptoKey | null
): Promise<WorkspaceMeta | null> {
  const ws = await idbGet<WorkspaceMeta>(STORE_WORKSPACES, workspaceId);
  if (!ws) return null;
  if (ws.hasPassphrase) {
    if (!unlockedCryptoKey) {
      throw new Error('กรุณาปลดล็อก Workspace ด้วย PIN ก่อนบันทึก API Key');
    }
    const encrypted = await encryptWorkspaceSecrets(secrets, unlockedCryptoKey);
    const updated: WorkspaceMeta = {
      ...ws,
      encryptedSecretsCipherB64: encrypted.cipherB64,
      encryptedSecretsIvB64: encrypted.ivB64,
      plainSecrets: undefined,
      updatedAt: Date.now(),
    };
    await idbPut(STORE_WORKSPACES, updated);
    return updated;
  }
  const updated: WorkspaceMeta = {
    ...ws,
    plainSecrets: secrets,
    updatedAt: Date.now(),
  };
  await idbPut(STORE_WORKSPACES, updated);
  return updated;
}

export function loadWorkspaceSettings(workspaceId: string): StudioSettings {
  try {
    const raw = window.localStorage.getItem(`${SETTINGS_PREFIX}${workspaceId}`);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveWorkspaceSettings(workspaceId: string, settings: StudioSettings): void {
  try {
    window.localStorage.setItem(`${SETTINGS_PREFIX}${workspaceId}`, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

// Isolated Workspace Projects
export async function listWorkspaceProjects(workspaceId: string): Promise<SavedProjectRecord[]> {
  const all = await idbGetAll<SavedProjectRecord>(STORE_PROJECTS);
  return all
    .filter((p) => (p.workspaceId || 'default') === workspaceId)
    .sort((a, b) => b.at - a.at);
}

export async function saveWorkspaceProject(
  workspaceId: string,
  record: SavedProjectRecord
): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // optional
  }
  await idbPut(STORE_PROJECTS, { ...record, workspaceId });
}

export async function deleteWorkspaceProject(projectId: string): Promise<void> {
  await idbDelete(STORE_PROJECTS, projectId);
}

export async function deleteWorkspaceProjectVideo(projectId: string): Promise<void> {
  const existing = await idbGet<SavedProjectRecord>(STORE_PROJECTS, projectId);
  if (!existing) return;
  await idbPut(STORE_PROJECTS, { ...existing, video: null });
}

// Isolated Per-Scene Audio Blobs (Scene 5 failure never wipes Scene 1–4)
export function makeSceneAudioKey(workspaceId: string, projectId: string, sceneId: string): string {
  return `${workspaceId}::${projectId}::${sceneId}`;
}

export async function listWorkspaceAudioRecords(workspaceId: string): Promise<SceneAudioRecord[]> {
  const all = await idbGetAll<SceneAudioRecord>(STORE_SCENE_AUDIO);
  return all.filter((r) => r.workspaceId === workspaceId);
}

export async function listProjectSceneAudio(
  workspaceId: string,
  projectId: string
): Promise<Record<string, SceneAudioRecord>> {
  const all = await listWorkspaceAudioRecords(workspaceId);
  const map: Record<string, SceneAudioRecord> = {};
  for (const item of all) {
    if (item.projectId === projectId) {
      map[item.sceneId] = item;
    }
  }
  return map;
}

export async function saveSceneAudioRecord(record: SceneAudioRecord): Promise<void> {
  await idbPut(STORE_SCENE_AUDIO, record);
}

export async function deleteSceneAudioRecord(
  workspaceId: string,
  projectId: string,
  sceneId: string
): Promise<void> {
  await idbDelete(STORE_SCENE_AUDIO, makeSceneAudioKey(workspaceId, projectId, sceneId));
}

// Voice Presets per Workspace
type StoredVoicePreset = VoicePreset & { workspaceId: string };

export async function listVoicePresets(workspaceId: string): Promise<VoicePreset[]> {
  const all = await idbGetAll<StoredVoicePreset>(STORE_VOICE_PRESETS);
  return all
    .filter((v) => v.workspaceId === workspaceId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveVoicePreset(workspaceId: string, preset: VoicePreset): Promise<void> {
  await idbPut<StoredVoicePreset>(STORE_VOICE_PRESETS, { ...preset, workspaceId });
}

export async function deleteVoicePreset(presetId: string): Promise<void> {
  await idbDelete(STORE_VOICE_PRESETS, presetId);
}

// Pronunciation Dictionary per Workspace
export async function getPronunciationDict(workspaceId: string): Promise<PronunciationEntry[]> {
  const rec = await idbGet<{ workspaceId: string; entries: PronunciationEntry[] }>(
    STORE_PRONUNCIATION,
    workspaceId
  );
  return rec?.entries || DEFAULT_DICTIONARY;
}

export async function savePronunciationDict(
  workspaceId: string,
  entries: PronunciationEntry[]
): Promise<void> {
  await idbPut(STORE_PRONUNCIATION, { workspaceId, entries });
}

// GLB / GLTF 3D Assets per Workspace
export async function listGlbAssets(workspaceId: string): Promise<GlbAssetRecord[]> {
  const all = await idbGetAll<GlbAssetRecord>(STORE_GLB_ASSETS);
  return all.filter((a) => a.workspaceId === workspaceId).sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function getGlbAsset(assetId: string): Promise<GlbAssetRecord | undefined> {
  return idbGet<GlbAssetRecord>(STORE_GLB_ASSETS, assetId);
}

export async function saveGlbAsset(asset: GlbAssetRecord): Promise<void> {
  await idbPut(STORE_GLB_ASSETS, asset);
}

export async function deleteGlbAsset(assetId: string): Promise<void> {
  await idbDelete(STORE_GLB_ASSETS, assetId);
}

// Backup Export & Import per Workspace
function arrayBufferToB64(ab: ArrayBuffer): string {
  const u8 = new Uint8Array(ab);
  let bin = '';
  for (let i = 0; i < u8.length; i += 32768) {
    bin += String.fromCharCode(...u8.subarray(i, i + 32768));
  }
  return btoa(bin);
}

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out.buffer;
}

export async function exportWorkspaceBackupBlob(workspaceId: string): Promise<{
  blob: Blob;
  filename: string;
  projectCount: number;
}> {
  const ws = await idbGet<WorkspaceMeta>(STORE_WORKSPACES, workspaceId);
  const projects = await listWorkspaceProjects(workspaceId);
  const voicePresets = await listVoicePresets(workspaceId);
  const dictionary = await getPronunciationDict(workspaceId);
  const settings = loadWorkspaceSettings(workspaceId);
  const audioRecs = await listWorkspaceAudioRecords(workspaceId);

  const serializedAudio = await Promise.all(
    audioRecs.map(async (r) => ({
      ...r,
      audioBlob: undefined,
      audioBase64: arrayBufferToB64(await r.audioBlob.arrayBuffer()),
    }))
  );

  const serializedProjects = projects.map((p) => ({
    ...p,
    audio: p.audio ? arrayBufferToB64(p.audio) : null,
    video: null,
  }));

  const payload = {
    format: 'zkatoon-workspace-backup-v2',
    exportedAt: Date.now(),
    workspaceName: ws?.name || 'Workspace',
    settings,
    voicePresets,
    dictionary,
    projects: serializedProjects,
    sceneAudio: serializedAudio,
  };

  const safeName = (ws?.name || 'workspace').replace(/[^a-zA-Z0-9ก-๙_-]+/g, '_');
  return {
    blob: new Blob([JSON.stringify(payload)], { type: 'application/json' }),
    filename: `zkatoon-backup-${safeName}.json`,
    projectCount: projects.length,
  };
}

export async function importWorkspaceBackupFile(
  targetWorkspaceId: string,
  file: File
): Promise<{ importedProjects: number; importedAudio: number }> {
  const text = await file.text();
  const parsed = JSON.parse(text) as {
    format?: string;
    settings?: StudioSettings;
    voicePresets?: VoicePreset[];
    dictionary?: PronunciationEntry[];
    projects?: Array<Omit<SavedProjectRecord, 'audio' | 'video'> & { audio: string | null }>;
    sceneAudio?: Array<Omit<SceneAudioRecord, 'audioBlob'> & { audioBase64: string }>;
  };

  if (Array.isArray(parsed)) {
    // Legacy acs-backup.json support
    for (const p of parsed) {
      await saveWorkspaceProject(targetWorkspaceId, {
        ...p,
        workspaceId: targetWorkspaceId,
        audio: p.audio ? b64ToArrayBuffer(p.audio) : null,
        video: null,
      });
    }
    return { importedProjects: parsed.length, importedAudio: 0 };
  }

  if (parsed.format !== 'zkatoon-workspace-backup-v2' || !Array.isArray(parsed.projects)) {
    throw new Error('รูปแบบไฟล์ Backup ไม่ถูกต้อง');
  }

  if (parsed.settings) {
    saveWorkspaceSettings(targetWorkspaceId, parsed.settings);
  }
  if (Array.isArray(parsed.dictionary)) {
    await savePronunciationDict(targetWorkspaceId, parsed.dictionary);
  }
  if (Array.isArray(parsed.voicePresets)) {
    for (const vp of parsed.voicePresets) {
      await saveVoicePreset(targetWorkspaceId, vp);
    }
  }
  for (const p of parsed.projects) {
    await saveWorkspaceProject(targetWorkspaceId, {
      ...p,
      workspaceId: targetWorkspaceId,
      audio: p.audio ? b64ToArrayBuffer(p.audio) : null,
      video: null,
    });
  }
  let audioCount = 0;
  if (Array.isArray(parsed.sceneAudio)) {
    for (const sa of parsed.sceneAudio) {
      const blob = new Blob([b64ToArrayBuffer(sa.audioBase64)], { type: sa.mimeType || 'audio/wav' });
      await saveSceneAudioRecord({
        ...sa,
        workspaceId: targetWorkspaceId,
        key: makeSceneAudioKey(targetWorkspaceId, sa.projectId, sa.sceneId),
        audioBlob: blob,
      });
      audioCount++;
    }
  }
  return { importedProjects: parsed.projects.length, importedAudio: audioCount };
}

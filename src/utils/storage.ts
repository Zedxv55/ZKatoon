import type { CartoonProject, SavedProjectRecord, StudioSettings } from '../types/cartoon';
import { DEFAULT_SETTINGS } from './cartoonData';
import { sanitizeFilename } from './projectLogic';

const DB_NAME = 'acs';
const STORE_NAME = 'p';
const SETTINGS_KEY = 'acs_studio_settings_v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function runTx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const req = fn(tx.objectStore(STORE_NAME));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listProjectsFromDB(): Promise<SavedProjectRecord[]> {
  try {
    const list = await runTx<SavedProjectRecord[]>('readonly', (store) => store.getAll());
    return [...list].sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export async function getProjectFromDB(id: string): Promise<SavedProjectRecord | undefined> {
  return runTx<SavedProjectRecord | undefined>('readonly', (store) => store.get(id));
}

export async function saveProjectToDB(record: SavedProjectRecord): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Ignore storage persistence denial
  }
  await runTx('readwrite', (store) => store.put(record));
}

export async function deleteProjectFromDB(id: string): Promise<void> {
  await runTx('readwrite', (store) => store.delete(id));
}

export async function deleteProjectVideoFromDB(id: string): Promise<void> {
  const existing = await getProjectFromDB(id);
  if (!existing) return;
  await saveProjectToDB({ ...existing, video: null });
}

export interface StorageSummary {
  supported: boolean;
  usageMB: number;
  quotaMB: number;
  freeMB: number;
  ratio: number;
  persisted: boolean;
}

export async function getStorageSummary(): Promise<StorageSummary> {
  if (!navigator.storage?.estimate) {
    return { supported: false, usageMB: 0, quotaMB: 0, freeMB: 0, ratio: 0, persisted: false };
  }
  const est = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  const usage = est.usage || 0;
  const quota = est.quota || 1;
  return {
    supported: true,
    usageMB: usage / 1048576,
    quotaMB: quota / 1048576,
    freeMB: Math.max(0, quota - usage) / 1048576,
    ratio: usage / quota,
    persisted,
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

function arrayBufferToBase64(ab: ArrayBuffer): string {
  const u8 = new Uint8Array(ab);
  let binary = '';
  for (let i = 0; i < u8.length; i += 32768) {
    binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 32768)));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function exportBackupJson(): Promise<number> {
  const list = await listProjectsFromDB();
  const serialized = list.map((p) => ({
    ...p,
    audio: p.audio ? arrayBufferToBase64(p.audio) : null,
    video: null,
  }));
  const blob = new Blob([JSON.stringify(serialized)], { type: 'application/json' });
  triggerDownload(blob, 'acs-backup.json');
  return list.length;
}

export async function restoreBackupJson(file: File): Promise<number> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Array<
    Omit<SavedProjectRecord, 'audio' | 'video'> & { audio: string | null }
  >;
  if (!Array.isArray(parsed)) {
    throw new Error('รูปแบบไฟล์ Backup ไม่ถูกต้อง');
  }
  for (const item of parsed) {
    await saveProjectToDB({
      ...item,
      audio: item.audio ? base64ToArrayBuffer(item.audio) : null,
      video: null,
    });
  }
  return parsed.length;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export type DirHandle = {
  name: string;
  queryPermission: (opts: { mode: string }) => Promise<string>;
  requestPermission: (opts: { mode: string }) => Promise<string>;
  getFileHandle: (
    name: string,
    opts: { create: boolean }
  ) => Promise<{
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  }>;
};

export async function saveProjectFilesToLocal(
  project: CartoonProject,
  audioRaw: ArrayBuffer | null,
  audioExt: string,
  videoBlob: Blob | null,
  dirHandle: DirHandle | null
): Promise<'folder' | 'download'> {
  const baseName = sanitizeFilename(project.title);
  const files: Array<[string, Blob]> = [
    [`${baseName}.project.json`, new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })],
  ];
  if (audioRaw) {
    files.push([`${baseName}.voice.${audioExt || 'wav'}`, new Blob([audioRaw])]);
  }
  if (videoBlob) {
    files.push([`${baseName}.mp4`, videoBlob]);
  }

  if (dirHandle) {
    const permOpts = { mode: 'readwrite' };
    const granted =
      (await dirHandle.queryPermission(permOpts)) === 'granted' ||
      (await dirHandle.requestPermission(permOpts)) === 'granted';
    if (!granted) {
      throw new Error('ไม่ได้รับอนุญาตเขียนไฟล์ลงโฟลเดอร์');
    }
    for (const [name, blob] of files) {
      const fh = await dirHandle.getFileHandle(name, { create: true });
      const writable = await fh.createWritable();
      await writable.write(blob);
      await writable.close();
    }
    return 'folder';
  }

  for (const [name, blob] of files) {
    triggerDownload(blob, name);
    await new Promise((r) => setTimeout(r, 350));
  }
  return 'download';
}

export function loadStudioSettings(): StudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveStudioSettings(settings: StudioSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

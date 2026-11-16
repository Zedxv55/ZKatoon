const OPFS_EXPORT_DIR = 'zkatoon_export_parts';

export interface OpfsPartEntry {
  name: string;
  size: number;
}

export async function isOpfsSupported(): Promise<boolean> {
  return typeof navigator !== 'undefined' && Boolean(navigator.storage?.getDirectory);
}

async function getExportDir(): Promise<FileSystemDirectoryHandle | null> {
  if (!(await isOpfsSupported())) return null;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(OPFS_EXPORT_DIR, { create: true });
  } catch {
    return null;
  }
}

export async function writeOpfsPart(filename: string, blob: Blob): Promise<boolean> {
  const dir = await getExportDir();
  if (!dir) return false;
  try {
    const fh = await dir.getFileHandle(filename, { create: true });
    const writable = await fh.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function listOpfsParts(): Promise<OpfsPartEntry[]> {
  const dir = await getExportDir();
  if (!dir) return [];
  const entries: OpfsPartEntry[] = [];
  try {
    const iter = (dir as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values();
    for await (const handle of iter) {
      if (handle.kind === 'file') {
        const f = await (handle as FileSystemFileHandle).getFile();
        entries.push({ name: handle.name, size: f.size });
      }
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function readOpfsPartBlob(filename: string): Promise<Blob | null> {
  const dir = await getExportDir();
  if (!dir) return null;
  try {
    const fh = await dir.getFileHandle(filename);
    return await fh.getFile();
  } catch {
    return null;
  }
}

export async function clearOpfsParts(prefix?: string): Promise<void> {
  const dir = await getExportDir();
  if (!dir) return;
  try {
    const iter = (dir as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values();
    const names: string[] = [];
    for await (const handle of iter) {
      if (!prefix || handle.name.startsWith(prefix)) {
        names.push(handle.name);
      }
    }
    for (const name of names) {
      await dir.removeEntry(name).catch(() => undefined);
    }
  } catch {
    // ignore
  }
}

export async function estimateStorageUsage(): Promise<{ usedMB: number; quotaMB: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const est = await navigator.storage.estimate();
    return {
      usedMB: Math.round(((est.usage || 0) / (1024 * 1024)) * 10) / 10,
      quotaMB: Math.round(((est.quota || 0) / (1024 * 1024)) * 10) / 10,
    };
  } catch {
    return null;
  }
}

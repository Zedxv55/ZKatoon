import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { StudioProject, UserAudioAsset } from '../types/studio';

export interface ZipAssetManifestItem {
  id: string;
  name: string;
  kind: UserAudioAsset['kind'];
  tags: string[];
  mimeType: string;
  durationSec: number;
  createdAt: number;
  fileName: string;
}

function safeExt(mimeType: string): string {
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  return 'wav';
}

export async function buildProjectZipBytes(
  project: StudioProject,
  assets: UserAudioAsset[]
): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {};
  const manifest: ZipAssetManifestItem[] = [];

  entries['project.json'] = strToU8(JSON.stringify(project, null, 2));

  for (const asset of assets) {
    const ext = safeExt(asset.mimeType);
    const fileName = `assets/${asset.id}.${ext}`;
    const ab = await asset.blob.arrayBuffer();
    entries[fileName] = new Uint8Array(ab);
    manifest.push({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      tags: asset.tags,
      mimeType: asset.mimeType,
      durationSec: asset.durationSec,
      createdAt: asset.createdAt,
      fileName,
    });
  }

  entries['assets_manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(entries, { level: 6 });
}

export async function exportProjectZipBlob(
  project: StudioProject,
  assets: UserAudioAsset[]
): Promise<Blob> {
  const bytes = await buildProjectZipBytes(project, assets);
  return new Blob([bytes as unknown as BlobPart], { type: 'application/zip' });
}

export function parseProjectZipBytes(zipBytes: Uint8Array): {
  project: StudioProject;
  assets: UserAudioAsset[];
} {
  const files = unzipSync(zipBytes);
  const projRaw = files['project.json'];
  if (!projRaw) {
    throw new Error('ไฟล์ ZIP ไม่มี project.json');
  }

  const project = JSON.parse(strFromU8(projRaw)) as StudioProject;
  if (!project || !Array.isArray(project.episodes)) {
    throw new Error('โครงสร้าง project.json ในไฟล์ ZIP ไม่ถูกต้อง');
  }

  const manifestRaw = files['assets_manifest.json'];
  const manifest: ZipAssetManifestItem[] = manifestRaw
    ? (JSON.parse(strFromU8(manifestRaw)) as ZipAssetManifestItem[])
    : [];

  const assets: UserAudioAsset[] = [];
  for (const item of manifest) {
    const bytes = files[item.fileName];
    if (!bytes) continue;
    assets.push({
      id: item.id,
      name: item.name,
      kind: item.kind,
      tags: item.tags || [],
      mimeType: item.mimeType || 'audio/wav',
      blob: new Blob([bytes as unknown as BlobPart], { type: item.mimeType || 'audio/wav' }),
      durationSec: item.durationSec || 1,
      createdAt: item.createdAt || Date.now(),
    });
  }

  return { project, assets };
}

import type { WorkspaceMeta } from '../types/cartoon';

export function resolveAccountScopeKey(uid: string | null | undefined): string {
  return uid && uid.trim().length > 0 ? uid.trim() : 'guest';
}

export function filterWorkspacesForAccount(
  allWorkspaces: WorkspaceMeta[],
  accountUid: string | null | undefined
): WorkspaceMeta[] {
  const scope = resolveAccountScopeKey(accountUid);
  return allWorkspaces
    .filter((w) => resolveAccountScopeKey(w.ownerUid) === scope)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function assertMatchingAccountUid(
  expectedUid: string | null | undefined,
  actualUid: string | null | undefined,
  actionLabel = 'บันทึกข้อมูล'
): void {
  const exp = resolveAccountScopeKey(expectedUid);
  const act = resolveAccountScopeKey(actualUid);
  if (exp !== act) {
    throw new Error(
      `ยกเลิกการ${actionLabel}: บัญชีผู้ใช้ถูกเปลี่ยนระหว่างทำงาน (${exp} ≠ ${act})`
    );
  }
}

export interface AccountSwitchCallbacks {
  stopPlayback: () => void;
  stopTts: () => void;
  abortExport: () => Promise<void> | void;
  clearUserReactState: () => void;
  loadAccountData: (nextScopeKey: string) => Promise<void>;
}

/**
 * Enforces deterministic safe account transition order:
 * 1) Stop Playback -> 2) Stop TTS -> 3) Abort Export -> 4) Clear previous user's React state -> 5) Load target account data.
 */
export async function runSafeAccountSwitchSequence(
  targetUid: string | null | undefined,
  callbacks: AccountSwitchCallbacks
): Promise<string> {
  const nextScope = resolveAccountScopeKey(targetUid);
  callbacks.stopPlayback();
  callbacks.stopTts();
  await callbacks.abortExport();
  callbacks.clearUserReactState();
  await callbacks.loadAccountData(nextScope);
  return nextScope;
}

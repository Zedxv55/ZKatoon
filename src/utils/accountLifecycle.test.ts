import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkspaceMeta } from '../types/cartoon';
import {
  assertMatchingAccountUid,
  filterWorkspacesForAccount,
  resolveAccountScopeKey,
  runSafeAccountSwitchSequence,
} from './accountLifecycle';

function makeWs(id: string, ownerUid?: string, updatedAt = 100): WorkspaceMeta {
  return {
    id,
    name: id,
    deviceId: 'dev1',
    ownerUid,
    createdAt: 50,
    updatedAt,
    hasPassphrase: false,
  };
}

test('resolveAccountScopeKey maps undefined/null/empty to guest and trims real UIDs', () => {
  assert.equal(resolveAccountScopeKey(undefined), 'guest');
  assert.equal(resolveAccountScopeKey(null), 'guest');
  assert.equal(resolveAccountScopeKey('   '), 'guest');
  assert.equal(resolveAccountScopeKey(' uid_abc123 '), 'uid_abc123');
});

test('filterWorkspacesForAccount keeps legacy undefined ownerUid workspaces in guest and isolates user UIDs', () => {
  const all: WorkspaceMeta[] = [
    makeWs('legacy_guest', undefined, 10),
    makeWs('explicit_guest', 'guest', 25),
    makeWs('user_a_1', 'uid_A', 30),
    makeWs('user_a_2', 'uid_A', 50),
    makeWs('user_b_1', 'uid_B', 40),
  ];

  const guestList = filterWorkspacesForAccount(all, null);
  assert.deepEqual(
    guestList.map((w) => w.id),
    ['explicit_guest', 'legacy_guest']
  );

  const userAList = filterWorkspacesForAccount(all, 'uid_A');
  assert.deepEqual(
    userAList.map((w) => w.id),
    ['user_a_2', 'user_a_1']
  );

  const userBList = filterWorkspacesForAccount(all, 'uid_B');
  assert.deepEqual(
    userBList.map((w) => w.id),
    ['user_b_1']
  );
});

test('assertMatchingAccountUid throws when UID changes mid-flight', () => {
  assert.doesNotThrow(() => assertMatchingAccountUid('guest', null, 'บันทึก'));
  assert.doesNotThrow(() => assertMatchingAccountUid('uid_A', 'uid_A', 'บันทึก'));
  assert.throws(
    () => assertMatchingAccountUid('uid_A', 'uid_B', 'บันทึกโปรเจกต์'),
    /ยกเลิกการบันทึกโปรเจกต์/
  );
  assert.throws(
    () => assertMatchingAccountUid('guest', 'uid_A', 'บันทึกเสียง'),
    /guest ≠ uid_A/
  );
});

test('runSafeAccountSwitchSequence runs Stop Playback -> Stop TTS -> Abort Export -> Clear State -> Load Account in exact order', async () => {
  const events: string[] = [];

  const nextScope = await runSafeAccountSwitchSequence('uid_next', {
    stopPlayback: () => events.push('1:stopPlayback'),
    stopTts: () => events.push('2:stopTts'),
    abortExport: async () => {
      await Promise.resolve();
      events.push('3:abortExport');
    },
    clearUserReactState: () => events.push('4:clearUserReactState'),
    loadAccountData: async (scopeKey) => {
      events.push(`5:loadAccountData:${scopeKey}`);
    },
  });

  assert.equal(nextScope, 'uid_next');
  assert.deepEqual(events, [
    '1:stopPlayback',
    '2:stopTts',
    '3:abortExport',
    '4:clearUserReactState',
    '5:loadAccountData:uid_next',
  ]);
});

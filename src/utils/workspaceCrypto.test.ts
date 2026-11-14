import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPassphraseVerifier,
  decryptWorkspaceSecrets,
  encryptWorkspaceSecrets,
  generateUuid,
  verifyAndUnlockPassphrase,
} from './workspaceCrypto';

test('generateUuid generates valid v4-shaped non-empty UUIDs', () => {
  const a = generateUuid();
  const b = generateUuid();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('Web Crypto PBKDF2 + AES-GCM passphrase verifier and secrets encryption round-trip', async () => {
  const verifier = await createPassphraseVerifier('my-secret-pin-99');
  const secrets = {
    openRouterKey: 'sk-or-test-1234',
    elevenLabsKey: 'el-test-5678',
  };

  const encrypted = await encryptWorkspaceSecrets(secrets, verifier.key);
  assert.ok(encrypted.cipherB64.length > 0);
  assert.ok(!encrypted.cipherB64.includes('sk-or-test-1234'));

  const wrongKey = await verifyAndUnlockPassphrase(
    'wrong-pin',
    verifier.saltB64,
    verifier.keyCheckCipherB64,
    verifier.keyCheckIvB64
  );
  assert.equal(wrongKey, null);

  const rightKey = await verifyAndUnlockPassphrase(
    'my-secret-pin-99',
    verifier.saltB64,
    verifier.keyCheckCipherB64,
    verifier.keyCheckIvB64
  );
  assert.ok(rightKey !== null);

  const decrypted = await decryptWorkspaceSecrets(encrypted.cipherB64, encrypted.ivB64, rightKey);
  assert.deepEqual(decrypted, secrets);
});

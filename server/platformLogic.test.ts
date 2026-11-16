import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { isSuperAdminClaim } from './authMiddleware.ts';
import {
  approveManualPaymentInDb,
  createInitialDatabase,
  createManualPaymentRequest,
  decryptSecret,
  encryptSecret,
  ensureUserAndWallet,
  maskApiKey,
  redeemAccessCodeInDb,
  refundReservedCredits,
  rejectManualPaymentInDb,
  reserveCredits,
  settleReservedCredits,
  validateOutboundProviderUrl,
  verifyGatewayHmacSignature,
} from './platformStore.ts';
import { calculateRenderCreditCost, getResolutionDimensions } from './renderWorker.ts';

test('Super Admin allowlist strictly enforces exact email + email_verified', () => {
  assert.equal(isSuperAdminClaim('zbcd1053@gmail.com', true), true);
  assert.equal(isSuperAdminClaim('ZEETOSIT@GMAIL.COM', true), true);
  assert.equal(isSuperAdminClaim('zbcd1053@gmail.com', false), false);
  assert.equal(isSuperAdminClaim('attacker@gmail.com', true), false);
  assert.equal(isSuperAdminClaim('zbcd1053@gmail.com.evil.com', true), false);
  assert.equal(isSuperAdminClaim('', true), false);
});

test('AES-256-GCM BYOK encryption round-trip and key masking', () => {
  const vaultKey = crypto.randomBytes(32);
  const raw = 'sk-or-v1-secret-test-key-987654321';
  const enc = encryptSecret(raw, vaultKey);
  assert.notEqual(enc.ciphertextB64, raw);
  const dec = decryptSecret(enc, vaultKey);
  assert.equal(dec, raw);
  assert.equal(maskApiKey(raw), 'sk-or-••••4321');
});

test('SSRF validator blocks localhost, private IPs, HTTP, and unapproved hosts', () => {
  const allowed = ['openrouter.ai', 'api.openai.com'];
  assert.equal(validateOutboundProviderUrl('https://openrouter.ai/api/v1', allowed).ok, true);
  assert.equal(validateOutboundProviderUrl('http://openrouter.ai/api/v1', allowed).ok, false);
  assert.equal(validateOutboundProviderUrl('https://127.0.0.1/v1', allowed).ok, false);
  assert.equal(validateOutboundProviderUrl('https://localhost:3000/v1', allowed).ok, false);
  assert.equal(validateOutboundProviderUrl('https://169.254.169.254/latest', allowed).ok, false);
  assert.equal(validateOutboundProviderUrl('https://192.168.1.50/v1', allowed).ok, false);
  assert.equal(validateOutboundProviderUrl('https://evil.example.com/v1', allowed).ok, false);
});

test('Atomic wallet reserve, settle, refund, and double-spend prevention', () => {
  const db = createInitialDatabase();
  const { wallet } = ensureUserAndWallet(db, {
    uid: 'user_1',
    email: 'user1@example.com',
    emailVerified: true,
    name: 'User 1',
    picture: null,
    isSuperAdmin: false,
  });
  assert.equal(wallet.balance, 30);

  // Overspend rejected
  const failRes = reserveCredits(db, 'user_1', 50, 'job_fail', 'm1', 'Too expensive', 'user_1');
  assert.equal(failRes.ok, false);
  assert.equal(wallet.balance, 30);

  // Reserve 20, settle 12 -> refund 8
  const r1 = reserveCredits(db, 'user_1', 20, 'job_1', 'm1', 'Render 1', 'user_1');
  assert.equal(r1.ok, true);
  assert.equal(wallet.balance, 10);
  assert.equal(wallet.reserved, 20);

  // Concurrent second reserve 20 fails (cannot double-spend reserved credits)
  const r2 = reserveCredits(db, 'user_1', 20, 'job_2', 'm1', 'Render 2', 'user_1');
  assert.equal(r2.ok, false);

  settleReservedCredits(db, 'user_1', 20, 12, 'job_1', 'm1', 'Settled', 'system');
  assert.equal(wallet.balance, 18);
  assert.equal(wallet.reserved, 0);
  assert.equal(wallet.totalSpent, 12);

  // Full refund on failure
  const r3 = reserveCredits(db, 'user_1', 10, 'job_3', 'm1', 'Render 3', 'user_1');
  assert.equal(r3.ok, true);
  refundReservedCredits(db, 'user_1', 10, 'job_3', 'm1', 'Refunded', 'system');
  assert.equal(wallet.balance, 18);
  assert.equal(wallet.reserved, 0);
});

test('Manual payment stays pending until admin approves, and rejects double-approval', () => {
  const db = createInitialDatabase();
  const { user, wallet } = ensureUserAndWallet(db, {
    uid: 'u_pay',
    email: 'buyer@example.com',
    emailVerified: true,
    name: 'Buyer',
    picture: null,
    isSuperAdmin: false,
  });
  assert.equal(user.tier, 'free');

  const payment = createManualPaymentRequest(db, user, { slipNote: 'โอน 350 บาทแล้ว' });
  assert.equal(payment.status, 'pending');
  assert.equal(user.tier, 'free'); // NEVER auto-approved

  const appr = approveManualPaymentInDb(db, payment.id, {
    uid: 'admin_1',
    email: 'zbcd1053@gmail.com',
  });
  assert.equal(appr.ok, true);
  assert.equal(payment.status, 'approved');
  assert.equal(user.tier, 'studio_pass');
  assert.equal(wallet.balance, 30 + db.settings.studioPassMonthlyCredits);

  // Second approval attempt blocked
  const doubleAppr = approveManualPaymentInDb(db, payment.id, {
    uid: 'admin_1',
    email: 'zbcd1053@gmail.com',
  });
  assert.equal(doubleAppr.ok, false);

  // Reject flow on separate payment
  const p2 = createManualPaymentRequest(db, user, { slipNote: 'สลิปปลอม' });
  const rej = rejectManualPaymentInDb(db, p2.id, 'ยอดไม่ตรง', {
    uid: 'admin_1',
    email: 'zeetosit@gmail.com',
  });
  assert.equal(rej.ok, true);
  assert.equal(p2.status, 'rejected');
  assert.equal(p2.rejectReason, 'ยอดไม่ตรง');
});

test('Single-use access code redemption & HMAC webhook verification', () => {
  const db = createInitialDatabase();
  ensureUserAndWallet(db, {
    uid: 'u_code',
    email: 'code@example.com',
    emailVerified: true,
    name: 'Code User',
    picture: null,
    isSuperAdmin: false,
  });
  db.accessCodes['VIP30'] = {
    code: 'VIP30',
    tier: 'studio_pass',
    days: 30,
    bonusCredits: 250,
    maxUses: 1,
    usedCount: 0,
    usedByUids: [],
    active: true,
    expiresAt: Date.now() + 86400_000,
    createdByEmail: 'zbcd1053@gmail.com',
    createdAt: Date.now(),
  };

  const r1 = redeemAccessCodeInDb(db, 'vip30', 'u_code');
  assert.equal(r1.ok, true);
  assert.equal(db.users['u_code'].tier, 'studio_pass');
  assert.equal(db.wallets['u_code'].balance, 280);

  // Cannot reuse single-use code
  const r2 = redeemAccessCodeInDb(db, 'VIP30', 'u_code');
  assert.equal(r2.ok, false);

  // HMAC signature check
  const secret = 'whsec_test_123';
  const body = JSON.stringify({ eventId: 'evt_1', paymentId: 'pay_1' });
  const validSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyGatewayHmacSignature(body, `sha256=${validSig}`, secret), true);
  assert.equal(verifyGatewayHmacSignature(body, 'sha256=badhex', secret), false);
});

test('Render resolution dimensions & cost calculation', () => {
  assert.deepEqual(getResolutionDimensions('9:16', '1080p'), { width: 1080, height: 1920 });
  assert.deepEqual(getResolutionDimensions('16:9', '4k'), { width: 3840, height: 2160 });
  const cost720 = calculateRenderCreditCost(10, '720p', {
    perVideoBase: 10,
    perSecond: 1,
    multiplier1080p: 1.5,
    multiplier1440p: 2,
    multiplier4k: 3,
  });
  const cost4k = calculateRenderCreditCost(10, '4k', {
    perVideoBase: 10,
    perSecond: 1,
    multiplier1080p: 1.5,
    multiplier1440p: 2,
    multiplier4k: 3,
  });
  assert.equal(cost720, 20);
  assert.equal(cost4k, 60);
});

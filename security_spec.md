# ZKatoon Firestore & Storage Security Spec

## 1. Data Invariants
1. Every document path is rooted at `/users/{userId}` and strictly owned by `request.auth.uid == userId`.
2. Users cannot read, list, create, update, or delete any document under another user's `{userId}`.
3. Plain-text API keys (`plainSecrets`) are strictly forbidden in Firestore (`keys().hasOnly(...)` rejects them).
4. Subcollection writes require valid parent ownership (`get(...)` or `exists(...)` on `/users/{userId}/workspaces/{workspaceId}` owned by `request.auth.uid`).
5. Every ID path parameter is guarded by `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, length <= 128).
6. Timestamps `createdAt` and `updatedAt` are validated against `request.time`.

## 2. Adversarial Payloads Blocked
1. Unauthenticated read/write to `/users/uid1/workspaces/ws1` -> PERMISSION_DENIED
2. Cross-UID read/write (`auth.uid = uid2` accessing `/users/uid1/...`) -> PERMISSION_DENIED
3. Unverified email (`auth.token.email_verified = false`) writing -> PERMISSION_DENIED
4. Shadow field injection (`plainSecrets: { openRouterKey: "sk-..." }`) on workspace -> PERMISSION_DENIED
5. Owner spoofing (`ownerUid: "other_uid"`) on create -> PERMISSION_DENIED
6. ID poisoning (`workspaceId` 1KB string or containing `/` or spaces) -> PERMISSION_DENIED
7. Timestamp spoofing (`updatedAt` != `request.time`) -> PERMISSION_DENIED
8. Immutable `ownerUid` or `createdAt` mutation on update -> PERMISSION_DENIED
9. Oversized string (`title` > 240 chars or `thumbDataUrl` > 65KB) -> PERMISSION_DENIED
10. Unbounded array (`entries.size() > 500`) on pronunciation dictionary -> PERMISSION_DENIED
11. Orphaned project/preset write targeting non-existent workspace -> PERMISSION_DENIED
12. Ghost field injection (`isAdmin: true`) on user profile -> PERMISSION_DENIED

## 3. Platform SaaS Security Invariants
13. Super Admin allowlist strictly requires `request.auth.token.email_verified == true` AND exact email in `['zbcd1053@gmail.com', 'zeetosit@gmail.com']`.
14. Users may NEVER self-modify `role`, `tier`, `status`, `wallet.balance`, `credit_ledger`, `access_codes`, or `payments.status` directly in Firestore.
15. Published CMS pages (`pages` where `status == 'published'`) are readable; draft pages and admin settings/logs are strictly Super Admin only.
16. Encrypted BYOK credentials are stored ONLY server-side via AES-256-GCM and never written to client-readable Firestore collections.


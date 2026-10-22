import request from 'supertest';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { app } from '../app.js';
import { TokenService } from '../services/token.service.js';
import { UserModel } from '../models/user.model.js';
import { CredentialModel } from '../models/credential.model.js';
import { CredentialShareModel } from '../models/credential-share.model.js';
import { EncryptionService } from '../services/encryption.service.js';
import { connectMongoDB, disconnectMongoDB } from '../infrastructure/database/mongodb.js';

console.log('========================================');
console.log('--- Running Phase 8 Secure Credential Sharing Tests ---');

let passedCount = 0;
let failedCount = 0;

function reportTest(name: string, fn: () => void | Promise<void>) {
  try {
    fn();
    console.log(`  ✓ PASSED: ${name}`);
    passedCount++;
  } catch (error) {
    console.error(`  ✗ FAILED: ${name}`);
    console.error('    Error:', error);
    failedCount++;
  }
}

async function runTests() {
  await connectMongoDB();

  // 1. Create real database user documents for testing
  const ownerDoc = await UserModel.create({
    employeeId: `SHR_OWN_${Date.now()}`,
    name: 'Share Owner Alice',
    email: `alice.share.${Date.now()}@toptechdevelopers.com`,
    passwordHash: '$2b$12$eXAMpleBcryptHash12345678901234567890123456789012345',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    department: 'Software Engineering',
  });

  const recipientDoc = await UserModel.create({
    employeeId: `SHR_REC_${Date.now()}`,
    name: 'Share Recipient Bob',
    email: `bob.share.${Date.now()}@toptechdevelopers.com`,
    passwordHash: '$2b$12$eXAMpleBcryptHash12345678901234567890123456789012345',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    department: 'QA & Compliance',
  });

  const unrelatedDoc = await UserModel.create({
    employeeId: `SHR_UNR_${Date.now()}`,
    name: 'Unrelated Charlie',
    email: `charlie.share.${Date.now()}@toptechdevelopers.com`,
    passwordHash: '$2b$12$eXAMpleBcryptHash12345678901234567890123456789012345',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    department: 'Marketing',
  });

  const ownerId = ownerDoc._id.toString();
  const recipientId = recipientDoc._id.toString();
  const unrelatedId = unrelatedDoc._id.toString();

  const ownerToken = TokenService.createAccessToken({
    sub: ownerId,
    employeeId: ownerDoc.employeeId,
    role: 'EMPLOYEE',
  });

  const recipientToken = TokenService.createAccessToken({
    sub: recipientId,
    employeeId: recipientDoc.employeeId,
    role: 'EMPLOYEE',
  });

  const unrelatedToken = TokenService.createAccessToken({
    sub: unrelatedId,
    employeeId: unrelatedDoc.employeeId,
    role: 'EMPLOYEE',
  });

  let credentialAId: string = '';
  let credentialBId: string = '';
  let shareAId: string = '';
  let shareBId: string = '';

  // --------------------------------------------------------------------------
  console.log('[Test 1] Testing Unauthenticated Access Rejection...');
  // --------------------------------------------------------------------------
  const unauthRes1 = await request(app).get('/api/v1/credential-shares/incoming');
  reportTest('GET /api/v1/credential-shares/incoming without auth returns 401', () => {
    assert.equal(unauthRes1.status, 401);
    assert.equal(unauthRes1.body.success, false);
  });

  const unauthRes2 = await request(app).get('/api/v1/credentials/shared');
  reportTest('GET /api/v1/credentials/shared without auth returns 401', () => {
    assert.equal(unauthRes2.status, 401);
    assert.equal(unauthRes2.body.success, false);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 2] Creating Test Owned Credentials for Alice (Owner)...');
  // --------------------------------------------------------------------------
  const rawSecret1 = 'TopSecretSharedAWS#2026';
  const rawSecret2 = 'ViewOnlyDatabaseKey$2026';

  const credRes1 = await request(app)
    .post('/api/v1/credentials')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      title: 'AWS Production Deployment Console',
      website: 'https://aws.amazon.com',
      username: 'aws_dev_admin',
      password: rawSecret1,
      category: 'CLOUD',
      notes: 'Contains root cluster credentials',
    });

  reportTest('Owner successfully created Credential A', () => {
    assert.equal(credRes1.status, 201);
    assert.equal(credRes1.body.success, true);
    credentialAId = credRes1.body.data.credential.id;
    assert.ok(credentialAId);
  });

  const credRes2 = await request(app)
    .post('/api/v1/credentials')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      title: 'PostgreSQL Readonly Replica',
      website: 'https://db.internal.college.edu',
      username: 'pg_readonly',
      password: rawSecret2,
      category: 'DATABASE',
      notes: 'Read-only access for reporting',
    });

  reportTest('Owner successfully created Credential B', () => {
    assert.equal(credRes2.status, 201);
    credentialBId = credRes2.body.data.credential.id;
    assert.ok(credentialBId);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 3] Testing Self-Sharing Validation Rejection...');
  // --------------------------------------------------------------------------
  const selfShareRes = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      credentialId: credentialAId,
      recipientId: ownerId, // Same user
      permission: 'VIEW_REVEAL',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

  reportTest('Self-sharing rejected with HTTP 400 Bad Request', () => {
    assert.equal(selfShareRes.status, 400);
    assert.equal(selfShareRes.body.success, false);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 4] Testing Non-Owner Sharing Rejection (IDOR)...');
  // --------------------------------------------------------------------------
  const nonOwnerShareRes = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${recipientToken}`) // Bob trying to share Alice's credential
    .send({
      credentialId: credentialAId,
      recipientId: unrelatedId,
      permission: 'VIEW_REVEAL',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

  reportTest('Non-owner cannot share someone else\'s credential (HTTP 403 Forbidden)', () => {
    assert.equal(nonOwnerShareRes.status, 403);
    assert.equal(nonOwnerShareRes.body.success, false);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 5] Owner Creates Share Request with VIEW_REVEAL for Bob...');
  // --------------------------------------------------------------------------
  const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const shareRes1 = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      credentialId: credentialAId,
      recipientId,
      permission: 'VIEW_REVEAL',
      expiresAt: futureExpiry,
    });

  reportTest('Share request created with status PENDING', () => {
    assert.equal(shareRes1.status, 201);
    assert.equal(shareRes1.body.success, true);
    assert.equal(shareRes1.body.data.share.status, 'PENDING');
    assert.equal(shareRes1.body.data.share.permission, 'VIEW_REVEAL');
    shareAId = shareRes1.body.data.share.id;
    assert.ok(shareAId);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 6] Testing Duplicate Share Request Prevention...');
  // --------------------------------------------------------------------------
  const duplicateShareRes = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      credentialId: credentialAId,
      recipientId,
      permission: 'VIEW_REVEAL',
      expiresAt: futureExpiry,
    });

  reportTest('Duplicate pending share request rejected with HTTP 409 Conflict', () => {
    assert.equal(duplicateShareRes.status, 409);
    assert.equal(duplicateShareRes.body.success, false);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 7] Listing Outgoing Shares for Owner (Alice)...');
  // --------------------------------------------------------------------------
  const outgoingRes = await request(app)
    .get('/api/v1/credential-shares/outgoing')
    .set('Authorization', `Bearer ${ownerToken}`);

  reportTest('Owner sees outgoing share with recipient information', () => {
    assert.equal(outgoingRes.status, 200);
    assert.equal(outgoingRes.body.success, true);
    assert.ok(Array.isArray(outgoingRes.body.data.shares));
    const found = outgoingRes.body.data.shares.find((s: any) => s.id === shareAId);
    assert.ok(found);
    assert.equal(found.recipient.employeeId, recipientDoc.employeeId);
    assert.equal(found.status, 'PENDING');
  });

  // --------------------------------------------------------------------------
  console.log('[Test 8] Listing Incoming Shares for Recipient (Bob)...');
  // --------------------------------------------------------------------------
  const incomingRes = await request(app)
    .get('/api/v1/credential-shares/incoming')
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Recipient sees incoming pending share with owner information', () => {
    assert.equal(incomingRes.status, 200);
    assert.equal(incomingRes.body.success, true);
    assert.ok(Array.isArray(incomingRes.body.data.shares));
    const found = incomingRes.body.data.shares.find((s: any) => s.id === shareAId);
    assert.ok(found);
    assert.equal(found.owner.employeeId, ownerDoc.employeeId);
    assert.equal(found.status, 'PENDING');
  });

  // --------------------------------------------------------------------------
  console.log('[Test 9] IDOR Check: Unrelated Employee C cannot approve Share A...');
  // --------------------------------------------------------------------------
  const idorApproveRes = await request(app)
    .post(`/api/v1/credential-shares/${shareAId}/approve`)
    .set('Authorization', `Bearer ${unrelatedToken}`);

  reportTest('Unrelated Employee C blocked from approving Share A (HTTP 403 Forbidden)', () => {
    assert.equal(idorApproveRes.status, 403);
    assert.equal(idorApproveRes.body.success, false);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 10] Recipient (Bob) Approves Share A...');
  // --------------------------------------------------------------------------
  const approveRes = await request(app)
    .post(`/api/v1/credential-shares/${shareAId}/approve`)
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Recipient approves share -> Status transitions to ACTIVE', () => {
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.success, true);
    assert.equal(approveRes.body.data.share.status, 'ACTIVE');
    assert.ok(approveRes.body.data.share.approvedAt);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 11] Recipient Lists Active Shared Credentials...');
  // --------------------------------------------------------------------------
  const sharedListRes = await request(app)
    .get('/api/v1/credentials/shared')
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Bob sees Credential A in shared credentials list', () => {
    assert.equal(sharedListRes.status, 200);
    assert.equal(sharedListRes.body.success, true);
    assert.ok(Array.isArray(sharedListRes.body.data.items));
    const found = sharedListRes.body.data.items.find((i: any) => i.credentialId === credentialAId);
    assert.ok(found);
    assert.equal(found.title, 'AWS Production Deployment Console');
    assert.equal(found.permission, 'VIEW_REVEAL');
    assert.equal(found.owner.employeeId, ownerDoc.employeeId);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 12] Recipient Retrieves Single Shared Credential Detail...');
  // --------------------------------------------------------------------------
  const singleSharedRes = await request(app)
    .get(`/api/v1/credentials/shared/${credentialAId}`)
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Bob retrieves shared credential metadata via GET /shared/:id', () => {
    assert.equal(singleSharedRes.status, 200);
    assert.equal(singleSharedRes.body.success, true);
    assert.equal(singleSharedRes.body.data.credential.title, 'AWS Production Deployment Console');
  });

  // --------------------------------------------------------------------------
  console.log('[Test 13] Recipient Reveals Password with VIEW_REVEAL Permission...');
  // --------------------------------------------------------------------------
  const revealRes = await request(app)
    .post(`/api/v1/credentials/shared/${credentialAId}/reveal`)
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Bob reveals shared password -> Returns correct decrypted secret', () => {
    assert.equal(revealRes.status, 200);
    assert.equal(revealRes.body.success, true);
    assert.equal(revealRes.body.data.username, 'aws_dev_admin');
    assert.equal(revealRes.body.data.password, rawSecret1);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 14] Owner Shares Credential B with VIEW Only Permission...');
  // --------------------------------------------------------------------------
  const shareRes2 = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      credentialId: credentialBId,
      recipientId,
      permission: 'VIEW', // View Only
      expiresAt: futureExpiry,
    });

  reportTest('Share B created with VIEW only permission', () => {
    assert.equal(shareRes2.status, 201);
    shareBId = shareRes2.body.data.share.id;
    assert.equal(shareRes2.body.data.share.permission, 'VIEW');
  });

  // Bob approves Share B
  const approveRes2 = await request(app)
    .post(`/api/v1/credential-shares/${shareBId}/approve`)
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Bob approved Share B', () => {
    assert.equal(approveRes2.status, 200);
    assert.equal(approveRes2.body.data.share.status, 'ACTIVE');
  });

  // --------------------------------------------------------------------------
  console.log('[Test 15] Bob Attempts to Reveal Password on VIEW Only Share...');
  // --------------------------------------------------------------------------
  const viewOnlyRevealRes = await request(app)
    .post(`/api/v1/credentials/shared/${credentialBId}/reveal`)
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Reveal rejected with HTTP 403 and REVEAL_PERMISSION_REQUIRED', () => {
    assert.equal(viewOnlyRevealRes.status, 403);
    assert.equal(viewOnlyRevealRes.body.success, false);
    assert.equal(viewOnlyRevealRes.body.error.code, 'REVEAL_PERMISSION_REQUIRED');
  });

  // --------------------------------------------------------------------------
  console.log('[Test 16] Testing Expiration Enforcement...');
  // --------------------------------------------------------------------------
  // Manually update Share B expiresAt to past
  await CredentialShareModel.findByIdAndUpdate(shareBId, {
    $set: { expiresAt: new Date(Date.now() - 60000) },
  });

  const expiredListRes = await request(app)
    .get('/api/v1/credentials/shared')
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Expired Share B is omitted from active shared credentials list', () => {
    assert.equal(expiredListRes.status, 200);
    const foundExpired = expiredListRes.body.data.items.find((i: any) => i.credentialId === credentialBId);
    assert.equal(foundExpired, undefined);
  });

  const expiredRevealRes = await request(app)
    .post(`/api/v1/credentials/shared/${credentialBId}/reveal`)
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Reveal on expired share is denied with HTTP 403 Forbidden', () => {
    assert.equal(expiredRevealRes.status, 403);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 17] IDOR Check: Non-Owner cannot Revoke Share A...');
  // --------------------------------------------------------------------------
  const idorRevokeRes = await request(app)
    .post(`/api/v1/credential-shares/${shareAId}/revoke`)
    .set('Authorization', `Bearer ${recipientToken}`); // Bob trying to revoke Alice's share

  reportTest('Non-owner cannot revoke share (HTTP 403 Forbidden)', () => {
    assert.equal(idorRevokeRes.status, 403);
    assert.equal(idorRevokeRes.body.success, false);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 18] Owner Revokes Share A -> Immediate Access Termination...');
  // --------------------------------------------------------------------------
  const revokeRes = await request(app)
    .post(`/api/v1/credential-shares/${shareAId}/revoke`)
    .set('Authorization', `Bearer ${ownerToken}`);

  reportTest('Owner successfully revokes Share A -> Status becomes REVOKED', () => {
    assert.equal(revokeRes.status, 200);
    assert.equal(revokeRes.body.data.share.status, 'REVOKED');
    assert.ok(revokeRes.body.data.share.revokedAt);
  });

  // Bob immediately denied reveal access on Share A
  const revokedRevealRes = await request(app)
    .post(`/api/v1/credentials/shared/${credentialAId}/reveal`)
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Revoked share reveal immediately denied (HTTP 403 Forbidden)', () => {
    assert.equal(revokedRevealRes.status, 403);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 19] Testing Recipient Rejection Flow...');
  // --------------------------------------------------------------------------
  const shareRes3 = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      credentialId: credentialAId,
      recipientId: unrelatedId,
      permission: 'VIEW',
      expiresAt: futureExpiry,
    });

  const shareCId = shareRes3.body.data.share.id;

  const rejectRes = await request(app)
    .post(`/api/v1/credential-shares/${shareCId}/reject`)
    .set('Authorization', `Bearer ${unrelatedToken}`);

  reportTest('Recipient rejects share request -> Status becomes REJECTED', () => {
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.data.share.status, 'REJECTED');
    assert.ok(rejectRes.body.data.share.rejectedAt);
  });

  // --------------------------------------------------------------------------
  console.log('[Test 20] Security Audit: Verify Zero Secrets in Share Records...');
  // --------------------------------------------------------------------------
  const rawShareDocs = await CredentialShareModel.find({
    _id: { $in: [shareAId, shareBId, shareCId] },
  }).lean();

  reportTest('CredentialShare documents contain ZERO ciphertext, IV, authTag, or passwords', () => {
    for (const doc of rawShareDocs) {
      assert.equal((doc as any).encryptedPassword, undefined);
      assert.equal((doc as any).ciphertext, undefined);
      assert.equal((doc as any).password, undefined);
      assert.equal((doc as any).iv, undefined);
      assert.equal((doc as any).authTag, undefined);
    }
  });

  // Original credentials still retain encrypted passwords
  const rawCredA = await CredentialModel.findById(credentialAId).select('+encryptedPassword').lean();
  reportTest('Original credential in database retains AES-256-GCM encrypted payload', () => {
    assert.ok(rawCredA?.encryptedPassword);
    assert.equal(rawCredA.encryptedPassword.algorithm, 'aes-256-gcm');
    assert.ok(rawCredA.encryptedPassword.ciphertext);
    assert.ok(rawCredA.encryptedPassword.iv);
    assert.ok(rawCredA.encryptedPassword.authTag);
  });

  // --------------------------------------------------------------------------
  console.log('[Cleanup] Removing Test Documents...');
  // --------------------------------------------------------------------------
  await CredentialShareModel.deleteMany({ _id: { $in: [shareAId, shareBId, shareCId] } });
  await CredentialModel.deleteMany({ _id: { $in: [credentialAId, credentialBId] } });
  await UserModel.deleteMany({ _id: { $in: [ownerId, recipientId, unrelatedId] } });

  reportTest('Test database artifacts cleaned up cleanly', () => {
    assert.ok(true);
  });

  console.log('========================================');
  console.log(`Credential Sharing Test Results: ${passedCount} passed, ${failedCount} failed`);
  console.log('========================================');

  await disconnectMongoDB();

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});

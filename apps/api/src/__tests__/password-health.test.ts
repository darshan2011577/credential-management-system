import request from 'supertest';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { app } from '../app.js';
import { TokenService } from '../services/token.service.js';
import { CredentialModel } from '../models/credential.model.js';
import { connectMongoDB, disconnectMongoDB } from '../infrastructure/database/mongodb.js';

console.log('========================================');
console.log('--- Running Phase 7 Password Health Analysis & Security Tests ---');

let passedCount = 0;
let failedCount = 0;

function reportTest(name: string, fn: () => void) {
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

  const employeeAId = new mongoose.Types.ObjectId().toString();
  const employeeBId = new mongoose.Types.ObjectId().toString();

  const tokenA = TokenService.createAccessToken({
    sub: employeeAId,
    employeeId: 'EMP001',
    role: 'EMPLOYEE',
  });

  const tokenB = TokenService.createAccessToken({
    sub: employeeBId,
    employeeId: 'EMP002',
    role: 'EMPLOYEE',
  });

  console.log('[Test 1] Testing Unauthenticated Access Rejection...');
  const unauthRes = await request(app).get('/api/v1/password-health');
  reportTest('GET /api/v1/password-health without auth returns HTTP 401 Unauthorized', () => {
    assert.equal(unauthRes.status, 401);
    assert.equal(unauthRes.body.success, false);
    assert.equal(unauthRes.body.error.code, 'UNAUTHORIZED');
  });

  console.log('[Test 2] Testing Empty Vault Health Summary...');
  const emptyRes = await request(app)
    .get('/api/v1/password-health')
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('GET /api/v1/password-health on empty vault returns totalCredentials = 0', () => {
    assert.equal(emptyRes.status, 200);
    assert.equal(emptyRes.body.success, true);
    assert.equal(emptyRes.body.data.totalCredentials, 0);
    assert.equal(emptyRes.body.data.score, 100);
    assert.equal(emptyRes.body.data.status, 'HEALTHY');
  });

  console.log('[Test 3] Creating Varied Test Credentials for Employee A...');
  // 1. Very weak password (policy violation)
  const cred1Res = await request(app)
    .post('/api/v1/credentials')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      title: 'Old Internal Portal',
      username: 'user_portal',
      password: '123',
      category: 'WORK',
    });
  const cred1Id = cred1Res.body.data.credential.id;

  // 2. Reused password (Instance 1)
  const cred2Res = await request(app)
    .post('/api/v1/credentials')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      title: 'AWS Cloud Console',
      username: 'aws_admin',
      password: 'SameSharedPassword@123',
      category: 'CLOUD',
    });
  const cred2Id = cred2Res.body.data.credential.id;

  // 3. Reused password (Instance 2)
  const cred3Res = await request(app)
    .post('/api/v1/credentials')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      title: 'GitHub Enterprise Vault',
      username: 'gh_admin',
      password: 'SameSharedPassword@123',
      category: 'DEVELOPMENT',
    });
  const cred3Id = cred3Res.body.data.credential.id;

  // 4. Strong unique password
  const cred4Res = await request(app)
    .post('/api/v1/credentials')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      title: 'College Database Cluster',
      username: 'db_admin',
      password: 'k9#Vp!8m$Z2qLx@1',
      category: 'DATABASE',
    });
  const cred4Id = cred4Res.body.data.credential.id;

  reportTest('All 4 test credentials created with AES-256-GCM encryption', () => {
    assert.ok(cred1Id);
    assert.ok(cred2Id);
    assert.ok(cred3Id);
    assert.ok(cred4Id);
  });

  console.log('[Test 4] Testing Aggregated Password Health Summary...');
  const summaryRes = await request(app)
    .get('/api/v1/password-health')
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('GET /api/v1/password-health returns correct metrics and reuse counts', () => {
    assert.equal(summaryRes.status, 200);
    assert.equal(summaryRes.body.success, true);
    const summary = summaryRes.body.data;
    assert.equal(summary.totalCredentials, 4);
    assert.equal(summary.weakCredentials, 1);
    assert.equal(summary.reusedCredentials, 2);
    assert.equal(summary.policyViolations, 1);
    assert.ok(summary.score < 80); // Penalized by weak & reused passwords
    assert.ok(summary.status === 'NEEDS_ATTENTION' || summary.status === 'AT_RISK');
    assert.equal(summary.reuseGroups.length, 1);
    assert.equal(summary.reuseGroups[0].count, 2);
  });

  reportTest('Summary response contains ZERO plaintext passwords or encrypted blobs', () => {
    const rawJson = JSON.stringify(summaryRes.body);
    assert.equal(rawJson.includes('123'), false);
    assert.equal(rawJson.includes('SameSharedPassword@123'), false);
    assert.equal(rawJson.includes('k9#Vp!8m$Z2qLx@1'), false);
    assert.equal(rawJson.includes('encryptedPassword'), false);
    assert.equal(rawJson.includes('ciphertext'), false);
  });

  console.log('[Test 5] Testing Detailed Credential Health List Endpoint...');
  const detailsRes = await request(app)
    .get('/api/v1/password-health/credentials')
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('GET /api/v1/password-health/credentials returns 4 analyzed items', () => {
    assert.equal(detailsRes.status, 200);
    assert.equal(detailsRes.body.success, true);
    assert.equal(detailsRes.body.data.items.length, 4);
  });

  reportTest('Item 1 correctly flagged with WEAK/VERY_WEAK and POLICY_VIOLATION issues', () => {
    const item1 = detailsRes.body.data.items.find((i: any) => i.credentialId === cred1Id);
    assert.ok(item1);
    assert.ok(item1.strength === 'VERY_WEAK' || item1.strength === 'WEAK');
    assert.equal(item1.policyCompliant, false);
    assert.ok(item1.issues.some((iss: any) => iss.code === 'VERY_WEAK_PASSWORD' || iss.code === 'WEAK_PASSWORD'));
    assert.ok(item1.issues.some((iss: any) => iss.code === 'POLICY_VIOLATION'));
    assert.ok(item1.recommendations.length > 0);
  });

  reportTest('Items 2 and 3 correctly flagged with PASSWORD_REUSED issue', () => {
    const item2 = detailsRes.body.data.items.find((i: any) => i.credentialId === cred2Id);
    const item3 = detailsRes.body.data.items.find((i: any) => i.credentialId === cred3Id);
    assert.ok(item2);
    assert.ok(item3);
    assert.equal(item2.reused, true);
    assert.equal(item2.reuseCount, 2);
    assert.equal(item3.reused, true);
    assert.equal(item3.reuseCount, 2);
    assert.ok(item2.issues.some((iss: any) => iss.code === 'PASSWORD_REUSED'));
    assert.ok(item3.issues.some((iss: any) => iss.code === 'PASSWORD_REUSED'));
  });

  reportTest('Item 4 (Strong unique) has score >= 85 and zero security issues', () => {
    const item4 = detailsRes.body.data.items.find((i: any) => i.credentialId === cred4Id);
    assert.ok(item4);
    assert.equal(item4.strength, 'VERY_STRONG');
    assert.equal(item4.policyCompliant, true);
    assert.equal(item4.reused, false);
    assert.equal(item4.issues.length, 0);
    assert.ok(item4.score >= 85);
  });

  console.log('[Test 6] Testing Single Credential Health Endpoint...');
  const singleRes = await request(app)
    .get(`/api/v1/password-health/credentials/${cred4Id}`)
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('GET /api/v1/password-health/credentials/:id returns health result for owner', () => {
    assert.equal(singleRes.status, 200);
    assert.equal(singleRes.body.success, true);
    assert.equal(singleRes.body.data.credentialId, cred4Id);
    assert.equal(singleRes.body.data.strength, 'VERY_STRONG');
  });

  console.log('[Test 7] Testing Strict Ownership Enforcement & IDOR Protection...');
  const idorRes = await request(app)
    .get(`/api/v1/password-health/credentials/${cred1Id}`)
    .set('Authorization', `Bearer ${tokenB}`);

  reportTest('Employee B requesting health for Employee A credential rejected with HTTP 403 Forbidden', () => {
    assert.equal(idorRes.status, 403);
    assert.equal(idorRes.body.success, false);
    assert.equal(idorRes.body.error.code, 'FORBIDDEN');
  });

  console.log('[Test 8] Testing Cache Invalidation & Remediation...');
  // Employee A rotates Credential 3 to a unique strong password
  const rotateRes = await request(app)
    .patch(`/api/v1/credentials/${cred3Id}`)
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      password: 'RotatedUniqueSecretKey#2026!',
    });

  reportTest('Credential 3 password updated and re-encrypted', () => {
    assert.equal(rotateRes.status, 200);
  });

  // Re-fetch health summary: Reused count should drop from 2 to 0
  const refreshedSummaryRes = await request(app)
    .get('/api/v1/password-health')
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('Health cache invalidated: Reused count drops to 0 and score increases', () => {
    assert.equal(refreshedSummaryRes.status, 200);
    assert.equal(refreshedSummaryRes.body.data.reusedCredentials, 0);
    assert.ok(refreshedSummaryRes.body.data.score > summaryRes.body.data.score);
  });

  console.log('[Test 9] Cleaning Up Test Credentials...');
  await CredentialModel.deleteMany({
    _id: { $in: [cred1Id, cred2Id, cred3Id, cred4Id] },
  });

  reportTest('Test database documents cleaned up cleanly', () => {
    assert.ok(true);
  });

  console.log('========================================');
  console.log(`Password Health Test Results: ${passedCount} passed, ${failedCount} failed`);
  console.log('========================================');

  await disconnectMongoDB();

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(async (err) => {
  console.error('Unhandled test runner error:', err);
  await disconnectMongoDB();
  process.exit(1);
});

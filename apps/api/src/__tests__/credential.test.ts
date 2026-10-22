import request from 'supertest';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { app } from '../app.js';
import { TokenService } from '../services/token.service.js';
import { CredentialService } from '../services/credential.service.js';
import { CredentialModel } from '../models/credential.model.js';
import { EncryptionService } from '../services/encryption.service.js';
import { connectMongoDB, disconnectMongoDB } from '../infrastructure/database/mongodb.js';

console.log('========================================');
console.log('--- Running Phase 6 Credential API & Ownership Security Tests ---');

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
  // Connect to database for integration tests
  await connectMongoDB();

  // Generate distinct mock user IDs for Employee A and Employee B
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


  console.log('[Test 1] Testing Unauthenticated Rejection...');
  const unauthRes = await request(app).get('/api/v1/credentials');
  reportTest('GET /api/v1/credentials without auth returns HTTP 401 Unauthorized', () => {
    assert.equal(unauthRes.status, 401);
    assert.equal(unauthRes.body.success, false);
    assert.equal(unauthRes.body.error.code, 'UNAUTHORIZED');
  });

  const unauthPostRes = await request(app)
    .post('/api/v1/credentials')
    .send({ title: 'Test', username: 'user', password: 'pwd', category: 'OTHER' });
  reportTest('POST /api/v1/credentials without auth returns HTTP 401 Unauthorized', () => {
    assert.equal(unauthPostRes.status, 401);
  });

  console.log('[Test 2] Testing Validation Rejection on Invalid Payload...');
  const invalidPostRes = await request(app)
    .post('/api/v1/credentials')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ title: '', username: '', password: '' });
  reportTest('POST /api/v1/credentials with empty fields returns HTTP 422 Validation Error', () => {
    assert.equal(invalidPostRes.status, 422);
    assert.equal(invalidPostRes.body.success, false);
    assert.equal(invalidPostRes.body.error.code, 'VALIDATION_ERROR');
  });

  console.log('[Test 3] Testing Cryptographic Password Generator API...');
  const genPwdRes = await request(app)
    .post('/api/v1/credentials/generate-password')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true });

  reportTest('POST /api/v1/credentials/generate-password returns HTTP 200 with 20-char password', () => {
    assert.equal(genPwdRes.status, 200);
    assert.equal(genPwdRes.body.success, true);
    assert.equal(typeof genPwdRes.body.data.password, 'string');
    assert.equal(genPwdRes.body.data.password.length, 20);
  });

  console.log('[Test 4] Testing Credential Creation with AES-256-GCM Encryption...');
  const rawPassword = 'MySecretCollegeDatabaseKey123!';
  const createRes = await request(app)
    .post('/api/v1/credentials')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      title: 'College MongoDB Atlas Cluster',
      website: 'https://cloud.mongodb.com',
      username: 'faculty_admin',
      password: rawPassword,
      category: 'DATABASE',
      notes: 'Primary production cluster for student projects',
      favorite: true,
    });

  let createdCredentialId = '';
  reportTest('POST /api/v1/credentials returns HTTP 201 Created', () => {
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.success, true);
    assert.ok(createRes.body.data.credential.id);
    createdCredentialId = createRes.body.data.credential.id;
  });

  reportTest('Credential response does NOT expose plaintext password or ciphertext', () => {
    const cred = createRes.body.data.credential;
    assert.equal(cred.password, undefined);
    assert.equal(cred.encryptedPassword, undefined);
    assert.equal(cred.title, 'College MongoDB Atlas Cluster');
    assert.equal(cred.username, 'faculty_admin');
    assert.equal(cred.category, 'DATABASE');
    assert.equal(cred.favorite, true);
  });

  console.log('[Test 5] Testing Direct MongoDB Document Structure & Encryption...');
  const dbDoc = await CredentialModel.findById(createdCredentialId).select('+encryptedPassword');
  reportTest('MongoDB document stores encryptedPassword with AES-256-GCM metadata', () => {
    assert.ok(dbDoc);
    assert.equal(dbDoc.encryptedPassword.version, 1);
    assert.equal(dbDoc.encryptedPassword.algorithm, 'aes-256-gcm');
    assert.ok(dbDoc.encryptedPassword.iv);
    assert.ok(dbDoc.encryptedPassword.authTag);
    assert.ok(dbDoc.encryptedPassword.ciphertext);
  });

  reportTest('MongoDB document NEVER contains plaintext password string', () => {
    const rawJson = JSON.stringify(dbDoc?.toObject());
    assert.equal(rawJson.includes(rawPassword), false);
  });

  console.log('[Test 6] Testing Credential List Endpoint & Pagination...');
  const listRes = await request(app)
    .get('/api/v1/credentials?page=1&limit=10')
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('GET /api/v1/credentials returns HTTP 200 with paginated items', () => {
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.success, true);
    assert.ok(Array.isArray(listRes.body.data.items));
    assert.ok(listRes.body.data.items.length >= 1);
    assert.equal(listRes.body.data.pagination.page, 1);
  });

  console.log('[Test 7] Testing Metadata Search and Filtering...');
  const searchRes = await request(app)
    .get('/api/v1/credentials?search=MongoDB')
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('Search by title "MongoDB" finds matching credential', () => {
    assert.equal(searchRes.status, 200);
    assert.ok(searchRes.body.data.items.some((c: any) => c.title.includes('MongoDB')));
  });

  const filterCategoryRes = await request(app)
    .get('/api/v1/credentials?category=DATABASE')
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('Filter by category "DATABASE" returns matching credentials', () => {
    assert.equal(filterCategoryRes.status, 200);
    assert.ok(filterCategoryRes.body.data.items.every((c: any) => c.category === 'DATABASE'));
  });

  console.log('[Test 8] Testing Dedicated Password Reveal Endpoint...');
  const revealRes = await request(app)
    .post(`/api/v1/credentials/${createdCredentialId}/reveal`)
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('POST /api/v1/credentials/:id/reveal returns HTTP 200 with decrypted plaintext', () => {
    assert.equal(revealRes.status, 200);
    assert.equal(revealRes.body.success, true);
    assert.equal(revealRes.body.data.username, 'faculty_admin');
    assert.equal(revealRes.body.data.password, rawPassword);
  });

  console.log('[Test 9] Testing Strict Ownership Enforcement & IDOR Protection...');
  // Employee B attempts to access Employee A's credential
  const idorGetRes = await request(app)
    .get(`/api/v1/credentials/${createdCredentialId}`)
    .set('Authorization', `Bearer ${tokenB}`);

  reportTest('Employee B GET on Employee A credential rejected with HTTP 403 Forbidden', () => {
    assert.equal(idorGetRes.status, 403);
    assert.equal(idorGetRes.body.success, false);
    assert.equal(idorGetRes.body.error.code, 'FORBIDDEN');
  });

  const idorRevealRes = await request(app)
    .post(`/api/v1/credentials/${createdCredentialId}/reveal`)
    .set('Authorization', `Bearer ${tokenB}`);

  reportTest('Employee B REVEAL on Employee A credential rejected with HTTP 403 Forbidden', () => {
    assert.equal(idorRevealRes.status, 403);
    assert.equal(idorRevealRes.body.success, false);
  });

  const idorPatchRes = await request(app)
    .patch(`/api/v1/credentials/${createdCredentialId}`)
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ title: 'Hacked Title' });

  reportTest('Employee B PATCH on Employee A credential rejected with HTTP 403 Forbidden', () => {
    assert.equal(idorPatchRes.status, 403);
  });

  const idorDeleteRes = await request(app)
    .delete(`/api/v1/credentials/${createdCredentialId}`)
    .set('Authorization', `Bearer ${tokenB}`);

  reportTest('Employee B DELETE on Employee A credential rejected with HTTP 403 Forbidden', () => {
    assert.equal(idorDeleteRes.status, 403);
  });

  console.log('[Test 10] Testing Credential Update and Password Re-Encryption...');
  const updatedPassword = 'NewRotatedSecurePassword@999!';
  const updateRes = await request(app)
    .patch(`/api/v1/credentials/${createdCredentialId}`)
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      title: 'College MongoDB Atlas Cluster (Updated)',
      password: updatedPassword,
    });

  reportTest('PATCH /api/v1/credentials/:id by owner returns HTTP 200 with updated title', () => {
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.credential.title, 'College MongoDB Atlas Cluster (Updated)');
  });

  const revealUpdatedRes = await request(app)
    .post(`/api/v1/credentials/${createdCredentialId}/reveal`)
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('Owner reveal verifies updated plaintext password', () => {
    assert.equal(revealUpdatedRes.status, 200);
    assert.equal(revealUpdatedRes.body.data.password, updatedPassword);
  });

  console.log('[Test 11] Testing Credential Deletion...');
  const deleteRes = await request(app)
    .delete(`/api/v1/credentials/${createdCredentialId}`)
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('DELETE /api/v1/credentials/:id by owner returns HTTP 200 OK', () => {
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.body.success, true);
  });

  const getAfterDeleteRes = await request(app)
    .get(`/api/v1/credentials/${createdCredentialId}`)
    .set('Authorization', `Bearer ${tokenA}`);

  reportTest('Deleted credential returns HTTP 404 Not Found', () => {
    assert.equal(getAfterDeleteRes.status, 404);
  });

  console.log('========================================');
  console.log(`Credential API Test Results: ${passedCount} passed, ${failedCount} failed`);
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


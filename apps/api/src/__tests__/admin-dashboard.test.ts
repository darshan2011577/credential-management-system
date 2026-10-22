import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { CredentialModel } from '../models/credential.model.js';
import { AuditLogModel } from '../models/audit-log.model.js';
import { CredentialShareModel } from '../models/credential-share.model.js';
import { TokenService } from '../services/token.service.js';
import { connectMongoDB, disconnectMongoDB } from '../infrastructure/database/mongodb.js';

console.log('========================================');
console.log('--- Running Phase 12 Admin Dashboard Unit & Security Tests ---');

let passedCount = 0;
let failedCount = 0;

function reportTest(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          console.log(`  ✓ PASSED: ${name}`);
          passedCount++;
        })
        .catch((error) => {
          console.error(`  ✗ FAILED: ${name}`);
          console.error('    Error:', error);
          failedCount++;
        });
    }
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

  // Test setup data
  const adminUser = await UserModel.create({
    employeeId: `ADM_DASH_${Date.now()}`,
    name: 'Dashboard Admin',
    email: `admin.dash.${Date.now()}@toptechdevelopers.com`,
    passwordHash: '$2b$12$eXAMpleBcryptHash12345678901234567890123456789012345',
    role: 'ADMIN',
    status: 'ACTIVE',
    department: 'IT Administration',
  });

  const employeeUser = await UserModel.create({
    employeeId: `EMP_DASH_${Date.now()}`,
    name: 'Dashboard Employee',
    email: `employee.dash.${Date.now()}@toptechdevelopers.com`,
    passwordHash: '$2b$12$eXAMpleBcryptHash12345678901234567890123456789012345',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    department: 'Software Engineering',
  });

  const adminToken = TokenService.createAccessToken({
    sub: adminUser._id.toString(),
    employeeId: adminUser.employeeId,
    role: 'ADMIN',
  });

  const employeeToken = TokenService.createAccessToken({
    sub: employeeUser._id.toString(),
    employeeId: employeeUser.employeeId,
    role: 'EMPLOYEE',
  });



  console.log('[Test 1] Testing Unauthenticated Access Rejection...');
  await reportTest('GET /api/v1/admin/dashboard without token is rejected with HTTP 401', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  console.log('[Test 2] Testing Role-Based Access Control (RBAC)...');
  await reportTest('GET /api/v1/admin/dashboard by EMPLOYEE is strictly rejected with HTTP 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${employeeToken}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error?.message?.includes('privileges') || res.body.error?.message?.includes('Access denied') || res.body.error?.message?.includes('Insufficient'));
  });

  await reportTest('GET /api/v1/admin/dashboard/employees by EMPLOYEE is rejected with HTTP 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard/employees')
      .set('Authorization', `Bearer ${employeeToken}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  await reportTest('GET /api/v1/admin/dashboard/activity by EMPLOYEE is rejected with HTTP 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard/activity')
      .set('Authorization', `Bearer ${employeeToken}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  console.log('[Test 3] Testing Admin Dashboard Aggregated Payload...');
  await reportTest('GET /api/v1/admin/dashboard by ADMIN returns HTTP 200 with full statistics', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data, 'Must return data object');

    const data = res.body.data;
    assert.ok(typeof data.employees?.total === 'number', 'Must include employee total');
    assert.ok(typeof data.employees?.active === 'number', 'Must include employee active count');
    assert.ok(typeof data.credentials?.total === 'number', 'Must include credential total');
    assert.ok(data.credentials?.byCategory, 'Must include category breakdown');
    assert.ok(typeof data.credentials?.byCategory?.WORK === 'number');
    assert.ok(typeof data.passwordHealth?.averageScore === 'number');
    assert.ok(typeof data.sharing?.total === 'number');
    assert.ok(Array.isArray(data.sharing?.recentShares));
    assert.ok(typeof data.audit?.totalEvents === 'number');
    assert.ok(Array.isArray(data.audit?.eventTimeline));
    assert.ok(data.license?.status, 'Must include license status');
    assert.ok(Array.isArray(data.recentActivity));
    assert.ok(Array.isArray(data.employeeOverview));
  });

  console.log('[Test 4] Testing Date Range Filtering Parameter...');
  await reportTest('GET /api/v1/admin/dashboard?dateRange=LAST_7_DAYS returns filtered stats', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard?dateRange=LAST_7_DAYS')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.dateRange, 'LAST_7_DAYS');
    assert.ok(res.body.data.calculatedFrom, 'Must have calculatedFrom date');
  });

  await reportTest('GET /api/v1/admin/dashboard?dateRange=TODAY returns today stats', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard?dateRange=TODAY')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.dateRange, 'TODAY');
  });

  console.log('[Test 5] Mandatory Privacy & Zero Secret Exposure Verification...');
  await reportTest('Dashboard response payload strictly contains zero secrets, passwords, or keys', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    const rawJson = JSON.stringify(res.body);

    // Assert zero occurrences of forbidden secret field names
    assert.equal(rawJson.includes('passwordHash'), false, 'Must NOT contain passwordHash');
    assert.equal(rawJson.includes('encryptedPassword'), false, 'Must NOT contain encryptedPassword');
    assert.equal(rawJson.includes('ciphertext'), false, 'Must NOT contain ciphertext');
    assert.equal(rawJson.includes('authTag'), false, 'Must NOT contain authTag');
    assert.equal(rawJson.includes('privateKey'), false, 'Must NOT contain privateKey');
    assert.equal(rawJson.includes('smtpPassword'), false, 'Must NOT contain smtpPassword');
  });

  console.log('[Test 6] Testing Sub-endpoints (Employees & Activity Feed)...');
  await reportTest('GET /api/v1/admin/dashboard/employees returns employee overview list', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard/employees')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.employees));
  });

  await reportTest('GET /api/v1/admin/dashboard/activity returns sanitized activity feed', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard/activity')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.recentActivity));
  });

  // Cleanup test documents
  await UserModel.deleteMany({ _id: { $in: [adminUser._id, employeeUser._id] } });
  await disconnectMongoDB();

  console.log('========================================');
  console.log(`Admin Dashboard Test Results: ${passedCount} passed, ${failedCount} failed`);
  console.log('========================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});


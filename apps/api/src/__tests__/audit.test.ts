import request from 'supertest';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { app } from '../app.js';
import { TokenService } from '../services/token.service.js';
import { UserModel } from '../models/user.model.js';
import { AuditLogModel } from '../models/audit-log.model.js';
import { AuditService } from '../services/audit.service.js';
import { sanitizeAuditMetadata } from '../utils/audit-sanitizer.js';
import { connectMongoDB, disconnectMongoDB } from '../infrastructure/database/mongodb.js';

console.log('========================================');
console.log('--- Running Phase 10 Security Audit Logging Tests ---');

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

  // 1. Setup Test Users
  const adminDoc = await UserModel.create({
    employeeId: `AUD_ADM_${Date.now()}`,
    name: 'Audit Superadmin',
    email: `superadmin.audit.${Date.now()}@toptechdevelopers.com`,
    passwordHash: '$2b$12$eXAMpleBcryptHash12345678901234567890123456789012345',
    role: 'ADMIN',
    status: 'ACTIVE',
    department: 'Cybersecurity',
  });

  const employeeDoc = await UserModel.create({
    employeeId: `AUD_EMP_${Date.now()}`,
    name: 'Audit Regular Employee',
    email: `employee.audit.${Date.now()}@toptechdevelopers.com`,
    passwordHash: '$2b$12$eXAMpleBcryptHash12345678901234567890123456789012345',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    department: 'Customer Support',
  });

  const adminId = adminDoc._id.toString();
  const employeeId = employeeDoc._id.toString();

  const adminToken = TokenService.createAccessToken({
    sub: adminId,
    employeeId: adminDoc.employeeId,
    role: 'ADMIN',
  });

  const employeeToken = TokenService.createAccessToken({
    sub: employeeId,
    employeeId: employeeDoc.employeeId,
    role: 'EMPLOYEE',
  });

  let createdAuditLogId = '';

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Unit Test - Metadata Recursive Sanitizer Strips Secrets
    // ------------------------------------------------------------------------
    await (async () => {
      const dirtyMetadata = {
        title: 'Production AWS Root',
        username: 'devops-lead',
        password: 'SUPER_SECRET_PLAINTEXT_PASSWORD_123!',
        passwd: 'another_password',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        accessToken: 'access_token_value',
        refreshToken: 'refresh_token_value',
        encryptionKey: '0123456789abcdef0123456789abcdef',
        nested: {
          safeProperty: 'allow_this',
          smtpPassword: 'smtp_secret_pass',
          iv: 'dGVzdF9pdl92YWx1ZQ==',
          authTag: 'dGVzdF9hdXRoX3RhZw==',
          ciphertext: 'ZW5jcnlwdGVkX3BheWxvYWRfdmFsdWU=',
        },
        itemsArray: [
          { safeName: 'item1', secret: 'secret_in_array' },
          { safeName: 'item2', mongodbUri: 'mongodb+srv://user:pass@cluster.mongodb.net' },
        ],
      };

      const cleaned = sanitizeAuditMetadata(dirtyMetadata) as Record<string, any>;
      assert.ok(cleaned);

      assert.strictEqual(cleaned.title, 'Production AWS Root');
      assert.strictEqual(cleaned.username, 'devops-lead');
      assert.strictEqual(cleaned.password, '[REDACTED_SECRET]');
      assert.strictEqual(cleaned.passwd, '[REDACTED_SECRET]');
      assert.strictEqual(cleaned.token, '[REDACTED_SECRET]');
      assert.strictEqual(cleaned.accessToken, '[REDACTED_SECRET]');
      assert.strictEqual(cleaned.refreshToken, '[REDACTED_SECRET]');
      assert.strictEqual(cleaned.encryptionKey, '[REDACTED_SECRET]');

      assert.strictEqual(cleaned.nested.safeProperty, 'allow_this');
      assert.strictEqual(cleaned.nested.smtpPassword, '[REDACTED_SECRET]');
      assert.strictEqual(cleaned.nested.iv, '[REDACTED_SECRET]');
      assert.strictEqual(cleaned.nested.authTag, '[REDACTED_SECRET]');
      assert.strictEqual(cleaned.nested.ciphertext, '[REDACTED_SECRET]');

      assert.strictEqual(cleaned.itemsArray.items[0].safeName, 'item1');
      assert.strictEqual(cleaned.itemsArray.items[0].secret, '[REDACTED_SECRET]');
      assert.strictEqual(cleaned.itemsArray.items[1].safeName, 'item2');
      assert.strictEqual(cleaned.itemsArray.items[1].mongodbUri, '[REDACTED_SECRET]');

      reportTest('Unit Test: sanitizeAuditMetadata strictly strips secrets and keys', () => {});
    })();

    // ------------------------------------------------------------------------
    // TEST 2: AuditService.record writes sanitized audit document
    // ------------------------------------------------------------------------
    await (async () => {
      const entry = await AuditService.record({
        actorId: adminId,
        actorRole: 'ADMIN',
        actorEmail: adminDoc.email,
        actorName: adminDoc.name,
        action: 'CREDENTIAL_CREATED',
        category: 'CREDENTIAL',
        resourceType: 'Credential',
        resourceId: new mongoose.Types.ObjectId().toString(),
        result: 'SUCCESS',
        ipAddress: '192.168.1.50',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        requestId: `req-test-${Date.now()}`,
        metadata: {
          title: 'Database Cluster Admin',
          category: 'DATABASE',
          password: 'MUST_NOT_BE_SAVED_123',
          entryLength: 24,
        },
      });

      assert.ok(entry.id);
      assert.strictEqual(entry.action, 'CREDENTIAL_CREATED');
      assert.strictEqual(entry.category, 'CREDENTIAL');
      assert.strictEqual(entry.actorRole, 'ADMIN');
      assert.strictEqual(entry.result, 'SUCCESS');
      assert.strictEqual(entry.metadata?.title, 'Database Cluster Admin');
      assert.strictEqual(entry.metadata?.password, '[REDACTED_SECRET]', 'Plaintext password must be sanitized');
      assert.notStrictEqual(entry.metadata?.password, 'MUST_NOT_BE_SAVED_123');
      assert.strictEqual(entry.metadata?.entryLength, 24);

      createdAuditLogId = entry.id;
      reportTest('AuditService.record persists immutable audit log with zero secrets', () => {});
    })();

    // ------------------------------------------------------------------------
    // TEST 3: RBAC - Employee is Forbidden (403) from accessing audit logs
    // ------------------------------------------------------------------------
    await (async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${employeeToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.error.message.includes('Access denied'));

      reportTest('RBAC: Employee role is rejected with 403 Forbidden', () => {});
    })();

    // ------------------------------------------------------------------------
    // TEST 4: RBAC - Unauthenticated request returns 401 Unauthorized
    // ------------------------------------------------------------------------
    await (async () => {
      const res = await request(app).get('/api/v1/audit-logs');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);

      reportTest('RBAC: Unauthenticated request is rejected with 401 Unauthorized', () => {});
    })();

    // ------------------------------------------------------------------------
    // TEST 5: Admin retrieves paginated audit logs (200 OK)
    // ------------------------------------------------------------------------
    await (async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
      assert.ok(res.body.data.pagination);
      assert.strictEqual(res.body.data.pagination.page, 1);
      assert.strictEqual(res.body.data.pagination.limit, 10);
      assert.ok(res.body.data.pagination.total >= 1);

      reportTest('Admin: GET /api/v1/audit-logs retrieves paginated audit logs', () => {});
    })();

    // ------------------------------------------------------------------------
    // TEST 6: Admin filters by category and result
    // ------------------------------------------------------------------------
    await (async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?category=CREDENTIAL&result=SUCCESS')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      for (const item of res.body.data.items) {
        assert.strictEqual(item.category, 'CREDENTIAL');
        assert.strictEqual(item.result, 'SUCCESS');
      }

      reportTest('Admin: GET /api/v1/audit-logs filters correctly by category and result', () => {});
    })();

    // ------------------------------------------------------------------------
    // TEST 7: Admin retrieves single audit log by ID
    // ------------------------------------------------------------------------
    await (async () => {
      const res = await request(app)
        .get(`/api/v1/audit-logs/${createdAuditLogId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.log.id, createdAuditLogId);
      assert.strictEqual(res.body.data.log.action, 'CREDENTIAL_CREATED');

      reportTest('Admin: GET /api/v1/audit-logs/:id retrieves single audit log entry', () => {});
    })();

    // ------------------------------------------------------------------------
    // TEST 8: Invalid audit log ID format returns 422
    // ------------------------------------------------------------------------
    await (async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/invalid-not-an-objectid')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 422);
      assert.strictEqual(res.body.success, false);

      reportTest('Validation: Malformed audit log ID returns 422 validation error', () => {});
    })();

    // ------------------------------------------------------------------------
    // TEST 9: Nonexistent audit log ID returns 404
    // ------------------------------------------------------------------------
    await (async () => {
      const randomObjectId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/audit-logs/${randomObjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);

      reportTest('Error handling: Nonexistent audit log ID returns 404 Not Found', () => {});
    })();

    // ------------------------------------------------------------------------
    // TEST 10: Immutability Verification (No PUT, PATCH, DELETE endpoints exist)
    // ------------------------------------------------------------------------
    await (async () => {
      const putRes = await request(app)
        .put(`/api/v1/audit-logs/${createdAuditLogId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'MODIFIED_ACTION' });
      assert.strictEqual(putRes.status, 404, 'PUT /audit-logs/:id must not exist (404)');

      const patchRes = await request(app)
        .patch(`/api/v1/audit-logs/${createdAuditLogId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'PATCHED_ACTION' });
      assert.strictEqual(patchRes.status, 404, 'PATCH /audit-logs/:id must not exist (404)');

      const deleteRes = await request(app)
        .delete(`/api/v1/audit-logs/${createdAuditLogId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(deleteRes.status, 404, 'DELETE /audit-logs/:id must not exist (404)');

      reportTest('Immutability: Audit log endpoints strictly prohibit PUT/PATCH/DELETE (404)', () => {});
    })();

    // ------------------------------------------------------------------------
    // TEST 11: Keyword search across action, email, and IP address
    // ------------------------------------------------------------------------
    await (async () => {
      const res = await request(app)
        .get(`/api/v1/audit-logs?search=${encodeURIComponent(adminDoc.email)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.items.length >= 1);
      const found = res.body.data.items.some((item: any) => item.actorEmail === adminDoc.email);
      assert.ok(found, 'Search query should match actor email');

      reportTest('Admin: Keyword search returns matching audit records', () => {});
    })();

  } finally {
    // Cleanup created test records
    await AuditLogModel.deleteMany({ actorId: new mongoose.Types.ObjectId(adminId) });
    await UserModel.deleteMany({ _id: { $in: [adminDoc._id, employeeDoc._id] } });
    await disconnectMongoDB();
  }

  console.log('========================================');
  console.log(`Phase 10 Tests Completed: ${passedCount} passed, ${failedCount} failed`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});

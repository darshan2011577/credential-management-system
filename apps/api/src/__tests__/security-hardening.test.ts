import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app.js';
import { connectMongoDB, disconnectMongoDB } from '../infrastructure/database/mongodb.js';
import { connectRedis, disconnectRedis } from '../infrastructure/redis/redis.js';
import { UserModel } from '../models/user.model.js';
import { CredentialModel } from '../models/credential.model.js';
import { CredentialShareModel } from '../models/credential-share.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { AuditLogModel } from '../models/audit-log.model.js';
import { EncryptionService } from '../services/encryption.service.js';
import { LicenseService } from '../services/license.service.js';
import { TokenService } from '../services/token.service.js';
import { hashPassword } from '../utils/password.js';
import { DEFAULT_SIGNED_LICENSE } from '@credential-manager/config';

let adminToken: string;
let employeeAToken: string;
let employeeBToken: string;
let employeeCToken: string;

let adminUserId: string;
let employeeAUserId: string;
let employeeBUserId: string;
let employeeCUserId: string;

let credentialAId: string;
let shareABId: string;
let notificationBId: string;

function assertNoSecretLeakage(responseBody: unknown, context: string): void {
  const jsonStr = JSON.stringify(responseBody);
  
  // Specific checks for forbidden secret keys
  if (jsonStr.includes('passwordHash')) {
    throw new Error(`[Security Violation] passwordHash leaked in ${context}`);
  }
  if (jsonStr.includes('BEGIN PRIVATE KEY')) {
    throw new Error(`[Security Violation] Private Key leaked in ${context}`);
  }
  if (jsonStr.includes('CREDENTIAL_ENCRYPTION_KEY')) {
    throw new Error(`[Security Violation] Master encryption key leaked in ${context}`);
  }
  if (jsonStr.includes('encryptedPassword')) {
    throw new Error(`[Security Violation] Raw encryptedPassword field leaked in ${context}`);
  }
}

async function runSecurityHardeningTests(): Promise<void> {
  console.log('================================================================');
  console.log('Phase 13: Comprehensive Security Hardening & Zero-Leakage Tests');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string): void {
    if (condition) {
      console.log(`  ✓ PASSED: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAILED: ${message}`);
      failed++;
    }
  }

  try {
    await connectMongoDB();
    await connectRedis();

    // --------------------------------------------------------------------------
    // Setup Synthetic Test Fixtures
    // --------------------------------------------------------------------------
    const testAdmin = await UserModel.findOneAndUpdate(
      { email: 'sec.admin@toptechdevelopers.com' },
      {
        employeeId: 'ADM_SEC_01',
        name: 'Security Admin',
        email: 'sec.admin@toptechdevelopers.com',
        passwordHash: await hashPassword('Admin@Security2026!'),
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      { upsert: true, new: true }
    );
    adminUserId = testAdmin._id.toString();

    const testEmpA = await UserModel.findOneAndUpdate(
      { email: 'sec.emp.a@toptechdevelopers.com' },
      {
        employeeId: 'EMP_SEC_A',
        name: 'Employee Alice',
        email: 'sec.emp.a@toptechdevelopers.com',
        passwordHash: await hashPassword('EmployeeA@2026!'),
        role: 'EMPLOYEE',
        status: 'ACTIVE',
      },
      { upsert: true, new: true }
    );
    employeeAUserId = testEmpA._id.toString();

    const testEmpB = await UserModel.findOneAndUpdate(
      { email: 'sec.emp.b@toptechdevelopers.com' },
      {
        employeeId: 'EMP_SEC_B',
        name: 'Employee Bob',
        email: 'sec.emp.b@toptechdevelopers.com',
        passwordHash: await hashPassword('EmployeeB@2026!'),
        role: 'EMPLOYEE',
        status: 'ACTIVE',
      },
      { upsert: true, new: true }
    );
    employeeBUserId = testEmpB._id.toString();

    const testEmpC = await UserModel.findOneAndUpdate(
      { email: 'sec.emp.c@toptechdevelopers.com' },
      {
        employeeId: 'EMP_SEC_C',
        name: 'Employee Charlie',
        email: 'sec.emp.c@toptechdevelopers.com',
        passwordHash: await hashPassword('EmployeeC@2026!'),
        role: 'EMPLOYEE',
        status: 'ACTIVE',
      },
      { upsert: true, new: true }
    );
    employeeCUserId = testEmpC._id.toString();

    // Issue Direct Access Tokens
    adminToken = TokenService.createAccessToken({
      sub: adminUserId,
      employeeId: testAdmin.employeeId,
      role: 'ADMIN',
    });

    employeeAToken = TokenService.createAccessToken({
      sub: employeeAUserId,
      employeeId: testEmpA.employeeId,
      role: 'EMPLOYEE',
    });

    employeeBToken = TokenService.createAccessToken({
      sub: employeeBUserId,
      employeeId: testEmpB.employeeId,
      role: 'EMPLOYEE',
    });

    employeeCToken = TokenService.createAccessToken({
      sub: employeeCUserId,
      employeeId: testEmpC.employeeId,
      role: 'EMPLOYEE',
    });

    // Create Initial Credential for Alice
    const credRes = await request(app)
      .post('/api/v1/credentials')
      .set('Authorization', `Bearer ${employeeAToken}`)
      .send({
        title: 'Alice AWS Production Key',
        category: 'CLOUD',
        username: 'alice.aws.admin',
        password: 'SuperSecretAliceKey@2026!',
        notes: 'Critical cloud infrastructure secret',
      });
    credentialAId = credRes.body.data.credential?.id || credRes.body.data.id;

    // Alice shares credential with Bob (VIEW only)
    const shareRes = await request(app)
      .post('/api/v1/credential-shares')
      .set('Authorization', `Bearer ${employeeAToken}`)
      .send({
        credentialId: credentialAId,
        recipientId: employeeBUserId,
        permission: 'VIEW',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    shareABId = shareRes.body.data.share?.id || shareRes.body.data.id;

    // Create a notification for Bob
    const notif = await NotificationModel.create({
      recipientId: new mongoose.Types.ObjectId(employeeBUserId),
      type: 'SHARE_REQUEST_RECEIVED',
      title: 'Secret Share',
      message: 'Alice shared a credential with you',
      read: false,
    });
    notificationBId = notif._id.toString();

    // ==========================================================================
    // TEST SECTION 1: IDOR & Resource Ownership Isolation
    // ==========================================================================
    console.log('[Security Test 1] Testing IDOR & Resource Ownership Protection...');

    // 1.1 Bob attempts to read Alice's credential directly
    const idorGet = await request(app)
      .get(`/api/v1/credentials/${credentialAId}`)
      .set('Authorization', `Bearer ${employeeBToken}`);
    assert(idorGet.status === 403, 'Employee B cannot read Employee A credential via direct ID (HTTP 403)');

    // 1.2 Bob attempts to update Alice's credential
    const idorPatch = await request(app)
      .patch(`/api/v1/credentials/${credentialAId}`)
      .set('Authorization', `Bearer ${employeeBToken}`)
      .send({ title: 'Tampered by Bob' });
    assert(idorPatch.status === 403, 'Employee B cannot modify Employee A credential (HTTP 403)');

    // 1.3 Bob attempts to delete Alice's credential
    const idorDelete = await request(app)
      .delete(`/api/v1/credentials/${credentialAId}`)
      .set('Authorization', `Bearer ${employeeBToken}`);
    assert(idorDelete.status === 403, 'Employee B cannot delete Employee A credential (HTTP 403)');

    // 1.4 Bob attempts to reveal Alice's password via owner reveal endpoint
    const idorReveal = await request(app)
      .post(`/api/v1/credentials/${credentialAId}/reveal`)
      .set('Authorization', `Bearer ${employeeBToken}`);
    assert(idorReveal.status === 403, 'Employee B cannot trigger owner password reveal on Employee A credential (HTTP 403)');

    // 1.5 Charlie (unauthorized third party) attempts to approve Alice's share to Bob
    const idorApprove = await request(app)
      .post(`/api/v1/credential-shares/${shareABId}/approve`)
      .set('Authorization', `Bearer ${employeeCToken}`);
    assert(idorApprove.status === 403, 'Unauthorized Employee C cannot approve share created for Employee B (HTTP 403)');

    // 1.6 Charlie attempts to reject Alice's share to Bob
    const idorReject = await request(app)
      .post(`/api/v1/credential-shares/${shareABId}/reject`)
      .set('Authorization', `Bearer ${employeeCToken}`);
    assert(idorReject.status === 403, 'Unauthorized Employee C cannot reject share created for Employee B (HTTP 403)');

    // 1.7 Bob (recipient) attempts to revoke the share (only owner can revoke)
    const idorRevoke = await request(app)
      .post(`/api/v1/credential-shares/${shareABId}/revoke`)
      .set('Authorization', `Bearer ${employeeBToken}`);
    assert(idorRevoke.status === 403, 'Recipient Employee B cannot revoke share (Owner-only operation) (HTTP 403)');

    // 1.8 Alice attempts to mark Bob's notification as read
    const idorNotif = await request(app)
      .post(`/api/v1/notifications/${notificationBId}/read`)
      .set('Authorization', `Bearer ${employeeAToken}`);
    assert(idorNotif.status === 403, 'Employee A cannot mark Employee B notification as read (HTTP 403)');

    // 1.9 Bob attempts to reveal password on a VIEW-only share
    // First Bob approves the share
    await request(app)
      .post(`/api/v1/credential-shares/${shareABId}/approve`)
      .set('Authorization', `Bearer ${employeeBToken}`);

    const viewOnlyReveal = await request(app)
      .post(`/api/v1/credentials/shared/${credentialAId}/reveal`)
      .set('Authorization', `Bearer ${employeeBToken}`);
    assert(viewOnlyReveal.status === 403, 'Recipient with VIEW permission is strictly denied from password reveal (HTTP 403)');

    // ==========================================================================
    // TEST SECTION 2: Role-Based Authorization & Admin Boundary
    // ==========================================================================
    console.log('\n[Security Test 2] Testing Role-Based Authorization Gating...');

    // 2.1 Employee calls Admin Dashboard
    const rbacDashboard = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assert(rbacDashboard.status === 403, 'Employee direct GET /api/v1/admin/dashboard rejected with HTTP 403 Forbidden');

    // 2.2 Employee calls Admin Employees Overview
    const rbacEmployees = await request(app)
      .get('/api/v1/admin/dashboard/employees')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assert(rbacEmployees.status === 403, 'Employee direct GET /api/v1/admin/dashboard/employees rejected with HTTP 403 Forbidden');

    // 2.3 Employee calls Admin Activity Feed
    const rbacActivity = await request(app)
      .get('/api/v1/admin/dashboard/activity')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assert(rbacActivity.status === 403, 'Employee direct GET /api/v1/admin/dashboard/activity rejected with HTTP 403 Forbidden');

    // 2.4 Employee calls Audit Logs
    const rbacAudit = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assert(rbacAudit.status === 403, 'Employee direct GET /api/v1/audit-logs rejected with HTTP 403 Forbidden');

    // 2.5 Unauthenticated calls to protected routes
    const unauthCreds = await request(app).get('/api/v1/credentials');
    assert(unauthCreds.status === 401, 'Unauthenticated GET /api/v1/credentials rejected with HTTP 401');

    const unauthAdmin = await request(app).get('/api/v1/admin/dashboard');
    assert(unauthAdmin.status === 401, 'Unauthenticated GET /api/v1/admin/dashboard rejected with HTTP 401');

    // ==========================================================================
    // TEST SECTION 3: Zero Secret Leakage across Serialized API Responses
    // ==========================================================================
    console.log('\n[Security Test 3] Testing Zero Secret Leakage across API Responses...');

    // 3.1 Credential List Endpoint
    const credListRes = await request(app)
      .get('/api/v1/credentials')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assertNoSecretLeakage(credListRes.body, 'GET /api/v1/credentials');
    assert(credListRes.body.data.items[0].encryptedPassword === undefined, 'Encrypted password payload omitted from credential list');

    // 3.2 Password Health Summary & Details
    const healthSummaryRes = await request(app)
      .get('/api/v1/password-health')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assertNoSecretLeakage(healthSummaryRes.body, 'GET /api/v1/password-health');
    assert(typeof healthSummaryRes.body.data.score === 'number', 'Health score is aggregated numeric value');

    const healthCredsRes = await request(app)
      .get('/api/v1/password-health/credentials')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assertNoSecretLeakage(healthCredsRes.body, 'GET /api/v1/password-health/credentials');

    // 3.3 Sharing List Endpoints
    const outgoingRes = await request(app)
      .get('/api/v1/credential-shares/outgoing')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assertNoSecretLeakage(outgoingRes.body, 'GET /api/v1/credential-shares/outgoing');

    const incomingRes = await request(app)
      .get('/api/v1/credential-shares/incoming')
      .set('Authorization', `Bearer ${employeeBToken}`);
    assertNoSecretLeakage(incomingRes.body, 'GET /api/v1/credential-shares/incoming');

    // 3.4 Notifications List Endpoint
    const notifRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${employeeBToken}`);
    assertNoSecretLeakage(notifRes.body, 'GET /api/v1/notifications');

    // 3.5 Admin Dashboard Endpoints
    const adminDashRes = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    assertNoSecretLeakage(adminDashRes.body, 'GET /api/v1/admin/dashboard');

    const adminEmpRes = await request(app)
      .get('/api/v1/admin/dashboard/employees')
      .set('Authorization', `Bearer ${adminToken}`);
    assertNoSecretLeakage(adminEmpRes.body, 'GET /api/v1/admin/dashboard/employees');

    const adminActRes = await request(app)
      .get('/api/v1/admin/dashboard/activity')
      .set('Authorization', `Bearer ${adminToken}`);
    assertNoSecretLeakage(adminActRes.body, 'GET /api/v1/admin/dashboard/activity');

    // 3.6 Audit Logs Endpoint
    const auditRes = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    assertNoSecretLeakage(auditRes.body, 'GET /api/v1/audit-logs');

    // 3.7 License Status Endpoint
    const licRes = await request(app).get('/api/v1/license/status');
    assertNoSecretLeakage(licRes.body, 'GET /api/v1/license/status');
    assert(licRes.body.data.licensePrivateKey === undefined, 'License private key is absent from license status response');

    assert(true, 'Zero secret leakage verified across all 10 API response categories');

    // ==========================================================================
    // TEST SECTION 4: NoSQL Injection & Input Validation Hardening
    // ==========================================================================
    console.log('\n[Security Test 4] Testing NoSQL Injection & Regex Sanitization...');

    // 4.1 Regex special character injection in search filter
    const regexSearch = await request(app)
      .get('/api/v1/credentials?search=.*+?^${}()|[\\]\\\\')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assert(regexSearch.status === 200, 'Regex metacharacter search query is safely escaped without MongoDB error');

    // 4.2 Malformed ObjectId in path parameters
    const malformedId = await request(app)
      .get('/api/v1/credentials/non-existent-or-invalid-id')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assert(malformedId.status === 400 || malformedId.status === 422, 'Malformed ObjectId in URL path rejected with 400/422');

    // 4.3 Out of bounds pagination limit
    const hugeLimit = await request(app)
      .get('/api/v1/credentials?limit=999999999')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assert(hugeLimit.status === 200, 'Excessive pagination limit is safely clamped to maximum allowed (100)');
    assert(hugeLimit.body.data.pagination.limit <= 100, 'Actual returned limit is clamped <= 100');

    // 4.4 Negative pagination page
    const negPage = await request(app)
      .get('/api/v1/credentials?page=-10')
      .set('Authorization', `Bearer ${employeeAToken}`);
    assert(negPage.status === 200 && negPage.body.data.pagination.page === 1, 'Negative page number clamped to page 1');

    // ==========================================================================
    // TEST SECTION 5: AES-256-GCM Integrity & Tamper Resilience
    // ==========================================================================
    console.log('\n[Security Test 5] Testing AES-256-GCM Cryptographic Integrity & Anti-Tamper...');

    const originalSecret = 'MasterKeyVerificationPlaintext2026!';
    const encrypted = EncryptionService.encrypt(originalSecret);

    // 5.1 Tampered ciphertext
    const tamperedCiphertext = {
      ...encrypted,
      ciphertext: Buffer.from('TamperedData12345678901234567890').toString('base64'),
    };
    let ciphertextTamperThrew = false;
    try {
      EncryptionService.decrypt(tamperedCiphertext);
    } catch {
      ciphertextTamperThrew = true;
    }
    assert(ciphertextTamperThrew, 'Altered ciphertext triggers cryptographic authentication failure');

    // 5.2 Tampered authentication tag
    const tamperedTag = {
      ...encrypted,
      authTag: Buffer.from('TamperedTag12345').toString('base64'),
    };
    let tagTamperThrew = false;
    try {
      EncryptionService.decrypt(tamperedTag);
    } catch {
      tagTamperThrew = true;
    }
    assert(tagTamperThrew, 'Altered 16-byte authentication tag triggers decryption rejection');

    // 5.3 Valid decryption cycle
    const decrypted = EncryptionService.decrypt(encrypted);
    assert(decrypted === originalSecret, 'Unmodified AES-256-GCM ciphertext decrypts successfully to original plaintext');

    // ==========================================================================
    // TEST SECTION 6: License Signature & Anti-Tamper Enforcement
    // ==========================================================================
    console.log('\n[Security Test 6] Testing Ed25519 License Asymmetric Signature Verification...');

    // 6.1 Valid pre-signed evaluation license
    const validLicenseCheck = await LicenseService.validateLicense(
      DEFAULT_SIGNED_LICENSE as any,
      true
    );
    assert(validLicenseCheck.isValid === true, 'Original signed license is valid');
    assert(validLicenseCheck.status === 'VALID' || validLicenseCheck.status === 'EXPIRING_SOON', 'License status is VALID / EXPIRING_SOON');

    // 6.2 Tampered license payload (modify organization by 1 char)
    const tamperedLicense = {
      ...DEFAULT_SIGNED_LICENSE,
      payload: {
        ...DEFAULT_SIGNED_LICENSE.payload,
        organization: 'Malicious Modified University',
      },
    };
    const tamperedResult = await LicenseService.validateLicense(tamperedLicense as any, true);
    assert(tamperedResult.isValid === false, 'Tampered license payload fails cryptographic signature verification');
    assert(tamperedResult.status === 'TAMPERED', 'Tampered license status is strictly classified as TAMPERED');

    // 6.3 License for wrong product
    const wrongProductLicense = {
      ...DEFAULT_SIGNED_LICENSE,
      payload: {
        ...DEFAULT_SIGNED_LICENSE.payload,
        product: 'UnrelatedProduct',
      },
    };
    const wrongProductResult = await LicenseService.validateLicense(wrongProductLicense as any, true);
    assert(wrongProductResult.isValid === false, 'Wrong product identifier rejected');

    // --------------------------------------------------------------------------
    // Cleanup Test Fixtures
    // --------------------------------------------------------------------------
    await UserModel.deleteMany({
      email: {
        $in: [
          'sec.admin@toptechdevelopers.com',
          'sec.emp.a@toptechdevelopers.com',
          'sec.emp.b@toptechdevelopers.com',
          'sec.emp.c@toptechdevelopers.com',
        ],
      },
    });
    await CredentialModel.deleteMany({ ownerId: { $in: [employeeAUserId, employeeBUserId, employeeCUserId] } });
    await CredentialShareModel.deleteMany({ _id: shareABId });
    await NotificationModel.deleteMany({ _id: notificationBId });
  } finally {
    await disconnectMongoDB();
    await disconnectRedis();
  }

  console.log('\n========================================');
  console.log(`Security Hardening Test Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Auto-run when executed directly
runSecurityHardeningTests().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});

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
console.log('--- Running Phase 14 Secure File & Email Sharing Tests ---');

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

  // Create test users
  const ownerDoc = await UserModel.create({
    employeeId: `FILE_OWN_${Date.now()}`,
    name: 'File Owner Alice',
    email: `alice.fileshare.${Date.now()}@toptechdevelopers.com`,
    passwordHash: '$2b$12$eXAMpleBcryptHash12345678901234567890123456789012345',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    department: 'Engineering',
  });

  const recipientDoc = await UserModel.create({
    employeeId: `FILE_REC_${Date.now()}`,
    name: 'File Recipient Bob',
    email: `bob.fileshare.${Date.now()}@toptechdevelopers.com`,
    passwordHash: '$2b$12$eXAMpleBcryptHash12345678901234567890123456789012345',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    department: 'Operations',
  });

  const ownerId = ownerDoc._id.toString();
  const recipientId = recipientDoc._id.toString();

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

  // Create a credential for email sharing test
  const encrypted = EncryptionService.encrypt('SuperSecretPassword123!');
  const credDoc = await CredentialModel.create({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    title: 'Production AWS Console',
    username: 'admin@aws.corp',
    encryptedPassword: encrypted,
    category: 'CLOUD',
    website: 'https://aws.amazon.com',
  });
  const credentialId = credDoc._id.toString();

  let panelFileShareId: string = '';
  let emailCredShareId: string = '';
  let emailFileShareId: string = '';
  let externalShareToken: string = '';
  const externalEmail = 'client.partner@external-corp.org';

  // --------------------------------------------------------------------------
  console.log('\n[Test 1] Testing Disallowed File Type Rejection...');
  // --------------------------------------------------------------------------
  const invalidFileRes = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${ownerToken}`)
    .field('resourceType', 'FILE')
    .field('shareMethod', 'PANEL')
    .field('recipientId', recipientId)
    .field('permission', 'VIEW_DOWNLOAD')
    .field('expiresAt', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
    .attach('files', Buffer.from('malicious binary content'), 'malware.exe');

  reportTest('Rejects file with unpermitted extension .exe with HTTP 400', () => {
    assert.equal(invalidFileRes.status, 400);
    assert.equal(invalidFileRes.body.success, false);
    assert.match(invalidFileRes.body.error?.message || invalidFileRes.body.error, /unpermitted file type/i);
  });

  // --------------------------------------------------------------------------
  console.log('\n[Test 2] Testing Panel File Sharing (Single File Upload)...');
  // --------------------------------------------------------------------------
  const singleFileRes = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${ownerToken}`)
    .field('resourceType', 'FILE')
    .field('shareMethod', 'PANEL')
    .field('recipientId', recipientId)
    .field('permission', 'VIEW_DOWNLOAD')
    .field('maxDownloads', '3')
    .field('expiresAt', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
    .attach('files', Buffer.from('Project architecture report content for 2026'), 'Project_Report.pdf');

  reportTest('Creates single file panel share with HTTP 201', () => {
    assert.equal(singleFileRes.status, 201);
    assert.equal(singleFileRes.body.success, true);
    assert.equal(singleFileRes.body.data.share.resourceType, 'FILE');
    assert.equal(singleFileRes.body.data.share.fileMetadata.originalName, 'Project_Report.pdf');
    assert.equal(singleFileRes.body.data.share.status, 'PENDING');
    panelFileShareId = singleFileRes.body.data.share.id;
  });

  // --------------------------------------------------------------------------
  console.log('\n[Test 3] Testing Panel File Share Multiple Files with ZIP Compression...');
  // --------------------------------------------------------------------------
  const multiFileRes = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${ownerToken}`)
    .field('resourceType', 'FILE')
    .field('shareMethod', 'PANEL')
    .field('recipientId', recipientId)
    .field('permission', 'VIEW_DOWNLOAD')
    .field('compress', 'true')
    .field('expiresAt', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
    .attach('files', Buffer.from('Document A contents'), 'DocA.txt')
    .attach('files', Buffer.from('Document B contents'), 'DocB.txt');

  reportTest('Creates multiple file share packaged as ZIP archive', () => {
    assert.equal(multiFileRes.status, 201);
    assert.equal(multiFileRes.body.data.share.fileMetadata.isCompressed, true);
    assert.equal(multiFileRes.body.data.share.fileMetadata.fileCount, 2);
    assert.match(multiFileRes.body.data.share.fileMetadata.originalName, /\.zip$/);
  });

  // --------------------------------------------------------------------------
  console.log('\n[Test 4] Testing Recipient Approval & File Download (Panel Share)...');
  // --------------------------------------------------------------------------
  const approveRes = await request(app)
    .post(`/api/v1/credential-shares/${panelFileShareId}/approve`)
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Recipient approves file share with HTTP 200', () => {
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.data.share.status, 'ACTIVE');
  });

  // Recipient downloads the file
  const downloadRes = await request(app)
    .get(`/api/v1/credential-shares/${panelFileShareId}/download`)
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Recipient downloads authorized file with attachment header', () => {
    assert.equal(downloadRes.status, 200);
    assert.match(downloadRes.headers['content-disposition'], /Project_Report\.pdf/);
    const content = downloadRes.text || (downloadRes.body && downloadRes.body.toString('utf8'));
    assert.equal(content, 'Project architecture report content for 2026');
  });

  // Check download count incremented
  const shareInDb = await CredentialShareModel.findById(panelFileShareId);
  reportTest('Download counter is incremented in database', () => {
    assert.equal(shareInDb?.downloadCount, 1);
  });

  // --------------------------------------------------------------------------
  console.log('\n[Test 5] Testing Email Credential Sharing (Registered vs External)...');
  // --------------------------------------------------------------------------
  const emailCredRes = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      resourceType: 'CREDENTIAL',
      shareMethod: 'EMAIL',
      credentialId,
      recipientEmail: externalEmail,
      permission: 'VIEW_REVEAL',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

  reportTest('Creates external email credential share with secure shareUrl', () => {
    assert.equal(emailCredRes.status, 201);
    assert.equal(emailCredRes.body.data.share.shareMethod, 'EMAIL');
    assert.equal(emailCredRes.body.data.share.recipientType, 'EXTERNAL');
    assert.ok(emailCredRes.body.data.share.shareUrl);
    assert.match(emailCredRes.body.data.share.shareUrl, /\/access-share\/[0-9a-f]{64}/);

    emailCredShareId = emailCredRes.body.data.share.id;
    const urlParts = emailCredRes.body.data.share.shareUrl.split('/');
    externalShareToken = urlParts[urlParts.length - 1];
  });

  // --------------------------------------------------------------------------
  console.log('\n[Test 6] Testing Public External Share Metadata Resolution...');
  // --------------------------------------------------------------------------
  const publicMetaRes = await request(app)
    .get(`/api/v1/credential-shares/public/${externalShareToken}`);

  reportTest('Unauthenticated external user fetches safe share metadata', () => {
    assert.equal(publicMetaRes.status, 200);
    assert.equal(publicMetaRes.body.data.metadata.resourceType, 'CREDENTIAL');
    assert.equal(publicMetaRes.body.data.metadata.senderName, 'File Owner Alice');
    assert.equal(publicMetaRes.body.data.metadata.requiresOtp, true);
    assert.equal(publicMetaRes.body.data.metadata.isExpired, false);
    assert.equal(publicMetaRes.body.data.metadata.isRevoked, false);
  });

  // --------------------------------------------------------------------------
  console.log('\n[Test 7] Testing Public Share OTP Request & Verification...');
  // --------------------------------------------------------------------------
  // 7A: Request OTP with incorrect email
  const wrongEmailOtpRes = await request(app)
    .post(`/api/v1/credential-shares/public/${externalShareToken}/otp/request`)
    .send({ email: 'wrong.person@other.com' });

  reportTest('Rejects OTP request for mismatched email with HTTP 403', () => {
    assert.equal(wrongEmailOtpRes.status, 403);
  });

  // 7B: Request OTP with correct email
  const correctOtpReq = await request(app)
    .post(`/api/v1/credential-shares/public/${externalShareToken}/otp/request`)
    .send({ email: externalEmail });

  reportTest('Sends OTP verification code with HTTP 200', () => {
    assert.equal(correctOtpReq.status, 200);
    assert.equal(correctOtpReq.body.success, true);
  });

  // Retrieve hashed OTP from DB to simulate user entering code
  const shareWithOtp = await CredentialShareModel.findById(emailCredShareId);
  assert.ok(shareWithOtp?.otpHash, 'OTP hash must be present in DB');

  // Verify with incorrect OTP
  const wrongOtpVerify = await request(app)
    .post(`/api/v1/credential-shares/public/${externalShareToken}/otp/verify`)
    .send({ email: externalEmail, otp: '000000' });

  reportTest('Rejects incorrect OTP code with HTTP 400', () => {
    assert.equal(wrongOtpVerify.status, 400);
  });

  // Set known OTP in DB for deterministic verification test
  const testOtp = '123456';
  const testOtpHash = CredentialShareModel.schema.methods ? CredentialShareModel.schema.methods : null;
  const crypto = await import('crypto');
  shareWithOtp.otpHash = crypto.createHash('sha256').update(testOtp).digest('hex');
  await shareWithOtp.save();

  // Verify with correct OTP
  const correctOtpVerify = await request(app)
    .post(`/api/v1/credential-shares/public/${externalShareToken}/otp/verify`)
    .send({ email: externalEmail, otp: testOtp });

  reportTest('Verifies valid OTP and unlocks decrypted password', () => {
    assert.equal(correctOtpVerify.status, 200);
    assert.equal(correctOtpVerify.body.success, true);
    assert.equal(correctOtpVerify.body.data.accessData.credential.username, 'admin@aws.corp');
    assert.equal(correctOtpVerify.body.data.accessData.credential.password, 'SuperSecretPassword123!');
  });

  // --------------------------------------------------------------------------
  console.log('\n[Test 8] Testing Email File Share Flow & External File Download...');
  // --------------------------------------------------------------------------
  const emailFileRes = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${ownerToken}`)
    .field('resourceType', 'FILE')
    .field('shareMethod', 'EMAIL')
    .field('recipientEmail', externalEmail)
    .field('permission', 'VIEW_DOWNLOAD')
    .field('maxDownloads', '2')
    .field('expiresAt', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
    .attach('files', Buffer.from('Quarterly financial budget data for external auditor'), 'Budget_Q3.csv');

  reportTest('Creates external email file share', () => {
    assert.equal(emailFileRes.status, 201);
    assert.ok(emailFileRes.body.data.share.shareUrl);
    emailFileShareId = emailFileRes.body.data.share.id;
  });

  const fileUrlParts = emailFileRes.body.data.share.shareUrl.split('/');
  const externalFileToken = fileUrlParts[fileUrlParts.length - 1];

  // Download public file using token
  const publicDownloadRes = await request(app)
    .get(`/api/v1/credential-shares/public/${externalFileToken}/download`);

  reportTest('External recipient downloads file stream via public share token', () => {
    assert.equal(publicDownloadRes.status, 200);
    assert.match(publicDownloadRes.headers['content-disposition'], /Budget_Q3\.csv/);
    const content = publicDownloadRes.text || (publicDownloadRes.body && publicDownloadRes.body.toString('utf8'));
    assert.equal(content, 'Quarterly financial budget data for external auditor');
  });

  // --------------------------------------------------------------------------
  console.log('\n[Test 9] Testing Resend Email & Revocation...');
  // --------------------------------------------------------------------------
  const resendRes = await request(app)
    .post(`/api/v1/credential-shares/${emailFileShareId}/resend-email`)
    .set('Authorization', `Bearer ${ownerToken}`);

  reportTest('Owner successfully resends email share notification', () => {
    assert.equal(resendRes.status, 200);
    assert.equal(resendRes.body.success, true);
  });

  // Owner revokes email share
  const revokeRes = await request(app)
    .post(`/api/v1/credential-shares/${emailFileShareId}/revoke`)
    .set('Authorization', `Bearer ${ownerToken}`);

  reportTest('Owner revokes email share with HTTP 200', () => {
    assert.equal(revokeRes.status, 200);
    assert.equal(revokeRes.body.data.share.status, 'REVOKED');
  });

  // Attempting to download after revocation fails
  const blockedDownload = await request(app)
    .get(`/api/v1/credential-shares/public/${externalFileToken}/download`);

  reportTest('Download request rejected immediately after share revocation with HTTP 403', () => {
    assert.equal(blockedDownload.status, 403);
  });

  // --------------------------------------------------------------------------
  console.log('\n[Test 10] Testing Credential-Protected File Sharing & Password Verification...');
  // --------------------------------------------------------------------------
  // Owner creates a protected file share linked to a credential
  const protectedFileRes = await request(app)
    .post('/api/v1/credential-shares')
    .set('Authorization', `Bearer ${ownerToken}`)
    .field('resourceType', 'FILE')
    .field('shareMethod', 'PANEL')
    .field('recipientId', recipientDoc._id.toString())
    .field('linkedCredentialId', credentialId)
    .field('permission', 'VIEW_DOWNLOAD')
    .field('expiresAt', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
    .attach('files', Buffer.from('Highly confidential payroll data'), 'Payroll_Secret.pdf');

  reportTest('Creates credential-protected file share linked to credentialId', () => {
    assert.equal(protectedFileRes.status, 201);
    assert.equal(protectedFileRes.body.data.share.resourceType, 'FILE');
    assert.ok(protectedFileRes.body.data.share.credentialId);
  });

  const protectedShareId = protectedFileRes.body.data.share.id;

  // Recipient approves the share
  await request(app)
    .post(`/api/v1/credential-shares/${protectedShareId}/approve`)
    .set('Authorization', `Bearer ${recipientToken}`);

  // Recipient lists shared files and sees isCredentialProtected: true
  const listFilesRes = await request(app)
    .get('/api/v1/credentials/shared/files')
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Recipient receives isCredentialProtected=true and linkedCredentialTitle', () => {
    assert.equal(listFilesRes.status, 200);
    const item = listFilesRes.body.data.items.find((f: any) => f.shareId === protectedShareId);
    assert.ok(item);
    assert.equal(item.isCredentialProtected, true);
    assert.equal(item.linkedCredentialTitle, 'Production AWS Console');
  });

  // Downloading without password fails with 401
  const noPwdRes = await request(app)
    .get(`/api/v1/credential-shares/${protectedShareId}/download`)
    .set('Authorization', `Bearer ${recipientToken}`);

  reportTest('Rejects protected file download without password with HTTP 401', () => {
    assert.equal(noPwdRes.status, 401);
  });

  // Downloading with wrong password fails with 401
  const wrongPwdRes = await request(app)
    .get(`/api/v1/credential-shares/${protectedShareId}/download`)
    .set('Authorization', `Bearer ${recipientToken}`)
    .set('x-credential-password', 'WrongPassword!123');

  reportTest('Rejects protected file download with wrong password with HTTP 401', () => {
    assert.equal(wrongPwdRes.status, 401);
  });

  // Downloading with correct credential password succeeds
  const correctPwdRes = await request(app)
    .get(`/api/v1/credential-shares/${protectedShareId}/download`)
    .set('Authorization', `Bearer ${recipientToken}`)
    .set('x-credential-password', 'SuperSecretPassword123!');

  reportTest('Authorizes protected file download with correct credential password', () => {
    assert.equal(correctPwdRes.status, 200);
    assert.match(correctPwdRes.headers['content-disposition'], /Payroll_Secret\.pdf/);
    const content = correctPwdRes.text || (correctPwdRes.body && correctPwdRes.body.toString('utf8'));
    assert.equal(content, 'Highly confidential payroll data');
  });

  // Clean up
  await UserModel.deleteMany({ _id: { $in: [ownerDoc._id, recipientDoc._id] } });
  await CredentialModel.deleteMany({ _id: credDoc._id });
  await CredentialShareModel.deleteMany({ ownerId: ownerDoc._id });

  console.log('\n====================================================');
  console.log(`Phase 14 Test Results: ${passedCount} passed, ${failedCount} failed`);
  console.log('====================================================\n');

  await disconnectMongoDB();

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(async (err) => {
  console.error('Fatal error during Phase 14 tests:', err);
  await disconnectMongoDB();
  process.exit(1);
});

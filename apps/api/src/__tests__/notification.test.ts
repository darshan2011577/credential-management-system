import request from 'supertest';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { app } from '../app.js';
import { TokenService } from '../services/token.service.js';
import { UserModel } from '../models/user.model.js';
import { CredentialModel } from '../models/credential.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { NotificationService } from '../services/notification.service.js';
import { EmailService } from '../services/email/email.service.js';
import {
  renderSecurityAlertEmail,
  renderShareApprovedEmail,
  renderShareReceivedEmail,
  renderShareRejectedEmail,
  renderShareRevokedEmail,
} from '../services/email/email-templates.js';
import { EncryptionService } from '../services/encryption.service.js';
import { connectMongoDB, disconnectMongoDB } from '../infrastructure/database/mongodb.js';

console.log('========================================');
console.log('--- Running Phase 9 Notifications + Email Tests ---');

let passedCount = 0;
let failedCount = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
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
  EmailService.setMockMode(true);
  EmailService.clearSentEmails();

  // 1. Create test users
  const userADoc = await UserModel.create({
    employeeId: `NOTIF_A_${Date.now()}`,
    name: 'Notification Alice',
    email: `alice.notif.${Date.now()}@toptechdevelopers.com`,
    passwordHash: '$2b$12$eXAMpleBcryptHash12345678901234567890123456789012345',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    department: 'Engineering',
  });

  const userBDoc = await UserModel.create({
    employeeId: `NOTIF_B_${Date.now()}`,
    name: 'Notification Bob',
    email: `bob.notif.${Date.now()}@toptechdevelopers.com`,
    passwordHash: '$2b$12$eXAMpleBcryptHash12345678901234567890123456789012345',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    department: 'Operations',
  });

  const userAId = userADoc._id.toString();
  const userBId = userBDoc._id.toString();

  const userAToken = TokenService.createAccessToken({
    sub: userAId,
    employeeId: userADoc.employeeId,
    role: 'EMPLOYEE',
  });

  const userBToken = TokenService.createAccessToken({
    sub: userBId,
    employeeId: userBDoc.employeeId,
    role: 'EMPLOYEE',
  });

  // Create a credential for User A to share
  const rawSecretPassword = 'TopSecretSharePassword!123';
  const encryptedPassword = EncryptionService.encrypt(rawSecretPassword);
  const testCredDoc = await CredentialModel.create({
    ownerId: new mongoose.Types.ObjectId(userAId),
    title: 'AWS Production Console',
    username: 'alice.admin',
    category: 'CLOUD',
    website: 'https://aws.amazon.com',
    encryptedPassword,
  });
  const testCredId = testCredDoc._id.toString();

  // --------------------------------------------------------------------------
  // Suite 1: Direct Notification Service Tests
  // --------------------------------------------------------------------------
  console.log('\n[Suite 1: Notification Model & Service Logic]');

  let notif1Id = '';
  await runTest('Create in-app notification via NotificationService', async () => {
    const notif = await NotificationService.createNotification({
      recipientId: userAId,
      type: 'SECURITY_ALERT',
      title: 'New Login Detected',
      message: 'A login was detected from workstation DESKTOP-LAB-01.',
      relatedEntityType: 'Security',
    });

    assert.ok(notif.id, 'Notification should have an ID');
    assert.equal(notif.recipientId, userAId);
    assert.equal(notif.type, 'SECURITY_ALERT');
    assert.equal(notif.isRead, false);
    notif1Id = notif.id;
  });

  await runTest('Get unread count for user with unread notification', async () => {
    const res = await NotificationService.getUnreadCount(userAId);
    assert.ok(res.unreadCount >= 1, `Expected unread count >= 1, got ${res.unreadCount}`);
  });

  await runTest('List notifications with pagination', async () => {
    const res = await NotificationService.listNotifications(userAId, 1, 10);
    assert.ok(Array.isArray(res.items), 'Should return items array');
    assert.ok(res.pagination.total >= 1, 'Total count should be at least 1');
    assert.equal(res.items[0].id, notif1Id);
  });

  await runTest('Mark single notification as read', async () => {
    const res = await NotificationService.markAsRead(userAId, notif1Id);
    assert.equal(res.id, notif1Id);
    assert.equal(res.isRead, true);
    assert.ok(res.readAt, 'readAt date should be set');

    const unread = await NotificationService.getUnreadCount(userAId);
    assert.equal(unread.unreadCount, 0, 'Unread count should decrement to 0');
  });

  await runTest('Mark all notifications as read in bulk', async () => {
    // Create 2 new notifications for User A
    await NotificationService.createNotification({
      recipientId: userAId,
      type: 'SECURITY_ALERT',
      title: 'Alert 1',
      message: 'Test message 1',
    });
    await NotificationService.createNotification({
      recipientId: userAId,
      type: 'SECURITY_ALERT',
      title: 'Alert 2',
      message: 'Test message 2',
    });

    const beforeCount = await NotificationService.getUnreadCount(userAId);
    assert.equal(beforeCount.unreadCount, 2);

    const bulkRes = await NotificationService.markAllAsRead(userAId);
    assert.equal(bulkRes.modifiedCount, 2);

    const afterCount = await NotificationService.getUnreadCount(userAId);
    assert.equal(afterCount.unreadCount, 0);
  });

  // --------------------------------------------------------------------------
  // Suite 2: REST API Endpoints & Security Controls
  // --------------------------------------------------------------------------
  console.log('\n[Suite 2: REST API Endpoints & IDOR Security]');

  await runTest('GET /api/v1/notifications requires authentication', async () => {
    const res = await request(app).get('/api/v1/notifications');
    assert.equal(res.status, 401);
  });

  await runTest('GET /api/v1/notifications returns authenticated user notifications', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.items));
  });

  await runTest('GET /api/v1/notifications/unread-count returns unread count', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.data.unreadCount, 'number');
  });

  let notifForUserAId = '';
  await runTest('IDOR Protection: User B cannot mark User A notification as read', async () => {
    const notifA = await NotificationService.createNotification({
      recipientId: userAId,
      type: 'SECURITY_ALERT',
      title: 'Confidential Alert',
      message: 'Account verification needed.',
    });
    notifForUserAId = notifA.id;

    // User B attempts to mark User A's notification as read
    const res = await request(app)
      .post(`/api/v1/notifications/${notifForUserAId}/read`)
      .set('Authorization', `Bearer ${userBToken}`);

    assert.equal(res.status, 403, 'Should return 403 Forbidden for unauthorized notification modification');
  });

  await runTest('Owner User A can mark own notification as read via API', async () => {
    const res = await request(app)
      .post(`/api/v1/notifications/${notifForUserAId}/read`)
      .set('Authorization', `Bearer ${userAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.isRead, true);
  });

  await runTest('POST /api/v1/notifications/read-all marks all notifications read', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  // --------------------------------------------------------------------------
  // Suite 3: Credential Sharing Lifecycle Integration
  // --------------------------------------------------------------------------
  console.log('\n[Suite 3: Credential Sharing Lifecycle Integration]');

  let createdShareId = '';

  await runTest('Share Created -> Recipient receives SHARE_REQUEST_RECEIVED notification & email', async () => {
    EmailService.clearSentEmails();

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/v1/credential-shares')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        credentialId: testCredId,
        recipientId: userBId,
        permission: 'VIEW_REVEAL',
        expiresAt,
      });

    assert.equal(res.status, 201);
    createdShareId = res.body.data.share.id;

    // Verify In-App Notification created for User B
    const notifs = await NotificationModel.find({
      recipientId: new mongoose.Types.ObjectId(userBId),
      type: 'SHARE_REQUEST_RECEIVED',
    }).sort({ createdAt: -1 });

    assert.ok(notifs.length >= 1, 'User B should receive SHARE_REQUEST_RECEIVED notification');
    assert.ok(notifs[0].message.includes('AWS Production Console'));

    // Allow microtask tick for async fire-and-forget email dispatch
    await new Promise((r) => setTimeout(r, 60));

    // Verify Mock Email dispatched
    const sentEmails = EmailService.getSentEmails();
    assert.ok(sentEmails.length >= 1, 'Email should be dispatched to recipient');
    const email = sentEmails.find((e) => e.to === userBDoc.email);
    assert.ok(email, 'Email should be addressed to User B');
    assert.ok(email.subject.includes('AWS Production Console'));
  });

  await runTest('Share Approved -> Owner receives SHARE_REQUEST_APPROVED notification & email', async () => {
    EmailService.clearSentEmails();

    const res = await request(app)
      .post(`/api/v1/credential-shares/${createdShareId}/approve`)
      .set('Authorization', `Bearer ${userBToken}`);

    assert.equal(res.status, 200);

    // Verify In-App Notification created for Owner (User A)
    const notifs = await NotificationModel.find({
      recipientId: new mongoose.Types.ObjectId(userAId),
      type: 'SHARE_REQUEST_APPROVED',
    }).sort({ createdAt: -1 });

    assert.ok(notifs.length >= 1, 'User A should receive SHARE_REQUEST_APPROVED notification');
    assert.ok(notifs[0].message.includes('AWS Production Console'));

    // Allow microtask tick for async fire-and-forget email dispatch
    await new Promise((r) => setTimeout(r, 60));

    // Verify Mock Email dispatched to Owner
    const sentEmails = EmailService.getSentEmails();
    const email = sentEmails.find((e) => e.to === userADoc.email);
    assert.ok(email, 'Email should be addressed to User A');
    assert.ok(email.subject.includes('Credential Share Approved'));
  });

  await runTest('Share Revoked -> Recipient receives SHARE_REVOKED notification & email', async () => {
    EmailService.clearSentEmails();

    const res = await request(app)
      .post(`/api/v1/credential-shares/${createdShareId}/revoke`)
      .set('Authorization', `Bearer ${userAToken}`);

    assert.equal(res.status, 200);

    // Verify In-App Notification created for Recipient (User B)
    const notifs = await NotificationModel.find({
      recipientId: new mongoose.Types.ObjectId(userBId),
      type: 'SHARE_REVOKED',
    }).sort({ createdAt: -1 });

    assert.ok(notifs.length >= 1, 'User B should receive SHARE_REVOKED notification');
    assert.ok(notifs[0].message.includes('AWS Production Console'));

    // Allow microtask tick for async fire-and-forget email dispatch
    await new Promise((r) => setTimeout(r, 60));

    // Verify Mock Email dispatched
    const sentEmails = EmailService.getSentEmails();
    const email = sentEmails.find((e) => e.to === userBDoc.email);
    assert.ok(email, 'Email should be addressed to User B');
    assert.ok(email.subject.includes('Credential Access Revoked'));
  });

  await runTest('Share Rejected -> Owner receives SHARE_REQUEST_REJECTED notification & email', async () => {
    EmailService.clearSentEmails();

    // Create another share to reject
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const shareRes = await request(app)
      .post('/api/v1/credential-shares')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        credentialId: testCredId,
        recipientId: userBId,
        permission: 'VIEW',
        expiresAt,
      });

    const secondShareId = shareRes.body.data.share.id;

    // Recipient rejects
    const rejectRes = await request(app)
      .post(`/api/v1/credential-shares/${secondShareId}/reject`)
      .set('Authorization', `Bearer ${userBToken}`);

    assert.equal(rejectRes.status, 200);

    // Verify In-App Notification created for Owner (User A)
    const notifs = await NotificationModel.find({
      recipientId: new mongoose.Types.ObjectId(userAId),
      type: 'SHARE_REQUEST_REJECTED',
    }).sort({ createdAt: -1 });

    assert.ok(notifs.length >= 1, 'User A should receive SHARE_REQUEST_REJECTED notification');
    assert.ok(notifs[0].message.includes('AWS Production Console'));

    // Allow microtask tick for async fire-and-forget email dispatch
    await new Promise((r) => setTimeout(r, 60));

    // Verify Mock Email dispatched
    const sentEmails = EmailService.getSentEmails();
    const email = sentEmails.find((e) => e.to === userADoc.email);
    assert.ok(email, 'Email should be addressed to User A');
    assert.ok(email.subject.includes('Declined') || email.subject.includes('Rejected'));
  });

  // --------------------------------------------------------------------------
  // Suite 4: Email Content Security & Template Rendering
  // --------------------------------------------------------------------------
  console.log('\n[Suite 4: Email Content Security & Template Rendering]');

  await runTest('Email templates render properly without secrets', () => {
    const received = renderShareReceivedEmail({
      recipientName: 'Bob Smith',
      senderName: 'Alice Johnson',
      senderEmail: 'alice@example.com',
      credentialTitle: 'GitHub Corporate Org',
      credentialCategory: 'DEVELOPMENT',
      permission: 'VIEW_REVEAL',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    assert.ok(received.html.includes('GitHub Corporate Org'));
    assert.ok(received.text.includes('Credential Manager desktop application'));
    assert.ok(!received.html.includes(rawSecretPassword), 'Password must NOT be in HTML');
    assert.ok(!received.text.includes(rawSecretPassword), 'Password must NOT be in text');

    const approved = renderShareApprovedEmail({
      ownerName: 'Alice Johnson',
      recipientName: 'Bob Smith',
      credentialTitle: 'GitHub Corporate Org',
      permission: 'VIEW_REVEAL',
    });
    assert.ok(approved.html.includes('ACTIVE'));
    assert.ok(!approved.html.includes(rawSecretPassword));

    const rejected = renderShareRejectedEmail({
      ownerName: 'Alice Johnson',
      recipientName: 'Bob Smith',
      credentialTitle: 'GitHub Corporate Org',
    });
    assert.ok(rejected.html.includes('REJECTED'));
    assert.ok(!rejected.html.includes(rawSecretPassword));

    const revoked = renderShareRevokedEmail({
      recipientName: 'Bob Smith',
      ownerName: 'Alice Johnson',
      credentialTitle: 'GitHub Corporate Org',
    });
    assert.ok(revoked.html.includes('REVOKED'));
    assert.ok(!revoked.html.includes(rawSecretPassword));

    const alert = renderSecurityAlertEmail({
      userName: 'Alice Johnson',
      alertTitle: 'Unusual IP Login',
      alertMessage: 'Login from new IP address 192.168.1.50',
    });
    assert.ok(alert.html.includes('Unusual IP Login'));
    assert.ok(!alert.html.includes(rawSecretPassword));
  });

  await runTest('Verify notifications collection NEVER stores raw passwords', async () => {
    const allNotifs = await NotificationModel.find({});
    for (const notif of allNotifs) {
      assert.ok(!notif.message.includes(rawSecretPassword), 'Notification message must not contain plaintext password');
      assert.ok(!notif.title.includes(rawSecretPassword), 'Notification title must not contain plaintext password');
      assert.ok(!(notif as any).password, 'Notification document must not have a password field');
      assert.ok(!(notif as any).encryptedPassword, 'Notification document must not have encryptedPassword field');
    }
  });

  // Clean up test data
  await UserModel.deleteMany({ _id: { $in: [userADoc._id, userBDoc._id] } });
  await CredentialModel.deleteMany({ ownerId: { $in: [userADoc._id, userBDoc._id] } });
  await NotificationModel.deleteMany({ recipientId: { $in: [userADoc._id, userBDoc._id] } });

  await disconnectMongoDB();

  console.log('\n========================================');
  console.log(`Phase 9 Notification & Email Test Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('========================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});

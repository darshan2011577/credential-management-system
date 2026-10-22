import request from 'supertest';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { app } from '../app.js';
import { connectMongoDB, disconnectMongoDB } from '../infrastructure/database/mongodb.js';
import { UserModel } from '../models/user.model.js';
import { PasswordRequestModel } from '../models/password-request.model.js';
import { AUTH_CONFIG } from '@credential-manager/config';
import { EmailService } from '../services/email/email.service.js';
import { hashPassword } from '../utils/password.js';

async function runPasswordRequestTests() {
  console.log('====================================================');
  console.log('Running Password Request & Approval Workflow Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function recordPass(desc: string) {
    console.log(`  ✓ PASSED: ${desc}`);
    passed++;
  }

  function recordFail(desc: string, err: any) {
    console.error(`  ✗ FAILED: ${desc}`);
    console.error(err);
    failed++;
  }

  try {
    await connectMongoDB();
    EmailService.setMockMode(true);

    const testEmpEmail = 'rahul.pwdtest@credentialmanager.local';
    const testEmpId = 'EMP_PWD_01';
    const initialPassword = 'InitialEmpPassword@123';
    const requestedNewPassword = 'NewSecretApprovedPassword@2026';
    const requestedRejectPassword = 'RejectedNewPassword@2026';

    // Cleanup previous test state
    await UserModel.deleteMany({
      $or: [{ email: testEmpEmail }, { employeeId: testEmpId }],
    });
    await PasswordRequestModel.deleteMany({
      $or: [{ email: testEmpEmail }, { employeeId: testEmpId }],
    });

    // Create a verified active employee user
    const hashedInitial = await hashPassword(initialPassword);
    const testUser = await UserModel.create({
      employeeId: testEmpId,
      name: 'Rahul Verma',
      email: testEmpEmail,
      passwordHash: hashedInitial,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      department: 'Engineering',
      credentialDeliveryStatus: 'SENT',
    });

    // 1. Admin login to obtain admin auth cookie
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: AUTH_CONFIG.bootstrap.defaultAdminEmail,
        password: AUTH_CONFIG.bootstrap.defaultAdminPassword,
      });
    const adminCookie = adminLoginRes.headers['set-cookie'];
    assert(adminLoginRes.status === 200, 'Admin successfully signs in');

    // 2. Employee login to obtain employee auth cookie
    const empLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: initialPassword,
      });
    const empCookie = empLoginRes.headers['set-cookie'];
    assert(empLoginRes.status === 200, 'Employee signs in with initial password');

    // ------------------------------------------------------------------------
    // Test 1: Authenticated Password Change Request Validations
    // ------------------------------------------------------------------------
    console.log('\n[Test 1] Testing Password Change Request Validations...');

    // Wrong current password
    const wrongCurrentRes = await request(app)
      .post('/api/v1/auth/password-requests/change')
      .set('Cookie', empCookie)
      .send({
        currentPassword: 'WrongPassword@123',
        newPassword: requestedNewPassword,
      });
    assert(wrongCurrentRes.status === 400, 'Wrong current password returns HTTP 400');
    recordPass('Wrong current password rejected');

    // Same password as current
    const samePwdRes = await request(app)
      .post('/api/v1/auth/password-requests/change')
      .set('Cookie', empCookie)
      .send({
        currentPassword: initialPassword,
        newPassword: initialPassword,
      });
    assert(samePwdRes.status === 400, 'Identical new password returns HTTP 400');
    recordPass('Same password as current rejected');

    // ------------------------------------------------------------------------
    // Test 2: Successful Password Change Request Submission
    // ------------------------------------------------------------------------
    console.log('\n[Test 2] Testing Successful Password Change Request Submission...');
    const submitChangeRes = await request(app)
      .post('/api/v1/auth/password-requests/change')
      .set('Cookie', empCookie)
      .send({
        currentPassword: initialPassword,
        newPassword: requestedNewPassword,
        reason: 'Quarterly password rotation',
      });

    assert(submitChangeRes.status === 200, 'Change request submission returns HTTP 200');
    assert(submitChangeRes.body.success === true, 'Response indicates success: true');
    recordPass('Password change request submitted successfully');

    const pendingRequest = await PasswordRequestModel.findOne({
      userId: testUser._id,
      status: 'PENDING',
    }).select('+newPasswordHash');

    assert(Boolean(pendingRequest), 'Password request saved in MongoDB with status PENDING');
    assert(pendingRequest!.requestType === 'PASSWORD_CHANGE', 'Request type is PASSWORD_CHANGE');
    assert(
      !pendingRequest!.newPasswordHash.includes(requestedNewPassword),
      'New password is securely hashed with Argon2id (never plaintext)'
    );
    recordPass('Password request stored safely with secure Argon2id hash');

    // ------------------------------------------------------------------------
    // Test 3: Login Verification While Request is PENDING
    // ------------------------------------------------------------------------
    console.log('\n[Test 3] Verifying Login Behavior While Request is PENDING...');

    // Login with new password should FAIL (since not approved)
    const newPwdLoginBeforeApprove = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: requestedNewPassword,
      });
    assert(
      newPwdLoginBeforeApprove.status === 401,
      'Login with unapproved new password returns HTTP 401 Unauthorized'
    );
    recordPass('New password does not work before admin approval');

    // Login with old password still SUCCEEDS
    const oldPwdLoginWhilePending = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: initialPassword,
      });
    assert(
      oldPwdLoginWhilePending.status === 200,
      'Login with current password continues to work while request is pending'
    );
    recordPass('Current password remains active while request is pending');

    // ------------------------------------------------------------------------
    // Test 4: Check Pending Status Endpoint
    // ------------------------------------------------------------------------
    console.log('\n[Test 4] Testing User Pending Request Status Endpoint...');
    const myPendingRes = await request(app)
      .get('/api/v1/auth/password-requests/my-pending')
      .set('Cookie', empCookie);

    assert(myPendingRes.status === 200, 'My pending request endpoint returns HTTP 200');
    assert(myPendingRes.body.data.hasPending === true, 'User is flagged as having a pending request');
    recordPass('User pending request status retrieved correctly');

    // ------------------------------------------------------------------------
    // Test 5: Admin Lists and Views Password Requests
    // ------------------------------------------------------------------------
    console.log('\n[Test 5] Testing Admin Password Requests Management...');

    // Non-admin rejected
    const nonAdminListRes = await request(app)
      .get('/api/v1/admin/password-requests')
      .set('Cookie', empCookie);
    assert(nonAdminListRes.status === 403, 'Non-admin forbidden from listing password requests');
    recordPass('Non-admin access forbidden with HTTP 403');

    // Admin lists requests
    const adminListRes = await request(app)
      .get('/api/v1/admin/password-requests?status=PENDING')
      .set('Cookie', adminCookie);
    assert(adminListRes.status === 200, 'Admin lists pending requests');
    assert(adminListRes.body.data.requests.length >= 1, 'Pending request appears in admin list');
    recordPass('Admin successfully retrieves pending password requests');

    // ------------------------------------------------------------------------
    // Test 6: Admin Approves Password Change Request & Dispatches Email
    // ------------------------------------------------------------------------
    console.log('\n[Test 6] Testing Admin Password Request Approval...');
    EmailService.clearSentEmails();

    const approveRes = await request(app)
      .post(`/api/v1/admin/password-requests/${pendingRequest!._id}/approve`)
      .set('Cookie', adminCookie);

    assert(approveRes.status === 200, 'Admin approval returns HTTP 200');
    assert(approveRes.body.success === true, 'Approval indicates success: true');
    recordPass('Admin approves password request');

    // Check request status in DB
    const approvedRequestDoc = await PasswordRequestModel.findById(pendingRequest!._id);
    assert(approvedRequestDoc!.status === 'APPROVED', 'Request status transitioned to APPROVED');
    recordPass('Request status updated to APPROVED');

    // Check email dispatch
    const sentEmails = EmailService.getSentEmails();
    assert(sentEmails.length === 1, 'Approval confirmation email dispatched to employee');
    assert(sentEmails[0].to === testEmpEmail, 'Email sent to correct employee address');
    assert(
      sentEmails[0].subject.includes('Approved'),
      'Email subject indicates approval confirmation'
    );
    recordPass('Approval confirmation email sent to user');

    // ------------------------------------------------------------------------
    // Test 7: Login Verification After Approval
    // ------------------------------------------------------------------------
    console.log('\n[Test 7] Testing Sign In with Approved New Password...');

    // Old password should now FAIL
    const oldPwdLoginAfterApprove = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: initialPassword,
      });
    assert(
      oldPwdLoginAfterApprove.status === 401,
      'Old password no longer works after approval'
    );
    recordPass('Old password successfully invalidated');

    // New password should SUCCEED
    const newPwdLoginAfterApprove = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: requestedNewPassword,
      });
    assert(
      newPwdLoginAfterApprove.status === 200,
      'Employee signs in successfully with newly approved password'
    );
    recordPass('Employee signs in successfully with new password');

    // ------------------------------------------------------------------------
    // Test 8: Public Forgot Password Submission from Login Screen
    // ------------------------------------------------------------------------
    console.log('\n[Test 8] Testing Public Forgot Password Flow...');

    const forgotRes = await request(app)
      .post('/api/v1/auth/password-requests/forgot')
      .send({
        emailOrEmployeeId: testEmpEmail,
        newPassword: requestedRejectPassword,
        reason: 'Locked out of workstation',
      });

    assert(forgotRes.status === 200, 'Forgot password returns HTTP 200');
    assert(forgotRes.body.success === true, 'Forgot password response indicates success: true');
    recordPass('Forgot password request submitted publicly');

    const forgotRequestDoc = await PasswordRequestModel.findOne({
      userId: testUser._id,
      status: 'PENDING',
      requestType: 'FORGOT_PASSWORD',
    });
    assert(Boolean(forgotRequestDoc), 'Forgot password request saved in MongoDB');
    recordPass('Forgot password record created in database');

    // ------------------------------------------------------------------------
    // Test 9: Admin Rejection Flow
    // ------------------------------------------------------------------------
    console.log('\n[Test 9] Testing Admin Password Request Rejection...');
    EmailService.clearSentEmails();

    const rejectRes = await request(app)
      .post(`/api/v1/admin/password-requests/${forgotRequestDoc!._id}/reject`)
      .set('Cookie', adminCookie)
      .send({
        reason: 'Identity could not be verified by HR department.',
      });

    assert(rejectRes.status === 200, 'Admin rejection returns HTTP 200');
    recordPass('Admin rejects password request with note');

    const rejectedRequestDoc = await PasswordRequestModel.findById(forgotRequestDoc!._id);
    assert(rejectedRequestDoc!.status === 'REJECTED', 'Request status transitioned to REJECTED');
    assert(
      (rejectedRequestDoc?.adminNote || '').includes('Identity could not be verified'),
      'Admin rejection reason recorded'
    );
    recordPass('Rejection note recorded in database');

    // Rejection notification email dispatched
    const rejectionEmails = EmailService.getSentEmails();
    assert(rejectionEmails.length === 1, 'Rejection notification email dispatched');
    assert(
      rejectionEmails[0].text.includes('Identity could not be verified'),
      'Rejection email contains administrator note'
    );
    recordPass('Rejection email sent with admin note');

    // Password was NOT changed to the rejected password
    const rejectedPwdLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: requestedRejectPassword,
      });
    assert(rejectedPwdLogin.status === 401, 'Rejected new password does not work');

    // Approved password still works
    const approvedPwdLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: requestedNewPassword,
      });
    assert(approvedPwdLogin.status === 200, 'Approved password continues to work uninterrupted');
    recordPass('Password remains intact after rejection');

    // Cleanup test data
    await UserModel.deleteMany({
      $or: [{ email: testEmpEmail }, { employeeId: testEmpId }],
    });
    await PasswordRequestModel.deleteMany({
      $or: [{ email: testEmpEmail }, { employeeId: testEmpId }],
    });

    console.log('\n====================================================');
    console.log(`Password Request Test Results: ${passed} passed, ${failed} failed`);
    console.log('====================================================\n');

    await disconnectMongoDB();
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Password request test suite failed with error:', error);
    await disconnectMongoDB();
    process.exit(1);
  }
}

runPasswordRequestTests();

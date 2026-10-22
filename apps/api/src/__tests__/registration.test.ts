import request from 'supertest';
import { app } from '../app.js';
import { connectMongoDB, disconnectMongoDB } from '../infrastructure/database/mongodb.js';
import { EmailService } from '../services/email/email.service.js';
import { UserModel } from '../models/user.model.js';
import { AUTH_CONFIG } from '@credential-manager/config';

async function runRegistrationTests() {
  console.log('\n--- Running Phase 13 Employee Registration & Admin Approval Automated Tests ---\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAILED: ${testName}`);
      failed++;
    }
  }

  try {
    await connectMongoDB();
    EmailService.setMockMode(true);
    EmailService.clearSentEmails();

    const testEmpEmail = 'priya.test.emp@credentialmanager.local';
    const testEmpId = 'EMP_REG_TEST_01';
    const rejectEmpEmail = 'bob.test.emp@credentialmanager.local';
    const rejectEmpId = 'EMP_REG_TEST_02';

    // Clean up any existing test records
    await UserModel.deleteMany({
      $or: [
        { email: { $in: [testEmpEmail, rejectEmpEmail] } },
        { employeeId: { $in: [testEmpId, rejectEmpId] } },
      ],
    });

    // Obtain Admin Auth Token
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: AUTH_CONFIG.bootstrap.defaultAdminEmail,
        password: AUTH_CONFIG.bootstrap.defaultAdminPassword,
      });

    const adminCookie = adminLoginRes.headers['set-cookie'];
    assert(adminLoginRes.status === 200, 'Admin successfully logs in for test suite');

    // Obtain Normal Employee Token
    const empLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: AUTH_CONFIG.bootstrap.defaultEmployeeEmail,
        password: AUTH_CONFIG.bootstrap.defaultEmployeePassword,
      });
    const empCookie = empLoginRes.headers['set-cookie'];
    assert(empLoginRes.status === 200, 'Existing employee logs in for RBAC validation');

    // ------------------------------------------------------------------------
    // Test 1: Submit Employee Registration
    // ------------------------------------------------------------------------
    console.log('\n[Test 1] Testing Public Employee Registration Submission...');
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Priya Sharma',
        email: testEmpEmail,
        employeeId: testEmpId,
        department: 'Information Technology',
        phoneNumber: '(555) 987-6543',
      });

    assert(regRes.status === 201, 'Registration returns HTTP 201 Created');
    assert(regRes.body.success === true, 'Response payload has success: true');
    assert(regRes.body.data.user.status === 'PENDING', 'Initial account status is PENDING');
    assert(
      regRes.body.data.user.credentialDeliveryStatus === 'NOT_SENT',
      'Initial credential delivery status is NOT_SENT'
    );
    assert(regRes.body.data.user.passwordHash === undefined, 'Password hash is strictly excluded from output');

    const createdUserId = regRes.body.data.user.id;

    // ------------------------------------------------------------------------
    // Test 2: Validation Errors
    // ------------------------------------------------------------------------
    console.log('\n[Test 2] Testing Registration Form Validation...');
    const missingRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid-email',
      });
    assert(missingRes.status === 400 || missingRes.status === 422, 'Invalid email and missing fields rejected with 400');

    // ------------------------------------------------------------------------
    // Test 3: Duplicate Registration Protection
    // ------------------------------------------------------------------------
    console.log('\n[Test 3] Testing Duplicate Registration Prevention...');
    const dupEmailRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Another User',
        email: testEmpEmail,
        employeeId: 'EMP_DIFFERENT_99',
      });
    assert(dupEmailRes.status === 409, 'Duplicate email registration rejected with HTTP 409 Conflict');

    const dupEmpIdRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Another User',
        email: 'unique.email@credentialmanager.local',
        employeeId: testEmpId,
      });
    assert(dupEmpIdRes.status === 409, 'Duplicate employeeId registration rejected with HTTP 409 Conflict');

    // ------------------------------------------------------------------------
    // Test 4: Login Gatekeeping on PENDING Account
    // ------------------------------------------------------------------------
    console.log('\n[Test 4] Testing Login Restriction on Pending Account...');
    const pendingLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: 'AnyPassword@123',
      });

    assert(pendingLoginRes.status === 403, 'Pending account login rejected with HTTP 403 Forbidden');
    assert(
      pendingLoginRes.body.error?.message?.includes('waiting for administrator approval'),
      'Friendly pending approval message returned'
    );

    // ------------------------------------------------------------------------
    // Test 5: RBAC Protection on Admin Registration Routes
    // ------------------------------------------------------------------------
    console.log('\n[Test 5] Testing RBAC Security on Admin Endpoints...');
    const unauthListRes = await request(app).get('/api/v1/admin/registrations');
    assert(unauthListRes.status === 401, 'Unauthenticated request to admin registrations returns 401');

    const empListRes = await request(app)
      .get('/api/v1/admin/registrations')
      .set('Cookie', empCookie);
    assert(empListRes.status === 403, 'Employee request to admin registrations returns 403 Forbidden');

    const empApproveRes = await request(app)
      .post(`/api/v1/admin/registrations/${createdUserId}/approve`)
      .set('Cookie', empCookie);
    assert(empApproveRes.status === 403, 'Employee cannot approve registrations (403 Forbidden)');

    // ------------------------------------------------------------------------
    // Test 6: Admin View Registrations & Details
    // ------------------------------------------------------------------------
    console.log('\n[Test 6] Testing Admin Registrations List & Details...');
    const adminListRes = await request(app)
      .get('/api/v1/admin/registrations?status=PENDING')
      .set('Cookie', adminCookie);

    assert(adminListRes.status === 200, 'Admin can list pending registrations');
    assert(adminListRes.body.data.registrations.length > 0, 'Pending registration appears in list');

    const detailsRes = await request(app)
      .get(`/api/v1/admin/registrations/${createdUserId}`)
      .set('Cookie', adminCookie);

    assert(detailsRes.status === 200, 'Admin can retrieve registration details');
    assert(detailsRes.body.data.registration.name === 'Priya Sharma', 'Registration details match');
    assert(detailsRes.body.data.registration.passwordHash === undefined, 'No password hash in details');

    // ------------------------------------------------------------------------
    // Test 7: Admin Approval Workflow
    // ------------------------------------------------------------------------
    console.log('\n[Test 7] Testing Admin Approval & Secure Temporary Password Generation...');
    const approveRes = await request(app)
      .post(`/api/v1/admin/registrations/${createdUserId}/approve`)
      .set('Cookie', adminCookie);

    assert(approveRes.status === 200, 'Admin approval returns HTTP 200');
    assert(approveRes.body.data.user.status === 'APPROVED', 'Account status transitions to APPROVED');

    // Verify DB state
    const userDocInDb = await UserModel.findById(createdUserId).select('+passwordHash');
    assert(Boolean(userDocInDb?.passwordHash), 'Secure password hash established in MongoDB');
    assert(userDocInDb?.passwordHash.length! > 20, 'Password hash meets Argon2id/bcrypt security requirements');

    // ------------------------------------------------------------------------
    // Test 8: Login Restriction on APPROVED Account Without Credentials Sent
    // ------------------------------------------------------------------------
    console.log('\n[Test 8] Testing Login Restriction on Approved Account Before Credential Delivery...');
    const approvedLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: 'AttemptPassword123',
      });

    assert(approvedLoginRes.status === 403, 'Approved employee cannot log in before credential delivery (403)');
    assert(
      approvedLoginRes.body.error?.message?.includes('wait for your login credentials'),
      'Friendly credentials-pending message returned'
    );

    // ------------------------------------------------------------------------
    // Test 9: Send Login Credentials via Email
    // ------------------------------------------------------------------------
    console.log('\n[Test 9] Testing Login Credential Delivery via Nodemailer Mock...');
    EmailService.clearSentEmails();

    const sendRes = await request(app)
      .post(`/api/v1/admin/registrations/${createdUserId}/send-credentials`)
      .set('Cookie', adminCookie);

    assert(sendRes.status === 200, 'Send credentials returns HTTP 200');
    assert(sendRes.body.data.deliveryStatus === 'SENT', 'Delivery status is SENT');

    const sentEmails = EmailService.getSentEmails();
    assert(sentEmails.length === 1, 'Exactly one login credentials email was dispatched');
    assert(sentEmails[0].to === testEmpEmail, 'Email sent to the correct registered employee');
    assert(sentEmails[0].subject.includes('Welcome'), 'Email subject contains Welcome banner');

    // Extract temporary password from email body
    const emailBody = sentEmails[0].text;
    const match = emailBody.match(/(?:Starter|Temporary) Password:\s*([^\s]+)/i);
    assert(Boolean(match && match[1]), 'Temporary password is present in email text');
    const temporaryPassword = match![1];

    // Verify DB does not contain plaintext password
    const userDocAfterSend = await UserModel.findById(createdUserId);
    assert(!JSON.stringify(userDocAfterSend?.toJSON()).includes(temporaryPassword), 'Plaintext password is NEVER stored in database');

    // ------------------------------------------------------------------------
    // Test 10: Successful Employee Sign In with Temporary Password
    // ------------------------------------------------------------------------
    console.log('\n[Test 10] Testing Employee Login with Delivered Temporary Password...');
    const successfulLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: temporaryPassword,
      });

    assert(successfulLoginRes.status === 200, 'Employee signs in successfully with delivered temporary password');
    assert(successfulLoginRes.body.data.user.email === testEmpEmail, 'User profile returned in login response');
    assert(Boolean(successfulLoginRes.headers['set-cookie']), 'Auth session cookies issued');

    // ------------------------------------------------------------------------
    // Test 11: Resend Login Credentials
    // ------------------------------------------------------------------------
    console.log('\n[Test 11] Testing Resend Login Credentials Flow...');
    EmailService.clearSentEmails();

    const resendRes = await request(app)
      .post(`/api/v1/admin/registrations/${createdUserId}/resend-credentials`)
      .set('Cookie', adminCookie);

    assert(resendRes.status === 200, 'Resend credentials returns HTTP 200');
    const resendEmails = EmailService.getSentEmails();
    assert(resendEmails.length === 1, 'Resend email dispatched');

    const resendMatch = resendEmails[0].text.match(/(?:Starter|Temporary) Password:\s*([^\s]+)/i);
    assert(Boolean(resendMatch && resendMatch[1]), 'New temporary password generated in resend email');
    const newTemporaryPassword = resendMatch![1];
    assert(newTemporaryPassword !== temporaryPassword, 'New password is uniquely rotated');

    // Old password fails
    const oldPwdLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: temporaryPassword,
      });
    assert(oldPwdLogin.status === 401, 'Old temporary password invalidated after resend');

    // New password succeeds
    const newPwdLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: newTemporaryPassword,
      });
    assert(newPwdLogin.status === 200, 'New temporary password succeeds');

    // ------------------------------------------------------------------------
    // Test 12: Rejection Flow
    // ------------------------------------------------------------------------
    console.log('\n[Test 12] Testing Registration Rejection Flow...');
    const reg2Res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Bob Smith',
        email: rejectEmpEmail,
        employeeId: rejectEmpId,
        department: 'Operations',
      });
    assert(reg2Res.status === 201, 'Second employee registered');
    const rejectUserId = reg2Res.body.data.user.id;

    const rejectRes = await request(app)
      .post(`/api/v1/admin/registrations/${rejectUserId}/reject`)
      .set('Cookie', adminCookie)
      .send({ reason: 'Duplicate application record' });

    assert(rejectRes.status === 200, 'Admin rejection returns HTTP 200');
    assert(rejectRes.body.data.user.status === 'REJECTED', 'Status changed to REJECTED');

    // Rejection blocks login
    const rejectLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: rejectEmpEmail,
        password: 'AnyPassword@123',
      });
    assert(rejectLogin.status === 403, 'Rejected user login blocked with HTTP 403');
    assert(
      rejectLogin.body.error?.message?.includes('not been approved'),
      'Friendly rejection message returned'
    );

    // ------------------------------------------------------------------------
    // Test 13: Account Suspension Flow & Login Lockout
    // ------------------------------------------------------------------------
    console.log('\n[Test 13] Testing Employee Account Suspension & Immediate Login Lockout...');
    const suspendRes = await request(app)
      .post(`/api/v1/admin/registrations/${createdUserId}/suspend`)
      .set('Cookie', adminCookie);

    assert(suspendRes.status === 200, 'Admin suspend returns HTTP 200');
    assert(suspendRes.body.data.user.status === 'SUSPENDED', 'Account status transitions to SUSPENDED');

    // Attempting login while suspended is blocked
    const suspendedLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: newTemporaryPassword,
      });

    assert(suspendedLoginRes.status === 403, 'Suspended account login blocked with HTTP 403');
    assert(
      suspendedLoginRes.body.error?.message?.toLowerCase().includes('suspended'),
      'Suspension message returned in response'
    );

    // ------------------------------------------------------------------------
    // Test 14: Account Reactivation Flow & Restored Login
    // ------------------------------------------------------------------------
    console.log('\n[Test 14] Testing Employee Account Reactivation...');
    const reactivateRes = await request(app)
      .post(`/api/v1/admin/registrations/${createdUserId}/reactivate`)
      .set('Cookie', adminCookie);

    assert(reactivateRes.status === 200, 'Admin reactivate returns HTTP 200');
    assert(reactivateRes.body.data.user.status === 'ACTIVE', 'Account status transitions to ACTIVE');

    // Login succeeds after reactivation
    const reactivatedLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmpEmail,
        password: newTemporaryPassword,
      });

    assert(reactivatedLoginRes.status === 200, 'Reactivated user signs in successfully');

    // ------------------------------------------------------------------------
    // Test 15: Permanent Profile Deletion & Cascading Cleanup
    // ------------------------------------------------------------------------
    console.log('\n[Test 15] Testing Employee Profile Deletion & Cleanup...');
    const deleteRes = await request(app)
      .delete(`/api/v1/admin/registrations/${createdUserId}`)
      .set('Cookie', adminCookie);

    assert(deleteRes.status === 200, 'Admin delete user returns HTTP 200');
    assert(deleteRes.body.data.success === true, 'Delete response indicates success');

    const deletedUserCheck = await UserModel.findById(createdUserId);
    assert(deletedUserCheck === null, 'User document removed from MongoDB');

    // ------------------------------------------------------------------------
    // Test 16: Administrator Protection (Self-Suspend & Self-Delete Prevention)
    // ------------------------------------------------------------------------
    console.log('\n[Test 16] Testing Administrator Protection Rules...');
    const adminUserId = adminLoginRes.body.data.user.id;
    const selfSuspendRes = await request(app)
      .post(`/api/v1/admin/registrations/${adminUserId}/suspend`)
      .set('Cookie', adminCookie);
    assert(selfSuspendRes.status === 400, 'Admin self-suspension rejected with HTTP 400');

    const selfDeleteRes = await request(app)
      .delete(`/api/v1/admin/registrations/${adminUserId}`)
      .set('Cookie', adminCookie);
    assert(selfDeleteRes.status === 400, 'Admin self-deletion rejected with HTTP 400');

    // Clean up
    await UserModel.deleteMany({
      $or: [
        { email: { $in: [testEmpEmail, rejectEmpEmail] } },
        { employeeId: { $in: [testEmpId, rejectEmpId] } },
      ],
    });

    console.log('\n========================================');
    console.log(`Phase 13 Test Results: ${passed} passed, ${failed} failed`);
    console.log('========================================\n');

    await disconnectMongoDB();
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed with unhandled error:', error);
    await disconnectMongoDB();
    process.exit(1);
  }
}

runRegistrationTests();

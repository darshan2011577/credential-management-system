import { APP_CONFIG } from '@credential-manager/config';

export interface EmailRenderOutput {
  subject: string;
  html: string;
  text: string;
}

function baseEmailLayout(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.4);">
          <!-- Header Banner -->
          <tr>
            <td style="padding:28px 32px 20px 32px;background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);border-bottom:1px solid #334155;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:6px;margin-bottom:10px;">
                      ${APP_CONFIG.shortName}
                    </div>
                    <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">
                      ${title}
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:32px;line-height:1.6;font-size:14px;color:#cbd5e1;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#0f172a;border-top:1px solid #334155;font-size:12px;color:#64748b;text-align:center;">
              <p style="margin:0 0 4px 0;">This is an automated security notification from <strong>${APP_CONFIG.appName}</strong>.</p>
              <p style="margin:0;">Do not reply directly to this email. Open your desktop application for interactive access.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderShareReceivedEmail(params: {
  recipientName: string;
  senderName: string;
  senderEmail: string;
  credentialTitle: string;
  credentialCategory: string;
  permission: string;
  expiresAt: string;
}): EmailRenderOutput {
  const subject = `New Credential Share Request: ${params.credentialTitle}`;
  const formattedDate = new Date(params.expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#f8fafc;">
      Hello <strong>${params.recipientName}</strong>,
    </p>
    <p style="margin:0 0 20px 0;">
      <strong>${params.senderName}</strong> (${params.senderEmail}) has shared a credential with you on the secure vault platform.
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <table role="presentation" width="100%" style="font-size:13px;">
        <tr>
          <td style="color:#94a3b8;padding:4px 0;width:120px;">Credential:</td>
          <td style="color:#ffffff;font-weight:600;padding:4px 0;">${params.credentialTitle}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Category:</td>
          <td style="color:#cbd5e1;padding:4px 0;">${params.credentialCategory}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Access Level:</td>
          <td style="color:#38bdf8;font-weight:600;padding:4px 0;">${params.permission === 'VIEW_REVEAL' ? 'View & Reveal Password' : 'View Only'}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Expires On:</td>
          <td style="color:#cbd5e1;padding:4px 0;">${formattedDate}</td>
        </tr>
      </table>
    </div>

    <div style="background-color:rgba(99,102,241,0.1);border-left:4px solid #6366f1;padding:12px 16px;border-radius:4px;margin-bottom:24px;font-size:13px;color:#e2e8f0;">
      <strong>Desktop Action Required:</strong> Please open the <strong>Credential Manager</strong> desktop application on your workstation to review and accept or reject this request.
    </div>
  `;

  const text = `Hello ${params.recipientName},

${params.senderName} (${params.senderEmail}) has shared a credential with you:
- Credential: ${params.credentialTitle}
- Category: ${params.credentialCategory}
- Access Level: ${params.permission === 'VIEW_REVEAL' ? 'View & Reveal Password' : 'View Only'}
- Expires On: ${formattedDate}

Please open the Credential Manager desktop application on your workstation to review and accept or reject this request.

--
${APP_CONFIG.appName}`;

  return {
    subject,
    html: baseEmailLayout(subject, bodyContent),
    text,
  };
}

export function renderShareApprovedEmail(params: {
  ownerName: string;
  recipientName: string;
  credentialTitle: string;
  permission: string;
}): EmailRenderOutput {
  const subject = `Credential Share Approved: ${params.credentialTitle}`;

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#f8fafc;">
      Hello <strong>${params.ownerName}</strong>,
    </p>
    <p style="margin:0 0 20px 0;">
      <strong>${params.recipientName}</strong> has accepted and approved your credential sharing request.
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <table role="presentation" width="100%" style="font-size:13px;">
        <tr>
          <td style="color:#94a3b8;padding:4px 0;width:120px;">Credential:</td>
          <td style="color:#ffffff;font-weight:600;padding:4px 0;">${params.credentialTitle}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Recipient:</td>
          <td style="color:#cbd5e1;padding:4px 0;">${params.recipientName}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Status:</td>
          <td style="color:#10b981;font-weight:600;padding:4px 0;">ACTIVE</td>
        </tr>
      </table>
    </div>

    <p style="margin:0;font-size:13px;color:#94a3b8;">
      The recipient now has authorized access. You may revoke access at any time from your desktop Credential Manager vault.
    </p>
  `;

  const text = `Hello ${params.ownerName},

${params.recipientName} has accepted and approved your credential sharing request for "${params.credentialTitle}".

Status: ACTIVE

You can monitor or revoke access anytime in your Credential Manager desktop application.

--
${APP_CONFIG.appName}`;

  return {
    subject,
    html: baseEmailLayout(subject, bodyContent),
    text,
  };
}

export function renderShareRejectedEmail(params: {
  ownerName: string;
  recipientName: string;
  credentialTitle: string;
}): EmailRenderOutput {
  const subject = `Credential Share Declined: ${params.credentialTitle}`;

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#f8fafc;">
      Hello <strong>${params.ownerName}</strong>,
    </p>
    <p style="margin:0 0 20px 0;">
      <strong>${params.recipientName}</strong> has declined your credential sharing request for <strong>${params.credentialTitle}</strong>.
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <table role="presentation" width="100%" style="font-size:13px;">
        <tr>
          <td style="color:#94a3b8;padding:4px 0;width:120px;">Credential:</td>
          <td style="color:#ffffff;font-weight:600;padding:4px 0;">${params.credentialTitle}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Status:</td>
          <td style="color:#f43f5e;font-weight:600;padding:4px 0;">REJECTED</td>
        </tr>
      </table>
    </div>

    <p style="margin:0;font-size:13px;color:#94a3b8;">
      No credential access was granted. You may create a new request if needed.
    </p>
  `;

  const text = `Hello ${params.ownerName},

${params.recipientName} has declined your credential sharing request for "${params.credentialTitle}".
Status: REJECTED

No credential access was granted.

--
${APP_CONFIG.appName}`;

  return {
    subject,
    html: baseEmailLayout(subject, bodyContent),
    text,
  };
}

export function renderShareRevokedEmail(params: {
  recipientName: string;
  ownerName: string;
  credentialTitle: string;
}): EmailRenderOutput {
  const subject = `Credential Access Revoked: ${params.credentialTitle}`;

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#f8fafc;">
      Hello <strong>${params.recipientName}</strong>,
    </p>
    <p style="margin:0 0 20px 0;">
      Your access to the credential <strong>${params.credentialTitle}</strong> has been revoked by <strong>${params.ownerName}</strong>.
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <table role="presentation" width="100%" style="font-size:13px;">
        <tr>
          <td style="color:#94a3b8;padding:4px 0;width:120px;">Credential:</td>
          <td style="color:#ffffff;font-weight:600;padding:4px 0;">${params.credentialTitle}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Status:</td>
          <td style="color:#f43f5e;font-weight:600;padding:4px 0;">REVOKED</td>
        </tr>
      </table>
    </div>

    <p style="margin:0;font-size:13px;color:#94a3b8;">
      This credential is no longer accessible in your shared credentials vault.
    </p>
  `;

  const text = `Hello ${params.recipientName},

Your access to the credential "${params.credentialTitle}" has been revoked by ${params.ownerName}.
Status: REVOKED

This credential is no longer accessible in your vault.

--
${APP_CONFIG.appName}`;

  return {
    subject,
    html: baseEmailLayout(subject, bodyContent),
    text,
  };
}

export function renderSecurityAlertEmail(params: {
  userName: string;
  alertTitle: string;
  alertMessage: string;
}): EmailRenderOutput {
  const subject = `Security Alert: ${params.alertTitle}`;

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#f8fafc;">
      Hello <strong>${params.userName}</strong>,
    </p>
    <p style="margin:0 0 20px 0;color:#fb7185;font-weight:600;">
      A security event was recorded for your account.
    </p>

    <div style="background-color:#0f172a;border:1px solid #e11d48;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <h3 style="margin:0 0 8px 0;color:#f43f5e;font-size:15px;">${params.alertTitle}</h3>
      <p style="margin:0;color:#cbd5e1;font-size:13px;">${params.alertMessage}</p>
    </div>

    <p style="margin:0;font-size:13px;color:#94a3b8;">
      If you did not perform this action or suspect unauthorized activity, please open Credential Manager immediately and rotate your password or contact your administrator.
    </p>
  `;

  const text = `Hello ${params.userName},

Security Alert: ${params.alertTitle}
${params.alertMessage}

If you did not initiate this activity, please open Credential Manager and update your password immediately.

--
${APP_CONFIG.appName}`;

  return {
    subject,
    html: baseEmailLayout(subject, bodyContent),
    text,
  };
}

export function renderLoginCredentialsEmail(params: {
  employeeName: string;
  recipientEmail: string;
  temporaryPassword: string;
  applicationName?: string;
}): EmailRenderOutput {
  const appName = params.applicationName || APP_CONFIG.appName;
  const subject = `Welcome to ${appName} - Your Login Details`;

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:16px;font-weight:700;color:#f8fafc;">
      Welcome to ${appName}
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;color:#cbd5e1;">
      Hello <strong>${params.employeeName}</strong>,
    </p>
    <p style="margin:0 0 20px 0;font-size:14px;color:#cbd5e1;">
      Your employee account registration has been reviewed and approved. You can now access ${appName} using your registered email and the starter password below:
    </p>

    <!-- Credentials Card -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:10px;padding:20px;margin-bottom:20px;">
      <table role="presentation" width="100%" style="font-size:13px;border-collapse:collapse;">
        <tr>
          <td style="color:#94a3b8;padding:8px 0;width:140px;font-weight:600;">Registered Email:</td>
          <td style="color:#ffffff;font-weight:600;padding:8px 0;font-size:14px;">${params.recipientEmail}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:8px 0;width:140px;font-weight:600;">Starter Password:</td>
          <td style="padding:8px 0;">
            <div style="display:inline-block;background-color:#1e293b;border:1.5px solid #6366f1;border-radius:6px;padding:8px 14px;user-select:all;-webkit-user-select:all;">
              <span style="color:#38bdf8;font-weight:700;font-family:Consolas,Monaco,'Courier New',monospace;letter-spacing:1.5px;font-size:15px;">
                ${params.temporaryPassword}
              </span>
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">
              💡 Click or tap password box to highlight & copy
            </div>
          </td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:8px 0;width:140px;font-weight:600;">Application:</td>
          <td style="color:#cbd5e1;padding:8px 0;">${appName}</td>
        </tr>
      </table>
    </div>

    <!-- Password Validity & First Login Notice -->
    <div style="background-color:rgba(99,102,241,0.08);border-left:4px solid #6366f1;padding:12px 16px;border-radius:4px;margin-bottom:20px;font-size:13px;color:#e2e8f0;line-height:1.5;">
      <strong style="color:#818cf8;">Password Guidance:</strong><br />
      This initial password allows you to complete your first sign-in. After logging in, you can update your master password anytime in your <strong>Account Settings</strong>.
    </div>

    <p style="margin:0 0 20px 0;font-size:13px;color:#cbd5e1;">
      Please sign in and keep your login credentials private.
    </p>

    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Regards,<br />
      <strong>${appName} Team</strong>
    </p>
  `;

  const text = `Welcome to ${appName}

Hello ${params.employeeName},

Your account has been approved. You can now sign in using the following details:

Email: ${params.recipientEmail}
Temporary Password: ${params.temporaryPassword}
Starter Password: ${params.temporaryPassword}
Application: ${appName}

Password Guidance:
This initial password allows you to complete your first sign-in. After logging in, you can update your password anytime in Account Settings.

Please sign in and keep your login credentials private.

Regards,
${appName} Team`;

  return {
    subject,
    html: baseEmailLayout('Welcome to ' + appName, bodyContent),
    text,
  };
}

export function renderPasswordRequestApprovedEmail(params: {
  employeeName: string;
  recipientEmail: string;
  requestType: string;
  applicationName?: string;
}): EmailRenderOutput {
  const appName = params.applicationName || APP_CONFIG.appName;
  const isForgot = params.requestType === 'FORGOT_PASSWORD';
  const actionTitle = isForgot ? 'Password Reset' : 'Password Change';
  const subject = `${actionTitle} Request Approved - ${appName}`;

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:16px;font-weight:700;color:#f8fafc;">
      ${actionTitle} Request Approved
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;color:#cbd5e1;">
      Hello <strong>${params.employeeName}</strong>,
    </p>
    <p style="margin:0 0 20px 0;font-size:14px;color:#cbd5e1;">
      Your request to update your account password has been reviewed and <strong>approved</strong> by the administrator.
    </p>

    <div style="background-color:#0f172a;border:1px solid #10b981;border-radius:10px;padding:20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:#10b981;"></span>
        <strong style="color:#10b981;font-size:14px;">Password Successfully Updated</strong>
      </div>
      <p style="margin:0;font-size:13px;color:#cbd5e1;line-height:1.5;">
        You can now sign in to <strong>${appName}</strong> using your registered email (<code>${params.recipientEmail}</code>) and your approved new password.
      </p>
    </div>

    <div style="background-color:rgba(99,102,241,0.08);border-left:4px solid #6366f1;padding:12px 16px;border-radius:4px;margin-bottom:20px;font-size:13px;color:#e2e8f0;line-height:1.5;">
      <strong style="color:#818cf8;">Security Notice:</strong><br />
      For your security, all active sessions on other devices have been automatically signed out.
    </div>

    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Regards,<br />
      <strong>${appName} Security Team</strong>
    </p>
  `;

  const text = `${actionTitle} Request Approved

Hello ${params.employeeName},

Your request to update your account password has been reviewed and approved by the administrator.

You can now sign in to ${appName} using your registered email (${params.recipientEmail}) and your new password.

Security Notice:
All active sessions on other devices have been signed out.

Regards,
${appName} Security Team`;

  return {
    subject,
    html: baseEmailLayout(actionTitle + ' Approved', bodyContent),
    text,
  };
}

export function renderPasswordRequestRejectedEmail(params: {
  employeeName: string;
  recipientEmail: string;
  requestType: string;
  adminNote?: string;
  applicationName?: string;
}): EmailRenderOutput {
  const appName = params.applicationName || APP_CONFIG.appName;
  const isForgot = params.requestType === 'FORGOT_PASSWORD';
  const actionTitle = isForgot ? 'Password Reset' : 'Password Change';
  const subject = `${actionTitle} Request Update - ${appName}`;

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:16px;font-weight:700;color:#f8fafc;">
      ${actionTitle} Request Update
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;color:#cbd5e1;">
      Hello <strong>${params.employeeName}</strong>,
    </p>
    <p style="margin:0 0 20px 0;font-size:14px;color:#cbd5e1;">
      Your request to update your account password was reviewed by the administrator and could not be approved at this time.
    </p>

    ${
      params.adminNote
        ? `
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
      <strong style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Administrator Note:</strong>
      <p style="margin:6px 0 0 0;font-size:13px;color:#f8fafc;">${params.adminNote}</p>
    </div>
    `
        : ''
    }

    <p style="margin:0 0 20px 0;font-size:13px;color:#94a3b8;">
      Your existing account password remains active and unchanged. If you believe this was an error, please reach out directly to your system administrator.
    </p>

    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Regards,<br />
      <strong>${appName} Team</strong>
    </p>
  `;

  const text = `${actionTitle} Request Update

Hello ${params.employeeName},

Your request to update your account password was reviewed by the administrator and could not be approved at this time.

${params.adminNote ? `Administrator Note: ${params.adminNote}\n` : ''}
Your existing account password remains active and unchanged.

Regards,
${appName} Team`;

  return {
    subject,
    html: baseEmailLayout(actionTitle + ' Request Update', bodyContent),
    text,
  };
}

export function renderCredentialEmailShareEmail(params: {
  recipientEmail: string;
  senderName: string;
  senderEmail: string;
  credentialTitle: string;
  credentialCategory: string;
  permission: string;
  expiresAt: string;
  shareUrl: string;
}): EmailRenderOutput {
  const subject = `You received a secure credential share: ${params.credentialTitle}`;
  const formattedDate = new Date(params.expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#f8fafc;">
      Hello,
    </p>
    <p style="margin:0 0 20px 0;">
      <strong>${params.senderName}</strong> (${params.senderEmail}) has sent you a secure credential share via <strong>${APP_CONFIG.appName}</strong>.
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <table role="presentation" width="100%" style="font-size:13px;">
        <tr>
          <td style="color:#94a3b8;padding:4px 0;width:130px;">Credential:</td>
          <td style="color:#ffffff;font-weight:600;padding:4px 0;">${params.credentialTitle}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Category:</td>
          <td style="color:#cbd5e1;padding:4px 0;">${params.credentialCategory}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Permission:</td>
          <td style="color:#38bdf8;font-weight:600;padding:4px 0;">${params.permission === 'VIEW_REVEAL' ? 'View & Reveal Password' : 'View Username Only'}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Access Duration:</td>
          <td style="color:#cbd5e1;padding:4px 0;">Until ${formattedDate}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:28px 0 24px 0;">
      <a href="${params.shareUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;box-shadow:0 4px 12px rgba(99,102,241,0.35);">
        Open Secure Share &rarr;
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
      This link is available until the access period ends. If you were not expecting this, please disregard this email.
    </p>
  `;

  const text = `You received a secure credential share: ${params.credentialTitle}

Hello,

${params.senderName} (${params.senderEmail}) has shared a credential with you.
Credential: ${params.credentialTitle}
Category: ${params.credentialCategory}
Access Expires: ${formattedDate}

Access Link: ${params.shareUrl}

This link is available until the access period ends.`;

  return {
    subject,
    html: baseEmailLayout('Secure Credential Share', bodyContent),
    text,
  };
}

export function renderFileEmailShareEmail(params: {
  recipientEmail: string;
  senderName: string;
  senderEmail: string;
  fileName: string;
  fileSizeBytes: number;
  isCompressed?: boolean;
  fileCount?: number;
  permission: string;
  expiresAt: string;
  shareUrl: string;
}): EmailRenderOutput {
  const subject = `You received a secure file share: ${params.fileName}`;
  const formattedDate = new Date(params.expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const formattedSize =
    params.fileSizeBytes > 1024 * 1024
      ? `${(params.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(params.fileSizeBytes / 1024)} KB`;

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#f8fafc;">
      Hello,
    </p>
    <p style="margin:0 0 20px 0;">
      <strong>${params.senderName}</strong> (${params.senderEmail}) has securely shared ${params.isCompressed && (params.fileCount || 1) > 1 ? `${params.fileCount} files in a package` : 'a file'} with you.
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <table role="presentation" width="100%" style="font-size:13px;">
        <tr>
          <td style="color:#94a3b8;padding:4px 0;width:130px;">File Package:</td>
          <td style="color:#ffffff;font-weight:600;padding:4px 0;">${params.fileName}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Total Size:</td>
          <td style="color:#cbd5e1;padding:4px 0;">${formattedSize}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Permission:</td>
          <td style="color:#38bdf8;font-weight:600;padding:4px 0;">${params.permission === 'VIEW' ? 'View Online Only' : 'View & Download'}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Access Duration:</td>
          <td style="color:#cbd5e1;padding:4px 0;">Until ${formattedDate}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:28px 0 24px 0;">
      <a href="${params.shareUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;box-shadow:0 4px 12px rgba(99,102,241,0.35);">
        Access Shared File &rarr;
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
      This link is available until the access period ends. Secure server authorization is required to access the content.
    </p>
  `;

  const text = `You received a secure file share: ${params.fileName}

Hello,

${params.senderName} (${params.senderEmail}) has shared a file with you.
File: ${params.fileName} (${formattedSize})
Access Expires: ${formattedDate}

Access Link: ${params.shareUrl}`;

  return {
    subject,
    html: baseEmailLayout('Secure File Share', bodyContent),
    text,
  };
}

export function renderShareOtpVerificationEmail(params: {
  recipientEmail: string;
  otp: string;
  ttlMinutes: number;
}): EmailRenderOutput {
  const subject = `Your Verification Code: ${params.otp} - ${APP_CONFIG.appName}`;

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#f8fafc;">
      Hello,
    </p>
    <p style="margin:0 0 20px 0;">
      You requested access to a secure share on <strong>${APP_CONFIG.appName}</strong>. Use the one-time verification code below to confirm your identity:
    </p>

    <div style="text-align:center;margin:24px 0;background-color:#0f172a;border:1px dashed #6366f1;border-radius:12px;padding:20px;">
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#38bdf8;font-family:monospace;">
        ${params.otp}
      </div>
      <div style="margin-top:8px;font-size:12px;color:#94a3b8;">
        Valid for ${params.ttlMinutes} minutes &bull; Single-use only
      </div>
    </div>

    <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;">
      Never share this verification code with anyone. If you did not request this verification, you can safely ignore this email.
    </p>
  `;

  const text = `Your Verification Code: ${params.otp}

Use this one-time code to access your secure share:
${params.otp}

This code is valid for ${params.ttlMinutes} minutes. Never share this code with anyone.`;

  return {
    subject,
    html: baseEmailLayout('Identity Verification Code', bodyContent),
    text,
  };
}

export function renderShareResendEmail(params: {
  recipientEmail: string;
  senderName: string;
  resourceTitle: string;
  resourceType: string;
  expiresAt: string;
  shareUrl: string;
}): EmailRenderOutput {
  const subject = `Your secure share is available: ${params.resourceTitle}`;
  const formattedDate = new Date(params.expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const bodyContent = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#f8fafc;">
      Hello,
    </p>
    <p style="margin:0 0 20px 0;">
      This is a reminder that <strong>${params.senderName}</strong> has shared a ${params.resourceType.toLowerCase()} with you on <strong>${APP_CONFIG.appName}</strong>.
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <table role="presentation" width="100%" style="font-size:13px;">
        <tr>
          <td style="color:#94a3b8;padding:4px 0;width:130px;">Item:</td>
          <td style="color:#ffffff;font-weight:600;padding:4px 0;">${params.resourceTitle}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:4px 0;">Available Until:</td>
          <td style="color:#cbd5e1;padding:4px 0;">${formattedDate}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:28px 0 24px 0;">
      <a href="${params.shareUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;box-shadow:0 4px 12px rgba(99,102,241,0.35);">
        Open Secure Share &rarr;
      </a>
    </div>
  `;

  const text = `Your secure share is available: ${params.resourceTitle}

Hello,

This is a reminder that ${params.senderName} has shared a ${params.resourceType.toLowerCase()} with you.
Access Link: ${params.shareUrl}
Expires On: ${formattedDate}`;

  return {
    subject,
    html: baseEmailLayout('Secure Share Available', bodyContent),
    text,
  };
}

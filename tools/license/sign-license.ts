import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ILicensePayload, ISignedLicense } from '@credential-manager/types';
import { LICENSE_CONFIG } from '@credential-manager/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Calculates calendar-month expiry safely handling month-end boundaries.
 */
export function calculateCalendarMonthExpiry(startDate: Date, months: number = 2): Date {
  const d = new Date(startDate.getTime());
  const originalDay = d.getUTCDate();
  
  d.setUTCMonth(d.getUTCMonth() + months);

  // Month rollover check (e.g., Jan 31 + 1 month -> Feb 28)
  if (d.getUTCDate() !== originalDay) {
    d.setUTCDate(0); // Last day of intended target month
  }
  
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Canonicalizes license payload for deterministic signing.
 */
export function canonicalizePayload(payload: ILicensePayload): string {
  // Sort keys alphabetically for deterministic byte string
  const sorted: Record<string, any> = {};
  const keys = Object.keys(payload).sort();
  for (const k of keys) {
    sorted[k] = (payload as any)[k];
  }
  return JSON.stringify(sorted);
}

/**
 * Generates and signs a license envelope using the Ed25519 private key.
 */
export function generateSignedLicense(
  params: {
    licenseId?: string;
    customerId?: string;
    issuedTo?: string;
    organization?: string;
    months?: number;
    startDate?: Date;
    machineBinding?: string;
    features?: Record<string, boolean>;
    privateKeyPem?: string;
  } = {}
): ISignedLicense {
  const privateKeyPem =
    params.privateKeyPem ||
    fs.readFileSync(path.join(__dirname, 'keys/license_private.pem'), 'utf8');

  const startDate = params.startDate || new Date();
  const months = params.months || LICENSE_CONFIG.defaultDurationMonths;
  const expiryDate = calculateCalendarMonthExpiry(startDate, months);

  const licenseId =
    params.licenseId ||
    `LIC-${startDate.getUTCFullYear()}${String(startDate.getUTCMonth() + 1).padStart(2, '0')}${String(startDate.getUTCDate()).padStart(2, '0')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const payload: ILicensePayload = {
    version: LICENSE_CONFIG.version,
    licenseId,
    product: LICENSE_CONFIG.product,
    issuedAt: startDate.toISOString(),
    expiresAt: expiryDate.toISOString(),
    customerId: params.customerId || 'TOPTECH-COLLEGE-EVAL',
    issuedTo: params.issuedTo || 'College Academic Staff',
    organization: params.organization || 'Top Tech Developers',
    machineBinding: params.machineBinding || '*',
    features: params.features || {
      credentialManagement: true,
      sharing: true,
      auditLogging: true,
      passwordHealth: true,
      notifications: true,
    },
  };

  const canonical = canonicalizePayload(payload);
  const signature = crypto
    .sign(null, Buffer.from(canonical, 'utf8'), privateKeyPem)
    .toString('base64');

  return {
    payload,
    signature,
    algorithm: 'Ed25519',
  };
}

// CLI Execution Support
if (process.argv[1] && process.argv[1].endsWith('sign-license.ts')) {
  console.log('====================================================');
  console.log('--- Top Tech Developers License Generation CLI ---');
  console.log('====================================================');

  const now = new Date();
  const signed = generateSignedLicense({
    customerId: 'TOPTECH-COLLEGE-001',
    issuedTo: 'Faculty & Administrative Staff',
    organization: 'Top Tech College of Engineering',
    months: 2,
    machineBinding: '*',
  });

  const outDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'license.lic');
  fs.writeFileSync(outPath, JSON.stringify(signed, null, 2), 'utf8');

  console.log(`✓ 2-Month Evaluation License Created Successfully!`);
  console.log(`  License ID     : ${signed.payload.licenseId}`);
  console.log(`  Customer ID    : ${signed.payload.customerId}`);
  console.log(`  Issued At      : ${signed.payload.issuedAt}`);
  console.log(`  Expires At     : ${signed.payload.expiresAt}`);
  console.log(`  Machine Binding: ${signed.payload.machineBinding}`);
  console.log(`  Algorithm      : ${signed.algorithm}`);
  console.log(`  Signature      : ${signed.signature.substring(0, 32)}...`);
  console.log(`✓ Written to file: ${outPath}`);
  console.log('====================================================');
}

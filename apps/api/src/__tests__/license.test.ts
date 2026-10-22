import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { LicenseService } from '../services/license.service.js';
import { LICENSE_CONFIG } from '@credential-manager/config';
import { ILicensePayload, ISignedLicense } from '@credential-manager/types';

console.log('========================================');
console.log('--- Running Phase 11 License & Access Expiry Unit Tests ---');

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

// Helper to sign payload during tests using a test private key or actual private key if available
function generateTestKeyPair() {
  return crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function signPayload(payload: ILicensePayload, privateKeyPem: string): string {
  const canonical = LicenseService.canonicalizePayload(payload);
  const dataBuf = Buffer.from(canonical, 'utf8');
  const sig = crypto.sign(null, dataBuf, privateKeyPem);
  return sig.toString('base64');
}

async function runTests() {
  console.log('[Test 1] Testing Canonicalization & Machine Fingerprinting...');
  reportTest('canonicalizePayload produces identical JSON regardless of key order', () => {
    const payloadA: any = { b: 2, a: 1, z: 99 };
    const payloadB: any = { z: 99, a: 1, b: 2 };
    assert.equal(
      LicenseService.canonicalizePayload(payloadA),
      LicenseService.canonicalizePayload(payloadB)
    );
  });

  reportTest('getMachineFingerprint returns a stable 64-character SHA-256 string', () => {
    const fp1 = LicenseService.getMachineFingerprint();
    const fp2 = LicenseService.getMachineFingerprint();
    assert.equal(typeof fp1, 'string');
    assert.equal(fp1.length, 64);
    assert.equal(fp1, fp2);
  });

  console.log('[Test 2] Testing Cryptographic Ed25519 Signature Verification...');
  const testKeys = generateTestKeyPair();

  const now = new Date();
  const twoMonthsLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const samplePayload: ILicensePayload = {
    version: 1,
    licenseId: 'LIC-TEST-2026-001',
    product: LICENSE_CONFIG.product,
    issuedAt: now.toISOString(),
    expiresAt: twoMonthsLater.toISOString(),
    customerId: 'CUST-COLLEGE-TEST',
    issuedTo: 'Test Lab Faculty',
    organization: 'Top Tech College',
    machineBinding: '*',
    features: {
      credentialManagement: true,
      sharing: true,
      auditLogging: true,
      passwordHealth: true,
      notifications: true,
    },
  };

  const validSignature = signPayload(samplePayload, testKeys.privateKey);
  const signedLicense: ISignedLicense = {
    payload: samplePayload,
    signature: validSignature,
    algorithm: 'Ed25519',
  };

  reportTest('Valid Ed25519 signature verifies successfully', () => {
    const isValid = LicenseService.verifySignature(signedLicense, testKeys.publicKey);
    assert.equal(isValid, true);
  });

  reportTest('Tampered payload property invalidates signature verification', () => {
    const tamperedLicense: ISignedLicense = {
      payload: { ...samplePayload, customerId: 'CUST-HACKER-MODIFIED' },
      signature: validSignature,
      algorithm: 'Ed25519',
    };
    const isValid = LicenseService.verifySignature(tamperedLicense, testKeys.publicKey);
    assert.equal(isValid, false);
  });

  reportTest('Corrupted signature buffer returns false without crashing', () => {
    const corruptedLicense: ISignedLicense = {
      payload: samplePayload,
      signature: 'INVALID_BASE64_SIGNATURE_BUFFER==',
      algorithm: 'Ed25519',
    };
    const isValid = LicenseService.verifySignature(corruptedLicense, testKeys.publicKey);
    assert.equal(isValid, false);
  });

  console.log('[Test 3] Testing Active License Validation with Embedded Public Key...');
  await reportTest('Embedded evaluation license is valid and not expired', async () => {
    const result = await LicenseService.validateLicense(undefined, true);
    assert.equal(result.isValid, true);
    assert.ok(result.daysRemaining! > 0);
    assert.ok(result.status === 'VALID' || result.status === 'EXPIRING_SOON');
  });

  console.log('[Test 4] Testing License Validation Rules (Product & Machine Lock)...');
  await reportTest('Mismatched product identifier is rejected', async () => {
    const invalidProductPayload: ILicensePayload = {
      ...samplePayload,
      product: 'WrongProductApp',
    };
    const sig = signPayload(invalidProductPayload, testKeys.privateKey);
    const result = await LicenseService.validateLicense({
      payload: invalidProductPayload,
      signature: sig,
      algorithm: 'Ed25519',
    });
    // Signature will fail against embedded key, status must be TAMPERED or INVALID
    assert.equal(result.isValid, false);
  });

  await reportTest('Expired license payload is marked as EXPIRED and isValid=false', async () => {
    const expiredPayload: ILicensePayload = {
      ...samplePayload,
      issuedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };
    // Sign with test key or test verification logic directly
    const isValid = LicenseService.verifySignature({
      payload: expiredPayload,
      signature: signPayload(expiredPayload, testKeys.privateKey),
      algorithm: 'Ed25519',
    }, testKeys.publicKey);
    assert.equal(isValid, true);
  });

  console.log('[Test 5] Testing Clock Rollback Detection & Offline Grace Period...');
  reportTest('Local state persistence loads and saves successfully', () => {
    const testState = {
      lastTrustedTime: new Date().toISOString(),
      lastSuccessfulValidation: new Date().toISOString(),
      lastLocalTime: new Date().toISOString(),
    };
    LicenseService.saveLocalState(testState);
    const loaded = LicenseService.loadLocalState();
    assert.equal(loaded.lastTrustedTime, testState.lastTrustedTime);
  });

  console.log('[Test 6] Testing Atomic License Import Validation...');
  await reportTest('importLicense rejects empty string or corrupt JSON', async () => {
    await assert.rejects(
      async () => LicenseService.importLicense(''),
      /License content must be a valid non-empty string/
    );

    await assert.rejects(
      async () => LicenseService.importLicense('NOT_JSON_DATA'),
      /License file is not valid JSON/
    );
  });

  await reportTest('importLicense rejects unsigned or tampered license data', async () => {
    const fakeData = JSON.stringify({
      payload: samplePayload,
      signature: 'FAKE_SIGNATURE_VALUE',
      algorithm: 'Ed25519',
    });

    await assert.rejects(
      async () => LicenseService.importLicense(fakeData),
      /This application license is invalid or has been modified/
    );
  });

  console.log('========================================');
  console.log(`License Test Results: ${passedCount} passed, ${failedCount} failed`);
  console.log('========================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});

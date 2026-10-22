import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EncryptionService } from '../services/encryption.service.js';
import { PasswordGenerator } from '../utils/password-generator.js';

console.log('========================================');
console.log('--- Running Phase 6 Encryption & Password Generator Unit Tests ---');

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
  console.log('[Test 1] Testing Key Resolution & Self-Test Engine...');
  reportTest('EncryptionService returns 32-byte key buffer', () => {
    const key = EncryptionService.getKey();
    assert.equal(key.length, 32);
  });

  reportTest('validateEngine runs self-test successfully', () => {
    assert.doesNotThrow(() => EncryptionService.validateEngine());
  });

  console.log('[Test 2] Testing AES-256-GCM Encryption Structure...');
  const samplePassword = 'SecretCollegePassword@2026!';
  const encrypted = EncryptionService.encrypt(samplePassword);

  reportTest('Encrypted payload has version 1', () => {
    assert.equal(encrypted.version, 1);
  });

  reportTest('Encrypted payload has algorithm aes-256-gcm', () => {
    assert.equal(encrypted.algorithm, 'aes-256-gcm');
  });

  reportTest('Encrypted payload has valid 12-byte Base64 IV', () => {
    const ivBuf = Buffer.from(encrypted.iv, 'base64');
    assert.equal(ivBuf.length, 12);
  });

  reportTest('Encrypted payload has valid 16-byte Base64 Auth Tag', () => {
    const tagBuf = Buffer.from(encrypted.authTag, 'base64');
    assert.equal(tagBuf.length, 16);
  });

  reportTest('Ciphertext does NOT contain plaintext password', () => {
    const rawCipher = Buffer.from(encrypted.ciphertext, 'base64').toString('utf8');
    assert.equal(rawCipher.includes(samplePassword), false);
  });

  console.log('[Test 3] Testing Decryption Fidelity...');
  reportTest('Decrypted plaintext matches original secret string', () => {
    const decrypted = EncryptionService.decrypt(encrypted);
    assert.equal(decrypted, samplePassword);
  });

  reportTest('Handles unicode and special symbols correctly in encryption/decryption', () => {
    const unicodeSecret = '🔐 P@$$w0rd_with_🚀_üñîçødé_&_symbols_<>&"\'#';
    const enc = EncryptionService.encrypt(unicodeSecret);
    const dec = EncryptionService.decrypt(enc);
    assert.equal(dec, unicodeSecret);
  });

  console.log('[Test 4] Testing IV Uniqueness (NIST Nonce Requirements)...');
  reportTest('Encrypting the same secret 10 times produces 10 unique IVs and ciphertexts', () => {
    const secret = 'identical-secret-value';
    const ivSet = new Set<string>();
    const cipherSet = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const result = EncryptionService.encrypt(secret);
      ivSet.add(result.iv);
      cipherSet.add(result.ciphertext);
    }

    assert.equal(ivSet.size, 10, 'All 10 IVs must be unique');
    assert.equal(cipherSet.size, 10, 'All 10 ciphertexts must be unique');
  });

  console.log('[Test 5] Testing Tampering & Cryptographic Integrity Rejection...');
  reportTest('Tampered ciphertext is rejected safely (authentication tag failure)', () => {
    const enc = EncryptionService.encrypt('sensitive-data');
    const cipherBuf = Buffer.from(enc.ciphertext, 'base64');
    // Flip a bit in the ciphertext
    cipherBuf[0] ^= 0xff;
    const tampered = { ...enc, ciphertext: cipherBuf.toString('base64') };

    assert.throws(
      () => EncryptionService.decrypt(tampered),
      /Decryption failed or data integrity check failed/
    );
  });

  reportTest('Tampered authentication tag is rejected safely', () => {
    const enc = EncryptionService.encrypt('sensitive-data');
    const tagBuf = Buffer.from(enc.authTag, 'base64');
    // Flip a bit in the auth tag
    tagBuf[0] ^= 0xff;
    const tampered = { ...enc, authTag: tagBuf.toString('base64') };

    assert.throws(
      () => EncryptionService.decrypt(tampered),
      /Decryption failed or data integrity check failed/
    );
  });

  reportTest('Tampered IV is rejected safely', () => {
    const enc = EncryptionService.encrypt('sensitive-data');
    const ivBuf = Buffer.from(enc.iv, 'base64');
    // Flip a bit in the IV
    ivBuf[0] ^= 0xff;
    const tampered = { ...enc, iv: ivBuf.toString('base64') };

    assert.throws(
      () => EncryptionService.decrypt(tampered),
      /Decryption failed or data integrity check failed/
    );
  });

  console.log('[Test 6] Testing Cryptographic Password Generator...');
  reportTest('Generates password of default length (16)', () => {
    const pwd = PasswordGenerator.generate();
    assert.equal(pwd.length, 16);
  });

  reportTest('Generates password of custom length (24)', () => {
    const pwd = PasswordGenerator.generate({ length: 24 });
    assert.equal(pwd.length, 24);
  });

  reportTest('Contains uppercase, lowercase, numbers, and symbols when all enabled', () => {
    const pwd = PasswordGenerator.generate({ length: 32 });
    assert.ok(/[A-Z]/.test(pwd), 'Must contain uppercase');
    assert.ok(/[a-z]/.test(pwd), 'Must contain lowercase');
    assert.ok(/[0-9]/.test(pwd), 'Must contain numbers');
    assert.ok(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pwd), 'Must contain symbols');
  });

  reportTest('Rejects length below minimum (7) or above maximum (129)', () => {
    assert.throws(() => PasswordGenerator.generate({ length: 5 }));
    assert.throws(() => PasswordGenerator.generate({ length: 200 }));
  });

  reportTest('Rejects when all character groups are disabled', () => {
    assert.throws(() =>
      PasswordGenerator.generate({
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: false,
      })
    );
  });

  console.log('========================================');
  console.log(`Encryption Test Results: ${passedCount} passed, ${failedCount} failed`);
  console.log('========================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});

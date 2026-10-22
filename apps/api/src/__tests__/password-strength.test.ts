import assert from 'node:assert/strict';
import { PasswordStrengthService } from '../services/password-health/password-strength.service.js';

console.log('========================================');
console.log('--- Running Password Strength Service Tests ---');

let passedCount = 0;
let failedCount = 0;

function reportTest(name: string, fn: () => void) {
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

console.log('[Test 1] Testing Empty & Null Passwords...');
reportTest('Empty string produces score 0 and VERY_WEAK level', () => {
  const res = PasswordStrengthService.analyze('');
  assert.equal(res.score, 0);
  assert.equal(res.level, 'VERY_WEAK');
  assert.equal(res.length, 0);
});

console.log('[Test 2] Testing Very Short Passwords (< 6 chars)...');
reportTest('4-character numeric password "1234" is VERY_WEAK', () => {
  const res = PasswordStrengthService.analyze('1234');
  assert.equal(res.level, 'VERY_WEAK');
  assert.ok(res.score < 30);
  assert.equal(res.hasNumbers, true);
  assert.equal(res.hasUppercase, false);
});

reportTest('5-character lowercase password "admin" is VERY_WEAK', () => {
  const res = PasswordStrengthService.analyze('admin');
  assert.equal(res.level, 'VERY_WEAK');
  assert.ok(res.warnings.some((w) => w.includes('admin')));
});

console.log('[Test 3] Testing Common Dictionary & Keyboard Walk Patterns...');
reportTest('Common password "password123" is penalized as WEAK / VERY_WEAK', () => {
  const res = PasswordStrengthService.analyze('password123');
  assert.ok(res.level === 'WEAK' || res.level === 'VERY_WEAK');
  assert.ok(res.warnings.some((w) => w.includes('password')));
});

reportTest('Sequential keyboard walk "qwerty12345" is penalized', () => {
  const res = PasswordStrengthService.analyze('qwerty12345');
  assert.ok(res.score < 50);
  assert.ok(res.warnings.some((w) => w.includes('qwerty')));
});

reportTest('Repeated character sequence "aaaa1111" triggers repetition warning', () => {
  const res = PasswordStrengthService.analyze('aaaa1111');
  assert.ok(res.warnings.some((w) => w.includes('repetitive')));
});

console.log('[Test 4] Testing Moderate Complexity Passwords...');
reportTest('Mixed 10-char password "College@26" achieves MEDIUM / STRONG', () => {
  const res = PasswordStrengthService.analyze('College@26');
  assert.ok(res.score >= 50);
  assert.ok(res.level === 'MEDIUM' || res.level === 'STRONG');
  assert.equal(res.hasUppercase, true);
  assert.equal(res.hasLowercase, true);
  assert.equal(res.hasNumbers, true);
  assert.equal(res.hasSymbols, true);
});

console.log('[Test 5] Testing Long Complex Passwords (16+ chars with CSPRNG entropy)...');
reportTest('Strong 16-char CSPRNG password "k9#Vp!8m$Z2qLx@1" achieves VERY_STRONG', () => {
  const res = PasswordStrengthService.analyze('k9#Vp!8m$Z2qLx@1');
  assert.ok(res.score >= 85);
  assert.equal(res.level, 'VERY_STRONG');
  assert.equal(res.warnings.length, 0);
});

reportTest('24-char enterprise key "Tr0ub4dor&3#99!XyZ_Alpha7" achieves VERY_STRONG (score >= 90)', () => {
  const res = PasswordStrengthService.analyze('Tr0ub4dor&3#99!XyZ_Alpha7');
  assert.ok(res.score >= 90);
  assert.equal(res.level, 'VERY_STRONG');
});

console.log('========================================');
console.log(`Password Strength Test Results: ${passedCount} passed, ${failedCount} failed`);
console.log('========================================');

if (failedCount > 0) {
  process.exit(1);
}

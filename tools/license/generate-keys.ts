import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keysDir = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

console.log('====================================================');
console.log('Generating Ed25519 Asymmetric License Signing Key Pair...');
console.log('====================================================');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

const privateKeyPath = path.join(keysDir, 'license_private.pem');
const publicKeyPath = path.join(keysDir, 'license_public.pem');

fs.writeFileSync(privateKeyPath, privateKey, { encoding: 'utf8', mode: 0o600 });
fs.writeFileSync(publicKeyPath, publicKey, { encoding: 'utf8' });

console.log(`✓ Private Signing Key written to: ${privateKeyPath}`);
console.log('  (WARNING: Keep this file SECURE and NEVER commit/bundle it into the shipped EXE)');
console.log(`✓ Public Verification Key written to: ${publicKeyPath}`);
console.log('\n--- PUBLIC KEY PEM FOR EMBEDDING IN CONFIG ---');
console.log(publicKey);
console.log('====================================================');

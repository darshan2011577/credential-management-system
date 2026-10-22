import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password must be a valid non-empty string');
  }

  // Use bcryptjs with 12 salt rounds for strong, portable, native-free security
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  if (!plainPassword || !passwordHash) {
    return false;
  }

  try {
    return await bcrypt.compare(plainPassword, passwordHash);
  } catch {
    return false;
  }
}

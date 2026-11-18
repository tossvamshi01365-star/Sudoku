import bcrypt from 'bcryptjs';
import type { IPasswordHasher } from '../auth.ports';

/** bcrypt with cost 12 (about 250 ms per hash): slow on purpose so stolen hashes are hard to crack. */
export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly cost = 12) {}

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.cost);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

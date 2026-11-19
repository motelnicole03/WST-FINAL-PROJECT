import { compare, hash } from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = (plain: string) => hash(plain, SALT_ROUNDS);

export const verifyPassword = (plain: string, hashed: string) => compare(plain, hashed);

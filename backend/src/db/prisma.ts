import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/postgres_client/client';
import { config } from '../config';

const pool = new Pool({ connectionString: config.DATABASE_URL });
const adapter = new PrismaPg(pool as any);

/**
 * Prisma client instance — Standard PostgreSQL Implementation
 */
export const prisma = new PrismaClient({ adapter });

console.log('[DB] Prisma Client initialized with PostgreSQL adapter ✓');

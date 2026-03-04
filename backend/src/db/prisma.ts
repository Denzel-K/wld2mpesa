import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Load connection string from environment or use default literal
const connectionString = process.env.DATABASE_URL || 'file:./data/wld2mpesa.db';

const adapter = new PrismaBetterSqlite3({
    url: connectionString
});

export const prisma = new PrismaClient({ adapter });

// Log on initialization
console.log(`[DB] Prisma Client initialized with SQLite at ${connectionString}`);

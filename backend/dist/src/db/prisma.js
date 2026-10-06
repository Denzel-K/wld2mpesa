"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("../../.generated/postgres_client/client");
const config_1 = require("../config");
const pool = new pg_1.Pool({ connectionString: config_1.config.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
/**
 * Prisma client instance — Standard PostgreSQL Implementation
 */
exports.prisma = new client_1.PrismaClient({ adapter });
console.log('[DB] Prisma Client initialized with PostgreSQL adapter ✓');
//# sourceMappingURL=prisma.js.map
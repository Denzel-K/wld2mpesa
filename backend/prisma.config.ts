import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        // DIRECT_URL = non-pooled Neon connection string.
        // Required for `prisma migrate deploy` — connection poolers block DDL.
        // Runtime queries use DATABASE_URL (pooled) via the pg Pool in src/db/prisma.ts.
        url: env('DIRECT_URL'),
    },
});

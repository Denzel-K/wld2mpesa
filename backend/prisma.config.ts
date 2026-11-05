import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: env('DATABASE_URL'),
        // DIRECT_URL is required for Neon: prisma migrate deploy must bypass
        // the connection pooler and connect directly to the database.
        directUrl: env('DIRECT_URL'),
    },
});

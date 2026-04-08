import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: ['.env.local', '.env'] })

const drizzleDatabaseUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.UNPOOLED_DATABASE_URL ??
  process.env.NETLIFY_DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  process.env.NETLIFY_DATABASE_URL

if (!drizzleDatabaseUrl) {
  throw new Error(
    'DATABASE_URL (or NETLIFY_DATABASE_URL when using Netlify DB) environment variable is required',
  )
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: drizzleDatabaseUrl,
  },
})
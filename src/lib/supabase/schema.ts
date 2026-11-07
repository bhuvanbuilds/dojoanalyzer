// Which Postgres schema every Supabase client reads and writes. Production uses
// "public"; the dojo-showcase deployment sets NEXT_PUBLIC_DB_SCHEMA=testing so its
// changes stay in the testing copy and never reach live data.
export const DB_SCHEMA = process.env.NEXT_PUBLIC_DB_SCHEMA || "public";

// Typed as "public" because the clients are untyped (no generated Database type),
// whose only known schema name is "public"; the runtime value is DB_SCHEMA.
export const DB_OPTIONS = { db: { schema: DB_SCHEMA as "public" } };

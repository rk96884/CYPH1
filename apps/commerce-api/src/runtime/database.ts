type Environment = Readonly<Record<string, string | undefined>>;
export const databaseConfiguration = (env: Environment) => {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  let url: URL; try { url = new URL(connectionString); } catch { throw new Error("Invalid DATABASE_URL."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Invalid DATABASE_URL.");
  // pg connection-string SSL options can override explicit TLS settings.
  if ([...url.searchParams.keys()].some(key => /^ssl/i.test(key))) throw new Error("Configure database TLS separately from DATABASE_URL.");
  if (env.DATABASE_SSL !== undefined && !["true", "false"].includes(env.DATABASE_SSL)) throw new Error("Invalid DATABASE_SSL.");
  if (env.NODE_ENV === "production" && env.DATABASE_SSL !== "true") throw new Error("Production requires verified database TLS.");
  return { connectionString, ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 10_000, query_timeout: 15_000, statement_timeout: 15_000, max: 4 };
};

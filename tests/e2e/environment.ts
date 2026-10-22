export function isolatedTestEnvironment(env: Record<string, string | undefined> = process.env) {
  const url = env.E2E_SUPABASE_URL;
  if (!url) {
    if (env.CI || env.E2E_REQUIRED === "true") throw new Error("Authenticated tests require an explicitly configured isolated Supabase stack.");
    return null;
  }
  const parsed = new URL(url);
  const app = new URL(env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000");
  const loopback = (value: URL) => ["localhost", "127.0.0.1", "[::1]"].includes(value.hostname)
    && value.protocol === "http:" && !value.username && !value.password;
  if (!loopback(parsed) || !loopback(app)) throw new Error("Destructive browser fixtures may only target an isolated loopback database and app.");
  if (!env.E2E_SUPABASE_ANON_KEY || !env.E2E_SUPABASE_SERVICE_ROLE_KEY) throw new Error("Explicit E2E keys are required; production key fallbacks are forbidden.");
  return { url, anonKey: env.E2E_SUPABASE_ANON_KEY, serviceKey: env.E2E_SUPABASE_SERVICE_ROLE_KEY };
}

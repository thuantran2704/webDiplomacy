// Reads DATA_PROVIDER env var and exports the active adapter singleton.
const provider = process.env.DATA_PROVIDER ?? "mysql";

let db;
if (provider === "mysql") {
  db = (await import("./adapters/MySQLAdapter.js")).default;
} else if (provider === "postgres") {
  db = (await import("./adapters/PostgresAdapter.js")).default;
} else if (provider === "supabase") {
  db = (await import("./adapters/SupabaseAdapter.js")).default;
} else {
  throw new Error(`Unknown DATA_PROVIDER: "${provider}". Valid values: mysql, postgres, supabase`);
}

export default db;

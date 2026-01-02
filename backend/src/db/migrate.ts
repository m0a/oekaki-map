// Database migration runner for D1
export async function runMigrations(_db: D1Database): Promise<void> {
  // This is primarily used during local development
  // In production, migrations are run via wrangler d1 execute
  console.log('Migrations should be run via: pnpm db:migrate');
}

// Helper to check if tables exist
export async function checkTablesExist(db: D1Database): Promise<boolean> {
  try {
    const result = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='canvas'")
      .first<{ name: string }>();
    return result !== null;
  } catch {
    return false;
  }
}

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("[db] ✗ Missing env var: DATABASE_URL");
  console.error("[db] ✗ Set DATABASE_URL to your PostgreSQL connection string");
} else {
  console.log("[db] ✓ DATABASE_URL is set");
}

const db = DATABASE_URL ? postgres(DATABASE_URL) : null;

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export async function initDB() {
  if (!db) {
    console.warn("[db] ⚠ Skipping DB init — DATABASE_URL not set");
    return;
  }

  await db`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log("[db] ✓ Table 'users' ready");
}

export async function getUsers(limit = 50) {
  if (!db) throw new Error("Database not configured. Set DATABASE_URL env var.");
  return db<User[]>`SELECT * FROM users ORDER BY id DESC LIMIT ${limit}`;
}

export async function getUserById(id: number) {
  if (!db) throw new Error("Database not configured. Set DATABASE_URL env var.");
  const rows = await db<User[]>`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function insertUser(name: string, email: string) {
  if (!db) throw new Error("Database not configured. Set DATABASE_URL env var.");
  const rows = await db<User[]>`
    INSERT INTO users (name, email)
    VALUES (${name}, ${email})
    RETURNING *
  `;
  return rows[0];
}

export async function deleteUser(id: number) {
  if (!db) throw new Error("Database not configured. Set DATABASE_URL env var.");
  const rows = await db<User[]>`
    DELETE FROM users WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export { db };

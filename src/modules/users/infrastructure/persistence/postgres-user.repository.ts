import type { CreateUserInput, UserRepository } from '../../domain/ports/user-repository.port.js';
import { DuplicateEmailError } from '../../domain/ports/user-repository.port.js';
import type { User } from '../../domain/entities/user.js';

/**
 * Postgres implementation of UserRepository using the `postgres` package.
 *
 * NOTE: Integration tests for this repository require a running
 * Postgres instance. The user runs in an environment without Docker
 * (no sudo), so integration tests are skipped. The InMemoryUserRepository
 * and the full handler E2E coverage exercise the same interface, which
 * catches behavioural regressions even though the SQL is not directly
 * exercised. To run integration tests:
 *
 *   docker run -d --name ai-api-pg -p 5432:5432 -e POSTGRES_PASSWORD=*** postgres:16
 *   DATABASE_URL=postgres://postgres:***@localhost:5432/postgres \
 *     pnpm test:run -- users/repository
 */
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly sql: PostgresSql) {}

  async list(limit = 50): Promise<User[]> {
    return this.sql<User>`
      SELECT id, name, email, created_at::text
      FROM users
      ORDER BY id DESC
      LIMIT ${limit}
    `;
  }

  async findById(id: number): Promise<User | null> {
    const rows = await this.sql<User>`
      SELECT id, name, email, created_at::text
      FROM users
      WHERE id = ${id}
    `;
    return rows[0] ?? null;
  }

  async create(input: CreateUserInput): Promise<User> {
    let rows: User[];
    try {
      rows = await this.sql<User>`
        INSERT INTO users (name, email)
        VALUES (${input.name}, ${input.email})
        RETURNING id, name, email, created_at::text
      `;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DuplicateEmailError(input.email);
      }
      throw err;
    }
    const created = rows[0];
    if (!created) {
      throw new Error('PostgresUserRepository.create: empty RETURNING result');
    }
    return created;
  }

  async delete(id: number): Promise<User | null> {
    const rows = await this.sql<User>`
      DELETE FROM users
      WHERE id = ${id}
      RETURNING id, name, email, created_at::text
    `;
    return rows[0] ?? null;
  }
}

/**
 * Minimal interface satisfied by the `postgres` package's tagged
 * template function. Returns rows of `T` directly (no outer array
 * wrapping). Defined here so the repository typechecks against a
 * minimal shape without the package's deep generics.
 */
export interface PostgresSql {
  <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: string };
  return e.code === '23505';
}

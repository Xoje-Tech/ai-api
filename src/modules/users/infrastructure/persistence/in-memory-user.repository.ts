import type {
  CreateUserInput,
  UserRepository,
} from '../../domain/ports/user-repository.port.js';
import {
  DuplicateEmailError,
} from '../../domain/ports/user-repository.port.js';
import type { User } from '../../domain/entities/user.js';

/**
 * In-memory implementation of UserRepository. Useful for tests and
 * for local development without Postgres. Stores users in a Map keyed
 * by id and produces deterministic timestamps (caller-provided or
 * `created_at` left to the caller to inject).
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<number, User>();
  private nextId = 1;

  async list(limit = 50): Promise<User[]> {
    return Array.from(this.store.values())
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
  }

  async findById(id: number): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async create(input: CreateUserInput): Promise<User> {
    for (const existing of this.store.values()) {
      if (existing.email === input.email) {
        throw new DuplicateEmailError(input.email);
      }
    }
    const user: User = {
      id: this.nextId++,
      name: input.name,
      email: input.email,
      created_at: new Date().toISOString(),
    };
    this.store.set(user.id, user);
    return user;
  }

  async delete(id: number): Promise<User | null> {
    const u = this.store.get(id) ?? null;
    if (u) this.store.delete(id);
    return u;
  }
}

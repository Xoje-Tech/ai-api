import { describe, it, expect, beforeEach } from 'vitest';
import type { UserRepository } from '../../domain/ports/user-repository.port.js';
import type { User } from '../../domain/entities/user.js';
import { listUsers } from './list-users.js';
import { getUser } from './get-user.js';
import { createUser } from './create-user.js';
import { deleteUser } from './delete-user.js';

function makeFakeRepo(): UserRepository {
  const store = new Map<number, User>();
  let nextId = 1;
  return {
    async list(limit = 50) {
      return Array.from(store.values())
        .sort((a, b) => b.id - a.id)
        .slice(0, limit);
    },
    async findById(id) {
      return store.get(id) ?? null;
    },
    async create({ name, email }) {
      for (const existing of store.values()) {
        if (existing.email === email) {
          throw new Error('A user with email "x" already exists');
        }
      }
      const user: User = {
        id: nextId++,
        name,
        email,
        created_at: '2026-01-01T00:00:00.000Z',
      };
      store.set(user.id, user);
      return user;
    },
    async delete(id) {
      const u = store.get(id) ?? null;
      if (u) store.delete(id);
      return u;
    },
  };
}

describe('users use cases', () => {
  let repo: ReturnType<typeof makeFakeRepo>;

  beforeEach(() => {
    repo = makeFakeRepo();
  });

  it('listUsers returns users from the repo', async () => {
    await repo.create({ name: 'Ada', email: 'ada@example.com' });
    await repo.create({ name: 'Ben', email: 'ben@example.com' });
    const users = await listUsers(repo);
    expect(users.map((u) => u.name)).toEqual(['Ben', 'Ada']);
  });

  it('listUsers forwards limit to the repo', async () => {
    await repo.create({ name: 'Ada', email: 'ada@example.com' });
    const users = await listUsers(repo, 1);
    expect(users).toHaveLength(1);
  });

  it('getUser returns the user when it exists', async () => {
    const created = await repo.create({ name: 'Ada', email: 'ada@example.com' });
    const fetched = await getUser(repo, created.id);
    expect(fetched).toEqual(created);
  });

  it('getUser returns null when missing', async () => {
    const fetched = await getUser(repo, 999);
    expect(fetched).toBeNull();
  });

  it('createUser returns the created user', async () => {
    const user = await createUser(repo, { name: 'Ada', email: 'ada@example.com' });
    expect(user.name).toBe('Ada');
    expect(user.email).toBe('ada@example.com');
    expect(user.id).toBeGreaterThan(0);
  });

  it('deleteUser removes the user and returns it', async () => {
    const u = await createUser(repo, { name: 'Ada', email: 'ada@example.com' });
    const deleted = await deleteUser(repo, u.id);
    expect(deleted).toEqual(u);
    const after = await getUser(repo, u.id);
    expect(after).toBeNull();
  });

  it('deleteUser returns null when the id does not exist', async () => {
    const result = await deleteUser(repo, 999);
    expect(result).toBeNull();
  });
});

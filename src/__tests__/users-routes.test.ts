import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { InMemoryUserRepository } from '../modules/users/infrastructure/persistence/in-memory-user.repository.js';
import type { User } from '../modules/users/domain/entities/user.js';

describe('/users routes (with InMemoryUserRepository)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    const repo = new InMemoryUserRepository();
    app = buildApp({ services: [], userRepository: repo });
  });

  it('GET /users returns an empty list initially', async () => {
    const res = await app.request('/users');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST /users creates a user and returns 201', async () => {
    const res = await app.request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example.com' }),
    });
    expect(res.status).toBe(201);
    const user = (await res.json()) as { name: string; email: string };
    expect(user.name).toBe('Ada Lovelace');
    expect(user.email).toBe('ada@example.com');
  });

  it('POST /users with invalid body returns 400 with Zod issues', async () => {
    const res = await app.request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues: unknown[] };
    expect(body.error).toBe('Invalid request');
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it('POST /users with duplicate email returns 409', async () => {
    const headers = { 'content-type': 'application/json' };
    const body = JSON.stringify({ name: 'Ada', email: 'dupe@example.com' });

    await app.request('/users', { method: 'POST', headers, body });
    const dup = await app.request('/users', { method: 'POST', headers, body });

    expect(dup.status).toBe(409);
  });

  it('GET /users/:id returns the user when it exists', async () => {
    const create = await app.request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com' }),
    });
    const created = (await create.json()) as { id: number };

    const res = await app.request(`/users/${created.id}`);
    expect(res.status).toBe(200);
    const fetched = (await res.json()) as { name: string };
    expect(fetched.name).toBe('Ada');
  });

  it('GET /users/:id returns 404 for unknown id', async () => {
    const res = await app.request('/users/999');
    expect(res.status).toBe(404);
  });

  it('DELETE /users/:id removes the user', async () => {
    const create = await app.request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com' }),
    });
    const created = (await create.json()) as { id: number };

    const del = await app.request(`/users/${created.id}`, { method: 'DELETE' });
    expect(del.status).toBe(200);

    const after = await app.request(`/users/${created.id}`);
    expect(after.status).toBe(404);
  });

  it('GET /users honours ?limit=N', async () => {
    for (const name of ['Ada', 'Ben', 'Cy', 'Dee']) {
      await app.request('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email: `${name.toLowerCase()}@x.com` }),
      });
    }
    const res = await app.request('/users?limit=2');
    const users = (await res.json()) as { name: string }[];
    expect(users).toHaveLength(2);
  });

  it('GET /users returns 500 when the repo throws', async () => {
    const failingRepo = {
      list: async () => {
        throw new Error('boom');
      },
      findById: async () => null,
      create: async () => {
        throw new Error('unused');
      },
      delete: async () => null,
    };
    const app = buildApp({ services: [], userRepository: failingRepo });

    const res = await app.request('/users');
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('boom');
  });

  it('GET /users/:id returns 500 when the repo throws', async () => {
    const failingRepo = {
      list: async () => [],
      findById: async () => {
        throw new Error('db down');
      },
      create: async () => {
        throw new Error('unused');
      },
      delete: async () => null,
    };
    const app = buildApp({ services: [], userRepository: failingRepo });

    const res = await app.request('/users/1');
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('db down');
  });

  it('DELETE /users/:id returns 500 when the repo throws on delete', async () => {
    const failingRepo = {
      list: async () => [],
      findById: async () => null,
      create: async () => {
        throw new Error('unused');
      },
      delete: async () => {
        throw new Error('cannot delete');
      },
    };
    const app = buildApp({ services: [], userRepository: failingRepo });

    const res = await app.request('/users/1', { method: 'DELETE' });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('cannot delete');
  });

  it('POST /users returns 400 when JSON body is malformed', async () => {
    const app = buildApp({
      services: [],
      userRepository: new InMemoryUserRepository(),
    });
    const res = await app.request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid JSON body');
  });

  it('InMemoryUserRepository throws DuplicateEmailError on duplicate email', async () => {
    const { DuplicateEmailError } = await import(
      '../modules/users/domain/ports/user-repository.port.js'
    );
    const repo = new InMemoryUserRepository();
    await repo.create({ name: 'Ada', email: 'dupe@example.com' });

    await expect(
      repo.create({ name: 'Ada2', email: 'dupe@example.com' }),
    ).rejects.toBeInstanceOf(DuplicateEmailError);
  });
});

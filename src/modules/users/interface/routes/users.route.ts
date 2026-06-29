import type { UserRepository } from '../../domain/ports/user-repository.port.js';
import { DuplicateEmailError } from '../../domain/ports/user-repository.port.js';
import { jsonResponse } from '@shared/infrastructure/http/response.js';
import { logger } from '@shared/infrastructure/logger/logger.js';
import { listUsers } from '../../application/use-cases/list-users.js';
import { getUser } from '../../application/use-cases/get-user.js';
import { createUser } from '../../application/use-cases/create-user.js';
import { deleteUser } from '../../application/use-cases/delete-user.js';
import { CreateUserDto } from '../dto/create-user.dto.js';

/**
 * HTTP handler factory for the /users routes. Takes a UserRepository
 * (typically PostgresUserRepository in production, InMemory in tests)
 * and returns a router-like function compatible with the legacy
 * `handleUsers(req, url, pathname)` signature used by Hono's
 * catch-all in src/app.ts.
 */
export function handleUsers(
  req: Request,
  url: URL,
  pathname: string,
  repo: UserRepository,
): Promise<Response | null> {
  const idMatch = pathname.match(/^\/users\/(\d+)$/);
  const id = idMatch ? Number(idMatch[1]) : null;

  if (req.method === 'GET' && pathname === '/users') {
    const limit = Number(url.searchParams.get('limit')) || 50;
    return listUsers(repo, limit)
      .then((users) => jsonResponse(users))
      .catch((err: Error) => {
        logger.error({ err: err.message }, 'GET /users failed');
        return jsonResponse({ error: err.message }, 500);
      });
  }

  if (req.method === 'GET' && idMatch) {
    return getUser(repo, id!)
      .then((user) => {
        if (!user) return jsonResponse({ error: 'User not found' }, 404);
        return jsonResponse(user);
      })
      .catch((err: Error) => {
        logger.error({ err: err.message }, 'GET /users/:id failed');
        return jsonResponse({ error: err.message }, 500);
      });
  }

  if (req.method === 'POST' && pathname === '/users') {
    return req
      .json()
      .then((body: unknown) => {
        const parsed = CreateUserDto.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            { error: 'Invalid request', issues: parsed.error.issues },
            400,
          );
        }
        return createUser(repo, parsed.data)
          .then((user) => jsonResponse(user, 201))
          .catch((err: unknown) => {
            if (err instanceof DuplicateEmailError) {
              return jsonResponse({ error: err.message }, 409);
            }
            logger.error(
              { err: (err as Error).message },
              'POST /users failed',
            );
            return jsonResponse(
              { error: (err as Error).message },
              500,
            );
          });
      })
      .catch((err: Error) => {
        logger.error({ err: err.message }, 'POST /users body parse failed');
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
      });
  }

  if (req.method === 'DELETE' && idMatch) {
    return deleteUser(repo, id!)
      .then((deleted) => {
        if (!deleted) return jsonResponse({ error: 'User not found' }, 404);
        return jsonResponse(deleted);
      })
      .catch((err: Error) => {
        logger.error({ err: err.message }, 'DELETE /users/:id failed');
        return jsonResponse({ error: err.message }, 500);
      });
  }

  return Promise.resolve(null);
}

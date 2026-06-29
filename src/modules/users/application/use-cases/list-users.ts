import type { UserRepository } from '../../domain/ports/user-repository.port.js';
import type { User } from '../../domain/entities/user.js';

/**
 * Use case: list the most recent users, ordered by id descending.
 * Limit defaults to 50 (matches legacy behaviour); pass any positive
 * integer to override.
 */
export async function listUsers(
  repo: UserRepository,
  limit = 50,
): Promise<User[]> {
  return repo.list(limit);
}

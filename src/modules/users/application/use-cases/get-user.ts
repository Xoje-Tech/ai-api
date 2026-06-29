import type { UserRepository } from '../../domain/ports/user-repository.port.js';
import type { User } from '../../domain/entities/user.js';

/** Returns the user, or `null` if not found. */
export async function getUser(
  repo: UserRepository,
  id: number,
): Promise<User | null> {
  return repo.findById(id);
}

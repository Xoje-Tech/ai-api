import type { UserRepository } from '../../domain/ports/user-repository.port.js';
import type { User } from '../../domain/entities/user.js';

/** Returns the deleted user, or `null` if no row had that id. */
export async function deleteUser(
  repo: UserRepository,
  id: number,
): Promise<User | null> {
  return repo.delete(id);
}

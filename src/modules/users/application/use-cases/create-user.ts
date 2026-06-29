import type { UserRepository, CreateUserInput } from '../../domain/ports/user-repository.port.js';
import type { User } from '../../domain/entities/user.js';

/**
 * Creates a new user. Propagates `DuplicateEmailError` from the repo
 * if the email already exists.
 */
export async function createUser(
  repo: UserRepository,
  input: CreateUserInput,
): Promise<User> {
  return repo.create(input);
}

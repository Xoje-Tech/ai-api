import type { User } from '../entities/user.js';

export interface CreateUserInput {
  name: string;
  email: string;
}

/**
 * Thrown by a repository when an operation conflicts with an
 * existing row (e.g. duplicate email). Concrete repositories are
 * expected to surface this code through `cause` so callers can
 * distinguish business errors from infrastructure failures.
 */
export class DuplicateEmailError extends Error {
  readonly cause: 'duplicate_email';
  constructor(email: string) {
    super(`A user with email "${email}" already exists`);
    this.name = 'DuplicateEmailError';
    this.cause = 'duplicate_email';
  }
}

export interface UserRepository {
  list(limit?: number): Promise<User[]>;
  findById(id: number): Promise<User | null>;
  /**
   * Inserts a new user. Throws `DuplicateEmailError` if the email
   * already exists.
   */
  create(input: CreateUserInput): Promise<User>;
  /** Returns the deleted user, or `null` if no row had that id. */
  delete(id: number): Promise<User | null>;
}

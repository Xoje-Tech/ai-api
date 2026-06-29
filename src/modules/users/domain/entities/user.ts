/**
 * Domain entity for a User row in our persistence layer.
 *
 * Mirrors the legacy schema: `id`, `name`, `email`, `created_at`. The
 * `created_at` is kept as an ISO 8601 string so the entity round-trips
 * cleanly through JSON without timezone interpretation surprises.
 */
export interface User {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly created_at: string;
}

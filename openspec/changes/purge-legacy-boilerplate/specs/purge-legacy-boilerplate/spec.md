# Delta for Purge Legacy Boilerplate

## MODIFIED Requirements

### Requirement: Root Route Behavior

The system MUST return `404 Not Found` when accessing the root path `GET /`.
(Previously: The root path served an HTML landing page)

#### Scenario: Accessing root path

- GIVEN the server is running
- WHEN a `GET` request is made to `/`
- THEN the response status code MUST be `404`

### Requirement: Users Route Behavior

The system MUST return `404 Not Found` for all paths related to the users module, including `GET /users`, `POST /users`, and `DELETE /users/:id`.
(Previously: These paths served user management CRUD operations)

#### Scenario: Accessing users routes

- GIVEN the server is running
- WHEN a `GET` request is made to `/users`
- THEN the response status code MUST be `404`
- WHEN a `POST` request is made to `/users`
- THEN the response status code MUST be `404`
- WHEN a `DELETE` request is made to `/users/1`
- THEN the response status code MUST be `404`

### Requirement: Server Initialization

The server MUST boot successfully without the `DATABASE_URL` environment variable, and the Postgres driver MUST NOT be initialized.
(Previously: The server attempted to initialize Postgres connectivity and might fail or log errors if `DATABASE_URL` was missing)

#### Scenario: Booting without database

- GIVEN the `DATABASE_URL` environment variable is unset
- WHEN the server boots
- THEN the boot process MUST succeed
- AND no Postgres driver initialization MUST occur

## ADDED Requirements

### Requirement: App Configuration

The `buildApp` function MUST NOT accept a `userRepository` option.

#### Scenario: Configuring App

- GIVEN an application configuration
- WHEN `buildApp` is called
- THEN it MUST NOT accept `userRepository` in the options object

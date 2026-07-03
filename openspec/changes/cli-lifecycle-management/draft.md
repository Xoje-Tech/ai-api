# Draft Requirements: CLI Lifecycle Management

**Objective:** Create a unified CLI wrapper (`ai-api.sh` or `ai-api`) to manage the `ai-api` project in production environments (specifically `~/tools/ai-api`).

**Problem Statement:**
Currently, interacting with the deployed `ai-api` requires navigating to the installation directory and executing raw `docker compose` or `podman compose` commands. This creates unnecessary operational friction, especially for routine tasks like starting, stopping, or updating the service.

**Target Environment:**
*   Deployed at: `~/tools/ai-api`
*   Execution Context: Can be invoked from *anywhere* in the host filesystem (e.g., via a symlink in `~/.local/bin/`).

**Proposed Commands & Behavior:**

1.  **`ai-api setup`**
    *   **Goal:** Idempotent initialization of the environment.
    *   **Actions:**
        *   Verify required host dependencies (Git, Podman/Docker).
        *   Create a global symlink (e.g., in `~/.local/bin/ai-api`) pointing to the script in `~/tools/ai-api/ai-api.sh`.
        *   Initialize `.env` from `.env.example` *only* if `.env` does not already exist (to protect existing BWS secrets).

2.  **`ai-api start`**
    *   **Goal:** Launch the service seamlessly.
    *   **Actions:**
        *   Resolve the absolute path to `~/tools/ai-api`.
        *   Execute `docker compose up -d` (or `podman compose up -d`) from that directory.

3.  **`ai-api stop`**
    *   **Goal:** Halt the service gracefully.
    *   **Actions:**
        *   Resolve the absolute path.
        *   Execute `docker compose down` (or `podman compose down`).

4.  **`ai-api status` / `ai-api logs`**
    *   **Goal:** Visibility into the running service.
    *   **Actions:**
        *   Wrap `compose ps` and `compose logs -f`.

5.  **`ai-api update`**
    *   **Goal:** Automate local continuous deployment (CD).
    *   **Actions:**
        *   Execute `git pull origin master` (or target release branch).
        *   Execute `compose build` (to pick up any Dockerfile or dependency changes).
        *   Execute `compose up -d` (restarts the service with the new image).

**Technical Constraints:**
*   The script must correctly resolve its own absolute path (using `BASH_SOURCE` or similar techniques) so it can safely `cd` into the project root before executing compose commands, regardless of where the user is currently located in the terminal.
*   Must be zero-sudo compatible.

---
*Note: This is a draft document. The next step is to initiate a formal SDD cycle (`/sdd-new cli-lifecycle-management`) using this draft to generate the final `proposal.md`.*
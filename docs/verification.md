# Initial verification

Verified on 2026-11-04 on Windows with JDK 21.0.8, Maven 3.9.11 and Node.js 22.19.0.

| Check | Result |
| --- | --- |
| Backend clean build and executable packaging | Passed |
| Backend tests | 11 passed, 1 skipped, 0 failures |
| Frontend ESLint | Passed |
| Frontend TypeScript | Passed |
| Next.js production build | Passed |
| Backend production startup on `127.0.0.1:8080` | Passed |
| Frontend production startup on `127.0.0.1:3000` | Passed |
| `npm run smoke` against both running services | Passed |

The integration check went through the Next.js API proxy, scanned `examples/shop`, and verified 3 manifests, 6 nodes, 3 edges, unknown runtime statuses, declared/inferred relationships, session lookup, rejection of paths outside the root, rejection of foreign browser origins, and HTTP 200 for the page.

The symbolic-link test was skipped because this Windows session could not create symbolic links. The same test remains enabled on systems that allow them.

Visual browser verification is pending: the in-app browser could not reach the local server; native browser control stopped because it could not establish the current URL with sufficient confidence. No successful screenshot or visual inspection is claimed.

No scanned fixture was built, installed or executed. Runtime connectivity checks here targeted only DevMap's own local services, not discovered components.

## Docker Compose verification

Verified on 2026-11-04 using Docker Desktop with Linux containers and Compose v2.39.4.

- Both multi-stage images built successfully, including the standalone Next.js output.
- All 12 backend tests passed inside the Linux build, including the symbolic-link test (no skips).
- Frontend lint passed; the container build also passed TypeScript checks and production compilation.
- Both Compose services reached healthy status, with the UI published only at `127.0.0.1:3000`.
- `npm run smoke` passed against the containers through that published host port: 3 manifests, 6 nodes, 3 edges, session lookup, path-boundary and foreign-origin rejection.
- Container inspection confirmed non-root users, read-only root filesystems, and the host repository mounted at `/workspace` with `RW=false`. The backend confirmed that mount is not writable.

The runtime uses a bridge network and a shared network namespace so the API remains on container loopback. An initial internal-only network did not publish the UI port on Docker Desktop; the checked-in configuration uses the verified bridge setup. Scan behavior still performs no outbound requests. Docker images and build dependencies require internet access for the first build.

These checks validate compilation, startup and HTTP behavior; no additional visual browser verification was performed.

## Backend layer refactor

Verified on 2026-11-04 after separating controllers, request/response DTOs, models, services, repository, mapper, detectors and centralized exception handling:

- Clean native Maven verification passed: 16 tests passed, 1 symbolic-link test skipped on Windows, no failures.
- Backend Docker build passed: all 17 tests passed, no skips or failures.
- Controller tests verify the existing JSON fields and nested evidence when mapping internal models to DTOs, plus validation and domain error status codes.
- Service/repository tests verify successful scan storage, replacement of earlier results, failed scans without storage, newest-first ordering and the 20-project memory limit.
- Both Compose services restarted successfully and reached healthy status.
- The existing full HTTP integration check passed against the updated containers: 3 manifests, 6 nodes, 3 edges, project retrieval and access restrictions.

The frontend source and API endpoint paths did not need changes. The previous native backend instance was stopped to release the executable locked by Windows; the active application is running through Docker Compose.

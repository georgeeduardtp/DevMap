# Contributing to DevMap

Start with the setup and checks in [README.md](README.md). Keep contributions small and explain the behavior being changed.

## Architecture

- `controller/` handles HTTP routing and validation using `dto/request/` and `dto/response/`.
- `service/ProjectService` orchestrates scans and project lookup; `service/ScanService` owns traversal, safety limits and map assembly.
- `repository/ProjectRepository` retains up to 20 maps in session memory, with no database or disk writes.
- `model/` contains internal maps, components, connections and evidence; it does not depend on HTTP DTOs.
- `mapper/ProjectMapper` converts models to response DTOs. Preserve the JSON contract in `frontend/src/lib/types.ts`, including `nodes` and `edges`.
- `exception/GlobalExceptionHandler` maps domain exceptions to HTTP errors; services do not depend on HTTP status codes.
- New detectors belong in `detector/`, implementing `TechnologyDetector` with fixture-based tests including malformed input.

See [the backend structure guide](docs/backend-structure.md) for a Spanish walkthrough. Keep concrete services and repositories simple; interfaces and implementations are only needed when there is an actual second implementation or another concrete reason.

## Local-first rules

Never execute scanned scripts, build tools, containers or application code. Never resolve remote manifests or URLs, substitute environment variables, or add analytics. Keep raw configuration, credentials and parser error messages out of responses and logs. Mark uncertain relationships as inferred and runtime state as unknown.

V1 changes must preserve bounded traversal, XML external-entity protection, safe YAML loading, loopback binding and browser origin/host checks. Detection should be useful without installing the scanned project's dependencies.

## Pull requests

Describe the trigger, the resulting graph and the relevant validation. Update the README when support or limits change. Run `mvn -f backend/pom.xml verify`, `npm run lint`, `npm run typecheck`, and `npm run build` on DevMap itself.

CI uses GitHub-hosted runners to verify this repository; the running product does not use GitHub or any cloud service.

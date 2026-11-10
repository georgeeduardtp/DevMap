# DevMap

**Understand your architecture before you start it.**

DevMap is an open-source developer tool that turns a local repository into an interactive architecture map. Discover applications, infrastructure signals and declared dependencies without running the project you are exploring.

**No cloud. No accounts. No telemetry. Your source stays on your machine.**

> Early V1 foundation. Static discovery is implemented; runtime monitoring, source-code analysis and manual URL configuration are roadmap items. A dependency is evidence of possible usage, not proof of a running service.

## Quick start with Docker

1. Open Docker Desktop and wait for the Linux container engine to be ready. On Linux, you can also use Docker Engine with Compose v2.
2. Start DevMap from a terminal in the repository folder that contains `compose.yaml`.

   ```sh
   docker compose up --build -d --wait
   ```

3. Open [DevMap](http://127.0.0.1:3000), click **+ Elegir carpeta** in the sidebar, and select a repository on your computer.

The command starts both services and waits until they are ready. The first run downloads images and dependencies, so it may take a few minutes. Docker provides Java, Maven and Node.js.

To stop the app, run `docker compose down` from the same folder. Saved maps stay in the local `project-data` volume. Running `docker compose down --volumes` also removes that volume and its saved maps.

The folder picker works with folders outside the Docker mount. When the browser provides direct folder access, DevMap skips hidden and generated directories such as `node_modules` before traversing them. With the fallback picker, the browser enumerates files and DevMap filters the results before opening them. DevMap sends supported manifest text and relative directory names to its local server and saves the resulting map.

## What works today

- Scan a directory within a configurable local root.
- Discover Maven applications, Spring Boot dependencies, npm applications, Next.js and React.
- Identify Redis, PostgreSQL, MongoDB, MySQL, RabbitMQ and Kafka dependency signals.
- Read Compose service declarations and explicit `depends_on` relationships.
- Explore a map with zoom, pan, a minimap, technology logos, component details and source-file evidence.
- Switch between **Diagrama** and **Folder scheme** to see the saved directory tree with all branches visible and export it as an SVG. The fallback picker can only show folders that contain files. Older maps gain a folder scheme when the folder is imported again.
- See components grouped by their manifest directory, with inferred frontend and backend roles and a separate Compose infrastructure group. Filter the technology inventory by module.
- Select a Docker Compose file in the map to see its build and startup commands. Compose services show their referenced local Dockerfile in the evidence panel.
- Select a connection to see the files that support it. Compose build links are declared when a local `COPY` or `ADD` in a reachable Dockerfile stage names the application manifest. Links based on a directory match are inferred. DevMap omits ambiguous matches and keeps `depends_on` as a separate relationship.
- Drag a section by its heading to rearrange the diagram. Its cards and connections move with it, and the browser remembers the layout for that map.
- Browse a project-wide technology inventory when no component is selected. Known manifest declarations identify languages, frameworks, libraries, tools, runtimes and infrastructure, with source-file evidence for each technology.
- Distinguish **inferred** relationships from **declared** ones. Runtime state always remains **unknown**.
- Reopen or remove up to 20 saved maps across restarts. Scanning the same mounted directory replaces its previous map. Each browser import is saved as a separate map.

Technology logos are served locally from [Simple Icons](https://github.com/simple-icons/simple-icons/tree/16.37.0).

The initial UI is in Spanish; this README is in English for contributors.

## Docker configuration

```sh
docker compose logs -f # View both services' logs (Ctrl+C stops following logs)
```

Stop any previously running native frontend on port 3000 before starting DevMap with Docker.

By default, this repository is mounted **read-only** at `/workspace` in the backend for API-based scans. Pass `.` to the scan endpoint for the whole mounted directory or `backend` for its Java module. Use paths relative to the mount when scanning from Docker.

To scan another directory, copy `.env.example` to `.env` in the repository root and set the parent directory you want to make available:

```dotenv
DEVMAP_REPOSITORIES=C:/dev
```

On macOS/Linux, use a path such as `/home/you/projects`. Run `docker compose up --build -d --wait` again, then pass `my-app` to the scan endpoint to scan `C:/dev/my-app`. The source directory must already exist and be readable by Docker. The API scanner reads the mounted directory tree in place.

The frontend and backend share a network namespace: the API keeps its loopback binding and the frontend uses the same fixed local proxy. Only UI port 3000 is published, bound to host `127.0.0.1`. They use a Docker bridge network; scanning does not contact external services. Containers run as non-root users with read-only root filesystems and temporary `/tmp` storage. The backend writes `projects.json` to the `project-data` volume at `/app/data`. No Docker socket is mounted. Health checks wait for the backend and frontend API connection before the command succeeds.

Source changes require rebuilding with the same `docker compose up --build -d --wait` command. Use the native development setup below for hot reload. To run the existing integration check, optionally use host Node.js with `npm run smoke` while the default repository mount is active.

See the official [Docker Compose service reference](https://docs.docker.com/reference/compose-file/services/) for bind mounts, health checks and namespace sharing.

## Native development (without Docker)

Requirements: **JDK 21**, **Maven 3.9+**, **Node.js 22+**, and npm. Set `JAVA_HOME` to a JDK 21 installation and put its `bin` directory first on your `PATH`. Confirm `mvn -version` reports Java 21; a separately installed Java 8 runtime is insufficient.

Run these commands from the repository root. Installation needs internet access to retrieve DevMap dependencies. Analysis itself makes no outbound requests and works offline once dependencies are available.

### 1. Start the backend

PowerShell:

```powershell
$env:DEVMAP_SCAN_ROOT = (Get-Location).Path
mvn -f backend/pom.xml spring-boot:run
```

macOS / Linux:

```sh
export DEVMAP_SCAN_ROOT="$PWD"
mvn -f backend/pom.xml spring-boot:run
```

The backend listens on `127.0.0.1:8080`. `DEVMAP_SCAN_ROOT` defines the only directory tree it may scan. To explore other projects, set it to their parent directory before starting the backend. Without this variable, the root is the backend process's working directory.

### 2. Start the frontend in another terminal

```sh
npm ci
npm run dev
```

Open [DevMap](http://127.0.0.1:3000) and click **+ Elegir carpeta** in the sidebar to import a folder. Select a saved map from the sidebar to reopen it. In native mode the default store is `~/.devmap/projects.json`.

Next.js telemetry is disabled by the checked-in launcher for every provided development, build and start command. There are no remote fonts, analytics scripts or application cloud integrations.

## Monorepo

```text
backend/                  Java 21 + Spring Boot 3.5 + Maven
  src/main/java/com/devmap/
    controller/           REST endpoints; delegates application logic to services
    dto/request/          Validated HTTP request objects
    dto/response/         HTTP responses consumed by the frontend
    service/              Project orchestration and bounded local scanning
    repository/           Local JSON storage for project maps
    model/                Internal project maps, components, connections and evidence
    mapper/               Conversion from internal models to response DTOs
    detector/             Pluggable technology detectors
    exception/            Domain exceptions and centralized HTTP error handling
    config/               Local browser access checks
  src/test/               Discovery and HTTP boundary tests
frontend/                 Next.js 16 + TypeScript + React Flow
  src/app/                UI, styles and same-origin local API proxy
  src/features/graph/     Interactive architecture canvas
  src/lib/                API client and shared types
scripts/                  Telemetry-disabled Next.js launcher
.github/workflows/        Build and verification for this repository
```

The frontend proxies `/api/*` to a fixed loopback backend. Detectors receive bounded manifest text and return findings; the scanner owns traversal and graph assembly. No database, Docker daemon or external service is required.

Backend flow: `ProjectController → ProjectService → ScanService / ProjectRepository`. `ProjectMapper` converts the internal `ProjectMap` into response DTOs. The HTTP contract retains `nodes` and `edges` for the frontend, while internal models use `components` and `connections`. A graph simply means components connected by relationships; it is a data structure, not a separate backend framework. See [the backend structure guide](docs/backend-structure.md) for a Spanish explanation of each layer.

## API

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/health` | Engine health, static mode and JSON storage |
| GET | `/api/projects` | Saved maps, newest first |
| GET | `/api/projects/{id}` | One map, or 404 |
| DELETE | `/api/projects/{id}` | Remove a saved map and return 204 |
| POST | `/api/projects/scan` | Scan a local directory and return its graph |
| POST | `/api/projects/scan-folder` | Analyze manifest text and relative directory paths from the browser's folder picker |

PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
Invoke-RestMethod http://127.0.0.1:8080/api/projects/scan `
  -Method Post -ContentType 'application/json' `
  -Body '{"path":"."}'
```

macOS / Linux:

```sh
curl http://127.0.0.1:8080/api/projects/scan \
  -H 'Content-Type: application/json' \
  -d '{"path":"."}'
```

A graph contains `id`, `name`, `scannedAt`, `mode`, `filesInspected`, `nodes`, `edges`, `warnings`, `technologies`, `composeNames`, `commands` and an optional `folderScheme`. Nodes include a technology, kind, `unknown` runtime status, and evidence containing relative filenames and detector descriptions. Edges carry `inferred` or `declared` confidence. The `technologies` list contains names, categories and up to five evidence entries per technology. Commands include their origin file, category, and the command text or script invocation. A folder scheme contains up to 1,000 relative directory paths and a flag for partial results.

Invalid paths and invalid input return 400; unknown projects return 404; foreign browser origins or hostnames return 403. Unsupported content types return 415. The frontend reports 502 if the local backend is unavailable.

## Local development configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEVMAP_SCAN_ROOT` | Backend working directory | Allowed scan directory; use an explicit absolute path |
| `DEVMAP_DATA_DIR` | `~/.devmap` natively, `/app/data` in Docker | Directory for `projects.json`; use a separate directory for each running backend |
| `DEVMAP_PORT` | `8080` | Backend port |
| `DEVMAP_BACKEND_URL` | `http://127.0.0.1:8080` | Server-side frontend proxy target; loopback HTTP only |
| `DEVMAP_FRONTEND_ORIGIN` | `http://127.0.0.1:3000` | Additional exact trusted browser origin at the backend |

For an alternative backend port, set `DEVMAP_PORT` in the backend terminal and `DEVMAP_BACKEND_URL` in the frontend terminal, or copy `frontend/.env.example` to `frontend/.env.local` and edit it. Keep the frontend on port 3000: its API proxy deliberately accepts only `localhost:3000` and `127.0.0.1:3000`. Stop an existing process occupying that port before starting DevMap.

### Verify and build

```sh
mvn -f backend/pom.xml verify
npm run lint
npm run typecheck
npm run build
```

For a production-mode local run, build first, then run the following in separate terminals. Set `DEVMAP_SCAN_ROOT` as shown above before launching the jar:

```sh
java -jar backend/target/devmap-backend-0.1.0.jar
npm start
```

In native mode, both services bind to IPv4 loopback. No publishing or cloud deployment step is involved.

With both services running and `DEVMAP_SCAN_ROOT` set to this repository, `npm run smoke` verifies the full frontend-proxy-backend path, scans DevMap's own manifests, and checks path and browser-origin rejection.

## Safety and scope

DevMap reads `pom.xml`, `package.json`, the standard Compose filenames, Dockerfiles and Containerfiles, README Markdown files, and Makefiles. The command inventory shows package scripts, explicit `.PHONY` targets, shell code blocks from README files, Compose `command` and `entrypoint` fields, and `CMD` and `ENTRYPOINT` from a Dockerfile's final stage. It omits package installation and publishing hooks and limits the inventory to 200 entries of at most 4,096 characters each.

DevMap does **not** execute scripts, Maven/Gradle builds, application code, containers, package lifecycle hooks or repository plugins. It does not resolve dependencies, fetch declared URLs, expand environment variables or read `.env` files while scanning.

- Hidden and generated directories are skipped, including `.git`, `node_modules`, `target`, `build`, `dist`, `.next`, `.gradle`, `.venv` and `vendor`.
- Symbolic links are not followed; resolved paths must stay inside the allowed scan tree.
- Limits: depth 12, 20,000 visited entries, 200 inspected manifests, 1 MiB per file, 10 MiB aggregate input, 1,000 graph nodes, 2,000 edges, 200 services per Compose file, and a cooperative 10-second traversal budget. Reaching a limit produces warnings or skips the affected manifest. Blocking filesystem operations are not a hard real-time timeout.
- XML external entities/DTDs are disabled. YAML uses a safe constructor with alias and nesting limits. Malformed files produce sanitized warnings.
- Hostname and browser-origin checks resist cross-site access and DNS rebinding; scans require JSON. CORS is not enabled. The Next.js proxy also rejects foreign hosts/origins and redirects to external servers.
- This is a tool for a trusted local OS session. There is no user authentication or isolation from other processes/users on the same machine. Do not expose it through public proxies, tunnels, shared servers or network shares. Do not modify a repository's directory links while a scan is in progress.

The local JSON store contains scan results, including service names, relative filenames and detected command snippets. The scanner reads repository files without writing to them. If `projects.json` is unreadable, DevMap leaves it intact and stops at startup so you can recover it.

## Known limitations and roadmap

Manifests show declarations, not complete architecture. Dependency-management entries, development dependencies and unused libraries may produce false positives. Maven profiles, inheritance, namespaces, property interpolation, Gradle, source-code HTTP clients, application configuration, `.env`, Kubernetes and Terraform are not resolved. Compose is not evaluated or merged; overrides, includes and dynamic values are not resolved.

Nodes are scoped to their source manifest. The same service in a POM and Compose file may appear twice. The scanner does not invent frontend-to-backend connections or merge instances without evidence. Relative filenames may still be sensitive.

Planned next steps:

- Config-file and source-code detectors with stronger evidence and confidence.
- Conservative cross-file correlation and deduplication.
- Optional manual service/URL annotations saved locally.
- Local JSON or SQLite persistence, explicit import/export and richer layout.
- Optional runtime checks with separate, explicit permission. V1 performs none.

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [MIT](LICENSE).

Stack references: [Spring Boot requirements](https://docs.spring.io/spring-boot/3.5/system-requirements.html) and [Next.js support policy](https://nextjs.org/support-policy).

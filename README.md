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

3. Open [DevMap](http://127.0.0.1:3000), click **Elegir carpeta**, and select a repository on your computer. With the default mount, you can also enter `.` to scan DevMap itself.

The command starts both services and waits until they are ready. The first run downloads images and dependencies, so it may take a few minutes. Docker provides Java, Maven and Node.js.

To stop the app, run `docker compose down` from the same folder. This clears the maps stored in the current backend session.

The folder picker works with folders outside the Docker mount. The browser sends only supported manifests and their relative paths to the local DevMap server. Hidden and generated directories are skipped. DevMap analyzes the manifests in memory and adds the resulting map to the current session.

## What works today

- Scan a directory within a configurable local root.
- Discover Maven applications, Spring Boot dependencies, npm applications, Next.js and React.
- Identify Redis, PostgreSQL, MongoDB, MySQL, RabbitMQ and Kafka dependency signals.
- Read Compose service declarations and explicit `depends_on` relationships.
- Explore a map with zoom, pan, a minimap, technology logos, component details and source-file evidence.
- Distinguish **inferred** relationships from **declared** ones. Runtime state always remains **unknown**.
- Reopen or remove scanned projects during the backend session. The session holds up to 20 maps. Rescans replace previous results.

Technology logos are served locally from [Simple Icons](https://github.com/simple-icons/simple-icons/tree/16.37.0).

The initial UI is in Spanish; this README is in English for contributors.

## Docker configuration

```sh
docker compose logs -f # View both services' logs (Ctrl+C stops following logs)
```

Stop any previously running native frontend on port 3000 before starting DevMap with Docker.

By default, this repository is mounted **read-only** at `/workspace` in the backend. Enter `.` for the whole mounted directory or `backend` for its Java module. Use paths relative to the mount when scanning from Docker.

To scan another directory, copy `.env.example` to `.env` in the repository root and set the parent directory you want to make available:

```dotenv
DEVMAP_REPOSITORIES=C:/dev
```

On macOS/Linux, use a path such as `/home/you/projects`. Run `docker compose up --build -d --wait` again, then enter `my-app` in the UI to scan `C:/dev/my-app`. The source directory must already exist and be readable by Docker. Only this selected directory tree is available to the scanner; it is not copied into the image or modified.

The frontend and backend share a network namespace: the API keeps its loopback binding and the frontend uses the same fixed local proxy. Only UI port 3000 is published, bound to host `127.0.0.1`. They use a Docker bridge network; scanning does not contact external services. Containers run as non-root users with read-only root filesystems and temporary `/tmp` storage. No Docker socket is mounted. Health checks wait for the backend and frontend API connection before the command succeeds.

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

Open [DevMap](http://127.0.0.1:3000). Enter a path relative to `DEVMAP_SCAN_ROOT` and click **Analizar carpeta**. Absolute paths are accepted only inside that root. The map starts empty and displays results from a scan or a project selected from the session.

Next.js telemetry is disabled by the checked-in launcher for every provided development, build and start command. There are no remote fonts, analytics scripts or application cloud integrations.

## Monorepo

```text
backend/                  Java 21 + Spring Boot 3.5 + Maven
  src/main/java/com/devmap/
    controller/           REST endpoints; delegates application logic to services
    dto/request/          Validated HTTP request objects
    dto/response/         HTTP responses consumed by the frontend
    service/              Project orchestration and bounded local scanning
    repository/           Bounded in-memory project storage
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
| GET | `/api/health` | Engine health, static mode and in-memory storage |
| GET | `/api/projects` | Latest maps in this session, newest first |
| GET | `/api/projects/{id}` | One map, or 404 |
| DELETE | `/api/projects/{id}` | Remove a map from session memory and return 204 |
| POST | `/api/projects/scan` | Scan a local directory and return its graph |
| POST | `/api/projects/scan-folder` | Analyze manifest text from the browser's folder picker and return its graph |

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

A graph contains `id`, `name`, `scannedAt`, `mode`, `filesInspected`, `nodes`, `edges` and `warnings`. Nodes include a technology, kind, `unknown` runtime status, and evidence containing relative filenames and detector descriptions. Edges carry `inferred` or `declared` confidence. No raw configuration or full source file contents are returned.

Invalid paths and invalid input return 400; unknown projects return 404; foreign browser origins or hostnames return 403. Unsupported content types return 415. The frontend reports 502 if the local backend is unavailable.

## Local development configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEVMAP_SCAN_ROOT` | Backend working directory | Allowed scan directory; use an explicit absolute path |
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

DevMap reads only `pom.xml`, `package.json`, `compose.yaml`, `compose.yml`, `docker-compose.yaml` and `docker-compose.yml` in V1. It does **not** execute scripts, Maven/Gradle builds, application code, containers, package lifecycle hooks or repository plugins. It does not resolve dependencies, fetch declared URLs, expand environment variables or read `.env` files while scanning.

- Hidden and generated directories are skipped, including `.git`, `node_modules`, `target`, `build`, `dist`, `.next`, `.gradle`, `.venv` and `vendor`.
- Symbolic links are not followed; resolved paths must stay inside the allowed scan tree.
- Limits: depth 12, 20,000 visited entries, 200 inspected manifests, 1 MiB per file, 10 MiB aggregate input, 1,000 graph nodes, 2,000 edges, 200 services per Compose file, and a cooperative 10-second traversal budget. Reaching a limit produces warnings or skips the affected manifest. Blocking filesystem operations are not a hard real-time timeout.
- XML external entities/DTDs are disabled. YAML uses a safe constructor with alias and nesting limits. Malformed files produce sanitized warnings.
- Hostname and browser-origin checks resist cross-site access and DNS rebinding; scans require JSON. CORS is not enabled. The Next.js proxy also rejects foreign hosts/origins and redirects to external servers.
- This is a tool for a trusted local OS session. There is no user authentication or isolation from other processes/users on the same machine. Do not expose it through public proxies, tunnels, shared servers or network shares. Do not modify a repository's directory links while a scan is in progress.

Maps live only in bounded backend memory and disappear when the backend stops. They may reveal service names and relative filenames. DevMap does not write scan results to disk or send them elsewhere.

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

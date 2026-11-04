# DevMap 🗺️

### Understand your architecture. See what's running. Find what's broken.

**DevMap** is an open-source, local-first developer tool designed to automatically discover, visualize, and monitor the services that make up your application.

From Spring Boot backends and JavaScript frontends to PostgreSQL, MongoDB, Redis, message brokers, and external APIs, DevMap aims to bring your entire development environment into one interactive architecture map.

**No cloud. No accounts. No code changes required. Just your application, visualized.**

> 🚧 **Project Status: Planning & Early Development**
>
> DevMap is currently being designed. The features described below represent our vision and planned development roadmap, not yet-released functionality.

---

## 💡 Why DevMap?

Modern applications rarely consist of a single process.

A typical development environment might include:

- A Spring Boot backend running from IntelliJ IDEA
- A React or Next.js frontend running with `npm run dev`
- PostgreSQL and MongoDB running in Docker
- Redis for caching
- RabbitMQ or Kafka for messaging
- Multiple microservices communicating with each other
- External APIs and third-party services

Understanding how everything connects can be surprisingly difficult, especially when working with an unfamiliar codebase.

**Which services does this application need?**

**How are they connected?**

**What needs to be started first?**

**Why isn't my backend working?**

Today, answering these questions often means manually exploring configuration files, reading source code, switching between terminals, and checking containers and logs.

**DevMap aims to make that process visual, automatic, and intuitive.**

---

## ✨ What Will DevMap Do?

### 🔍 1. Automatic Architecture Discovery

Point DevMap at your project directory and let it discover your application's architecture.

Planned discovery sources include:

- `pom.xml` and `build.gradle`
- Spring Boot `application.yml` and `application.properties`
- Java source code and HTTP client definitions
- JavaScript frontend configurations and `package.json`
- Environment configuration files
- Docker Compose definitions
- Database and messaging configurations

DevMap will combine this information to identify application components and infer how they communicate.

**The goal: generate an architecture map without starting your application.**

### 🗺️ 2. Interactive Architecture Visualization

Explore your application through an interactive graph.

Visualize:

- Backend services
- Frontend applications
- Databases
- Caching systems
- Message brokers
- External APIs
- Dependencies and communication paths

Click on a component to inspect its configuration, connections, and discovery evidence.

DevMap will distinguish between confirmed and inferred dependencies, helping developers understand what is known and what still needs verification.

### 🟢 3. Real-Time Service Monitoring

An architecture diagram becomes even more useful when it comes alive.

DevMap will aim to detect and monitor services running across different environments:

- Java applications launched from an IDE
- Node.js development servers
- Docker containers
- Locally installed databases
- Services reachable through configured endpoints

Each component will display its current status.

| Status | Meaning |
|---|---|
| 🟢 Healthy | Service passed its configured health checks |
| 🟡 Warning | Service is running but has a detected issue |
| 🔴 Unavailable | A configured service could not be reached |
| ⚪ Unknown | Service status has not been verified |

Starting or stopping a service will update its representation in the architecture map.

**Docker is optional. Your architecture isn't limited to containers.**

### 🛠️ 4. Dependency Diagnostics

DevMap aims to go beyond showing whether a service is running.

Imagine this situation:

Your frontend is running successfully.

Your Spring Boot backend has started.

But PostgreSQL is unavailable.

Instead of manually investigating every component, DevMap could highlight the affected dependency and explain:

> ⚠️ PostgreSQL is unavailable.
>
> Your Spring Boot application has a configured connection to PostgreSQL on port 5432, but the database cannot be reached.
>
> Check whether the database service is running.

Future diagnostic capabilities will focus on explaining problems using observable evidence rather than speculative recommendations.

### ✏️ 5. Manual Configuration When Needed

Not every dependency can be discovered through static analysis.

Applications may use:

- Dynamically configured URLs
- Environment-specific services
- External APIs
- Private infrastructure
- Runtime-generated connections

DevMap will allow developers to manually add, edit, and connect components.

Automatically discovered relationships and manually configured information will work together.

Your corrections will be preserved when the project is rescanned.

---

## 🔒 Privacy First. Local by Design.

Your development environment should remain under your control.

DevMap is designed around a simple principle:

**Your source code stays on your machine.**

Our intended privacy principles:

- ✅ Local source code analysis
- ✅ No mandatory cloud services
- ✅ No user accounts
- ✅ No source code uploaded to DevMap servers
- ✅ Local configuration storage
- ✅ No telemetry by default
- ✅ Open-source and auditable

DevMap may perform network requests to application endpoints configured by the developer when monitoring is enabled. These requests will be transparent and controllable.

---

## 🧩 Planned Technology Stack

DevMap will initially focus on discovering Spring Boot applications and JavaScript-based frontends.

| Component | Technology |
|---|---|
| Core engine | Java |
| Local API | Spring Boot |
| User interface | Next.js + TypeScript |
| Architecture visualization | React Flow |
| Live updates | WebSocket or Server-Sent Events |
| Container integration | Docker Engine API |
| Local persistence | JSON or SQLite |

The architecture is intended to be modular so that support for additional frameworks and infrastructure can be added over time.

---

## 🛣️ Roadmap

### V1 — Architecture Discovery

**Goal: Understand an application before running it.**

- [ ] Scan local project directories
- [ ] Discover Spring Boot applications
- [ ] Detect JavaScript frontends
- [ ] Parse Maven and Gradle dependencies
- [ ] Analyze Spring Boot configuration files
- [ ] Discover Docker Compose services
- [ ] Identify common databases and infrastructure dependencies
- [ ] Generate an interactive architecture graph
- [ ] Display discovery evidence
- [ ] Allow manual service and dependency configuration
- [ ] Persist project maps locally

### V2 — Live Environment Monitoring

**Goal: Turn static architecture diagrams into live development maps.**

- [ ] Detect running Java and Node.js processes
- [ ] Integrate with Docker Engine
- [ ] Monitor configured ports and endpoints
- [ ] Support Spring Boot Actuator health checks
- [ ] Update service statuses in real time
- [ ] Match discovered services with running processes
- [ ] Visualize unavailable dependencies

### V3 — Intelligent Diagnostics

**Goal: Help developers understand why their applications aren't working.**

- [ ] Detect common dependency failures
- [ ] Correlate service health and dependency states
- [ ] Identify potential startup blockers
- [ ] Explain issues using diagnostic evidence
- [ ] Suggest troubleshooting steps
- [ ] Visualize dependency impact

### Future Possibilities

- Multi-repository architecture discovery
- Kubernetes support
- Additional backend frameworks
- Runtime communication tracing
- IDE integrations
- Architecture documentation export
- Plugin system for custom detectors
- Controlled startup orchestration

This roadmap is subject to change based on community feedback.

---

## 🎯 Who Is DevMap For?

**Backend developers** who want to understand how their services depend on databases, caches, and other APIs.

**Full-stack developers** who work with multiple applications running across terminals, IDEs, and Docker.

**Developers joining an existing project** who need to understand its architecture and local setup.

**Open-source maintainers** who want to make complex repositories easier to explore and understand.

**Teams working with microservices** who need a clearer picture of their local development environments.

---

## 🤝 Contributing

DevMap is being built in the open, and community feedback is welcome.

We'd love to hear from developers interested in:

- Java and Spring Boot
- Static code analysis
- Developer tooling
- Interactive graph visualization
- Docker and local infrastructure
- Open-source software

Whether you have an idea, discover an edge case, or want to contribute code, your input can help shape the project.

As development progresses, we'll publish contribution guidelines, local setup instructions, and a list of beginner-friendly issues.

---

## 💬 Help Shape DevMap

We're especially interested in understanding the challenges developers face when working with multi-service applications.

**What is the most frustrating part of understanding or starting an unfamiliar project?**

**Which technologies should DevMap detect first?**

**What would make an automatically generated architecture map genuinely useful to you?**

Share your thoughts through GitHub Issues and Discussions as they become available.

Your feedback will help us prioritize real developer problems over unnecessary features.

---

## ⭐ Support the Project

If you find the idea useful, consider giving DevMap a star.

It helps other developers discover the project and shows that there's interest in making local development environments easier to understand.

**Built for developers, with developers.**

---

*DevMap — Your application's architecture, finally visible.*

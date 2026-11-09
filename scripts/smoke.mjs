import assert from "node:assert/strict";

// Requires both DevMap services running and DEVMAP_SCAN_ROOT set to this repository.
const base = "http://127.0.0.1:3000";
const request = (path, options = {}) => fetch(`${base}${path}`, {
  ...options, signal: AbortSignal.timeout(25_000),
});
const scan = (path, headers = {}) => request("/api/projects/scan", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify({ path }),
});
const health = await request("/api/health");
assert.equal(health.status, 200);
assert.equal((await health.json()).mode, "static");
const response = await scan(".");
assert.equal(response.status, 200, await response.clone().text());
const graph = await response.json();
assert.ok(graph.nodes.some((node) => node.technology === "Spring Boot" &&
  node.evidence.some((entry) => entry.file === "backend/pom.xml")));
assert.ok(graph.nodes.some((node) => node.technology === "Next.js" &&
  node.evidence.some((entry) => entry.file === "frontend/package.json")));
assert.ok(graph.nodes.every((node) => node.status === "unknown"));
assert.ok(graph.edges.some((edge) => edge.confidence === "declared"));
const projects = await (await request("/api/projects")).json();
assert.ok(projects.some((project) => project.id === graph.id));
assert.equal((await request(`/api/projects/${graph.id}`)).status, 200);
assert.equal((await scan("..")).status, 400);
assert.equal((await scan(".", { Origin: "https://evil.example" })).status, 403);
const page = await request("/");
assert.equal(page.status, 200);
assert.match(await page.text(), /Analiza una carpeta para ver su mapa de arquitectura\./);
console.log("Integration OK: initial empty map, health, DevMap manifests, declared relationship, session maps, path boundary and foreign-origin rejection.");

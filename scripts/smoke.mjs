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

const scanFolder = (manifests, headers = {}) => request("/api/projects/scan-folder", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify({ name: "Folder outside the mount", manifests }),
});
const manifests = {
  "web/package.json": JSON.stringify({ dependencies: { next: "16" } }),
  "compose.yaml": "services:\n  api:\n    image: example/api\n    depends_on: [cache]\n  cache:\n    image: redis:7\n",
};
const folderResponse = await scanFolder(manifests);
assert.equal(folderResponse.status, 200, await folderResponse.clone().text());
const folderGraph = await folderResponse.json();
assert.equal(folderGraph.name, "Folder outside the mount");
assert.equal(folderGraph.filesInspected, 2);
assert.ok(folderGraph.nodes.some((node) => node.technology === "Next.js" &&
  node.evidence.some((entry) => entry.file === "web/package.json")));
assert.ok(folderGraph.edges.some((edge) => edge.confidence === "declared"));
assert.equal((await request(`/api/projects/${folderGraph.id}`)).status, 200);
assert.equal((await scanFolder({ "../package.json": "{}" })).status, 400);
assert.equal((await scanFolder({ ".env": "TOKEN=example" })).status, 400);
assert.equal((await scanFolder({ "node_modules/package.json": "{}" })).status, 400);
assert.equal((await scanFolder({ "package.json": " ".repeat(1024 * 1024 + 1) })).status, 400);
assert.equal((await scanFolder(manifests, { Origin: "https://evil.example" })).status, 403);

const folderPath = `/api/projects/${folderGraph.id}`;
assert.equal((await request(folderPath, { method: "DELETE", headers: { Origin: "https://evil.example" } })).status, 403);
assert.equal((await request(folderPath)).status, 200);
const deletion = await request(folderPath, { method: "DELETE" });
assert.equal(deletion.status, 204);
assert.equal(await deletion.text(), "");
assert.equal((await request(folderPath)).status, 404);
const remaining = await (await request("/api/projects")).json();
assert.ok(!remaining.some((project) => project.id === folderGraph.id));
assert.ok(remaining.some((project) => project.id === graph.id));

for (const logo of ["nextdotjs", "springboot", "postgresql"]) {
  const asset = await request(`/technologies/${logo}.svg`);
  assert.equal(asset.status, 200);
  assert.match(await asset.text(), /^<svg\b/);
}

const page = await request("/");
assert.equal(page.status, 200);
const pageHtml = await page.text();
assert.match(pageHtml, /Analiza una carpeta para ver su mapa de arquitectura\./);
assert.match(pageHtml, /Elegir carpeta/);
console.log("Integration OK: mounted scan, folder import, session deletion, local technology logos and request restrictions.");

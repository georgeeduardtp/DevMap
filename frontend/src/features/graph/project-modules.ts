import type { ArchitectureGraph, ComponentNode, DetectedTechnology } from "@/lib/types";

type ModuleRole = "frontend" | "backend" | "fullstack" | "infrastructure" | "module";
type ManifestKind = "application" | "compose" | "other";

export type ProjectModule = {
  id: string;
  path: string;
  role: ModuleRole;
  label: string;
  composeFile?: string;
  nodes: ComponentNode[];
  technologies?: DetectedTechnology[];
};

const frontendTechnologies = new Set(["Next.js", "React", "Angular", "Vue", "Nuxt", "Svelte", "SvelteKit", "Astro"]);
const backendTechnologies = new Set(["Spring Boot", "Express", "NestJS", "Quarkus", "Micronaut"]);
const frontendDirectories = new Set(["frontend", "front-end", "web", "client"]);
const backendDirectories = new Set(["backend", "back-end", "api", "server"]);
const roleLabels: Record<ModuleRole, string> = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Frontend y backend",
  infrastructure: "Docker Compose",
  module: "Módulo",
};
const roleOrder: ModuleRole[] = ["frontend", "backend", "fullstack", "infrastructure", "module"];

function manifestKind(file: string): ManifestKind {
  const filename = file.slice(file.lastIndexOf("/") + 1);
  if (filename === "package.json" || filename === "pom.xml") return "application";
  if (/^(?:docker-)?compose\.ya?ml$/.test(filename)) return "compose";
  return "other";
}

function applicationRole(path: string, names: string[]): ModuleRole {
  const hasFrontend = names.some((name) => frontendTechnologies.has(name));
  const hasBackend = names.some((name) => backendTechnologies.has(name));
  if (hasFrontend && hasBackend) return "fullstack";
  if (hasFrontend) return "frontend";
  if (hasBackend) return "backend";

  const directory = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  if (frontendDirectories.has(directory)) return "frontend";
  if (backendDirectories.has(directory)) return "backend";
  return "module";
}

export function projectModules(graph: ArchitectureGraph): ProjectModule[] {
  const groups = new Map<string, { path: string; kind: ManifestKind; composeFile?: string; nodes: ComponentNode[]; files: Set<string> }>();

  for (const node of graph.nodes) {
    const manifest = node.evidence.find(({ file }) => manifestKind(file) !== "other")?.file;
    const kind = manifest ? manifestKind(manifest) : "other";
    const path = manifest ? manifest.slice(0, Math.max(0, manifest.lastIndexOf("/"))) : "";
    const composeFile = kind === "compose" ? manifest : undefined;
    const id = `${kind}:${composeFile ?? path}`;
    let group = groups.get(id);
    if (!group) {
      group = { path, kind, composeFile, nodes: [], files: new Set() };
      groups.set(id, group);
    }
    group.nodes.push(node);
    if (manifest) group.files.add(manifest);
  }

  return Array.from(groups, ([id, group]): ProjectModule => {
    const technologies = graph.technologies?.flatMap((technology) => {
      const evidence = technology.evidence.filter((entry) => group.files.has(entry.file));
      return evidence.length ? [{ ...technology, evidence }] : [];
    });
    let role: ModuleRole = "module";
    if (group.kind === "compose") {
      role = "infrastructure";
    } else if (group.kind === "application") {
      const names = group.nodes.filter((node) => node.kind === "application").map((node) => node.technology);
      names.push(...(technologies ?? []).map((technology) => technology.name));
      role = applicationRole(group.path, names);
    }
    const composeName = group.composeFile ? graph.composeNames?.[group.composeFile] : undefined;
    const label = group.kind === "other" ? "Otros componentes" : roleLabels[role];
    return { id, path: group.path, role, label: composeName ? `${label} · ${composeName}` : label,
      composeFile: group.composeFile, nodes: group.nodes, technologies };
  }).sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) || a.path.localeCompare(b.path));
}

export function moduleTitle(module: ProjectModule) {
  return `${module.label} · ${module.composeFile ?? (module.path ? `${module.path}/` : "Raíz")}`;
}

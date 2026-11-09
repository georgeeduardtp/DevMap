import type { ArchitectureGraph } from "./types";
import { readFolderManifests } from "./folder-manifests";

async function assertOk(response: Response) {
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.detail || "No se pudo completar la petición. Comprueba el backend local.");
  }
}

async function read<T>(response: Response): Promise<T> {
  await assertOk(response);
  return response.json();
}
export const listProjects = () => fetch("/api/projects", { cache: "no-store" }).then(read<ArchitectureGraph[]>);
export const deleteProject = (id: string) => fetch(`/api/projects/${encodeURIComponent(id)}`, {
  method: "DELETE",
}).then(assertOk);
export const scanProject = (path: string) => fetch("/api/projects/scan", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }),
}).then(read<ArchitectureGraph>);

export async function scanFolder(files: File[]) {
  const folder = await readFolderManifests(files);
  const response = await fetch("/api/projects/scan-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(folder),
  });
  return read<ArchitectureGraph>(response);
}

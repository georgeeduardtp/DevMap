import type { ArchitectureGraph } from "./types";

async function read<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.detail || "No se pudo completar la petición. Comprueba el backend local.");
  }
  return response.json();
}
export const listProjects = () => fetch("/api/projects", { cache: "no-store" }).then(read<ArchitectureGraph[]>);
export const scanProject = (path: string) => fetch("/api/projects/scan", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }),
}).then(read<ArchitectureGraph>);

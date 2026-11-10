import type { ArchitectureGraph } from "./types";
import { readFolderManifests, type FolderSource } from "./folder-manifests";

export type ScanProgress =
  | { phase: "selecting" }
  | { phase: "preparing"; files?: { completed: number; total: number } }
  | { phase: "uploading"; loaded: number; total: number }
  | { phase: "analyzing" };

function requestError(problem: unknown) {
  const detail = problem && typeof problem === "object" && "detail" in problem ? problem.detail : undefined;
  return new Error(typeof detail === "string" && detail
    ? detail
    : "No se pudo completar la petición. Comprueba el backend local.");
}

async function assertOk(response: Response) {
  if (!response.ok) {
    throw requestError(await response.json().catch(() => null));
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
export async function scanFolder(source: FolderSource, onProgress: (progress: ScanProgress) => void): Promise<ArchitectureGraph> {
  onProgress({ phase: "preparing" });
  const folder = await readFolderManifests(source, (completed, total) => {
    onProgress({ phase: "preparing", files: { completed, total } });
  });
  const body = new Blob([JSON.stringify(folder)], { type: "application/json" });

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.upload.addEventListener("progress", (event) => {
      onProgress({ phase: "uploading", loaded: event.loaded, total: body.size });
    });
    request.upload.addEventListener("load", () => onProgress({ phase: "analyzing" }));

    request.open("POST", "/api/projects/scan-folder");
    request.setRequestHeader("Content-Type", "application/json");
    request.responseType = "json";
    request.timeout = 60_000;
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(requestError(request.response));
      } else if (!request.response || typeof request.response !== "object") {
        reject(new Error("El motor local devolvió una respuesta inválida."));
      } else {
        resolve(request.response);
      }
    };
    request.onerror = () => reject(requestError(null));
    request.ontimeout = () => reject(new Error("La importación tardó demasiado. Vuelve a intentarlo."));
    request.onabort = () => reject(new Error("Se interrumpió la importación."));

    onProgress({ phase: "uploading", loaded: 0, total: body.size });
    request.send(body);
  });
}

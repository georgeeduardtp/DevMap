import type { XYPosition } from "@xyflow/react";

export type ModulePositions = Map<string, XYPosition>;

function storageKey(projectId: string) {
  return `devmap:diagram-layout:${projectId}`;
}

export function readModulePositions(projectId: string): ModulePositions {
  const positions: ModulePositions = new Map();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey(projectId)) ?? "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return positions;
    for (const [id, position] of Object.entries(stored)) {
      if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
        positions.set(id, { x: position.x, y: position.y });
      }
    }
  } catch {
    // The canvas can still be rearranged if browser storage is unavailable.
  }
  return positions;
}

export function saveModulePositions(projectId: string, positions: ModulePositions) {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(Object.fromEntries(positions)));
  } catch {
    // Keep the current layout in memory if the browser cannot save it.
  }
}

export function clearModulePositions(projectId: string) {
  try {
    localStorage.removeItem(storageKey(projectId));
  } catch {
    // The map can still be deleted if browser storage is unavailable.
  }
}

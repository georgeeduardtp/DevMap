"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import FolderSchemePanel from "@/features/folders/FolderSchemePanel";
import ProjectInspector from "@/features/graph/ProjectInspector";
import { projectModules } from "@/features/graph/project-modules";
import { deleteProject, listProjects, scanFolder, type ScanProgress } from "@/lib/api";
import type { ArchitectureGraph } from "@/lib/types";

const ArchitectureCanvas = dynamic(() => import("@/features/graph/ArchitectureCanvas"), {
  ssr: false, loading: () => <ScreenLoader message="Preparando el mapa…" />,
});

function describeScan(progress: ScanProgress): { message: string; detail?: string; percentage?: number } {
  switch (progress.phase) {
    case "selecting":
      return { message: "Selecciona una carpeta…" };
    case "preparing": {
      const files = progress.files;
      return {
        message: files ? "Preparando manifiestos…" : "Leyendo estructura de carpetas…",
        detail: files ? `${files.completed} de ${files.total} archivos leídos` : undefined,
      };
    }
    case "uploading": {
      const percentage = Math.min(100, Math.floor(100 * progress.loaded / progress.total));
      return { message: "Enviando el análisis al motor local…", percentage };
    }
    case "analyzing":
      return { message: "Analizando carpeta…" };
  }
}

function ScreenLoader({ message, detail, percentage }: { message: string; detail?: string; percentage?: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={dialogRef} className="screen-loader" aria-label="Operación en curso"
    onCancel={(event) => event.preventDefault()}>
    <div className="screen-loader-content">
      <div className="loader-visual" aria-hidden="true">
        <svg viewBox="0 0 160 88" fill="none" focusable="false">
          <g className="loader-routes">
            <path d="M24 23H48L80 44H108L136 23M24 65H48L80 44L108 65H136" />
          </g>
          <g className="loader-signals">
            <path d="M24 23H48L80 44" pathLength="1" />
            <path d="M24 65H48L80 44" pathLength="1" />
            <path d="M80 44H108L136 23" pathLength="1" />
            <path d="M80 44L108 65H136" pathLength="1" />
          </g>
          <g className="loader-nodes">
            <rect x="19" y="18" width="10" height="10" rx="3" />
            <rect x="19" y="60" width="10" height="10" rx="3" />
            <rect x="131" y="18" width="10" height="10" rx="3" />
            <rect x="131" y="60" width="10" height="10" rx="3" />
          </g>
          <circle className="loader-pulse" cx="80" cy="44" r="15" />
          <rect className="loader-hub" x="72" y="36" width="16" height="16" rx="4" transform="rotate(45 80 44)" />
          <circle cx="80" cy="44" r="2.5" fill="var(--green)" />
        </svg>
      </div>
      <div className="loader-message" role="status">
        <span key={message}>{message}</span>
      </div>
      {percentage !== undefined ? (
        <div className="loader-progress">
          <progress className="scan-progress-bar" aria-label="Envío de datos del proyecto" value={percentage} max={100} />
          <span className="scan-progress-detail" aria-hidden="true">{percentage} %</span>
        </div>
      ) : detail && <span className="scan-progress-detail">{detail}</span>}
    </div>
  </dialog>;
}

export default function Home() {
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null);
  const [projects, setProjects] = useState<ArchitectureGraph[]>([]);
  const [selected, setSelected] = useState("");
  const [view, setView] = useState<"diagram" | "folders">("diagram");
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [useLegacyPicker, setUseLegacyPicker] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const modules = useMemo(() => graph ? projectModules(graph) : [], [graph]);
  const compose = modules.find((module) => module.composeFile && module.id === selected);
  const node = graph?.nodes.find((n) => n.id === selected);
  const busy = scanProgress !== null;
  const processing = busy || deletingId !== null;
  const loadingStatus = scanProgress ? describeScan(scanProgress)
    : deletingId !== null ? { message: "Borrando proyecto…" }
    : loadingProjects ? { message: "Cargando proyectos…" }
    : null;

  useEffect(() => {
    let active = true;
    listProjects().then((items) => {
      if (active) {
        setProjects((current) => [...current, ...items.filter((item) => !current.some((project) => project.id === item.id))].slice(0, 20));
        setConnected(true);
      }
    }).catch(() => {
      if (active) {
        setConnected(false);
        setError("No se pudieron cargar los mapas guardados. Comprueba el motor local.");
      }
    }).finally(() => {
      if (active) setLoadingProjects(false);
    });
    return () => { active = false; };
  }, []);

  function show(next: ArchitectureGraph) {
    setGraph(next); setSelected(""); setError("");
  }
  async function runScan(initial: ScanProgress, scan: () => Promise<ArchitectureGraph | undefined>) {
    setScanProgress(initial);
    setError("");
    try {
      const result = await scan();
      if (!result) return;
      show(result); setConnected(true);
      setProjects((previous) => [result, ...previous.filter((p) => p.id !== result.id)].slice(0, 20));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo analizar la carpeta."); }
    finally { setScanProgress(null); }
  }

  function chooseFolder() {
    if (processing) return;
    const picker = window as Window & {
      showDirectoryPicker?: (options: { mode: "read" }) => Promise<FileSystemDirectoryHandle>;
    };
    if (useLegacyPicker || !picker.isSecureContext || picker.top !== picker || !picker.showDirectoryPicker) {
      folderInput.current?.setAttribute("webkitdirectory", "");
      folderInput.current?.click();
      return;
    }

    const openDirectory = picker.showDirectoryPicker.bind(picker);
    void runScan({ phase: "selecting" }, async () => {
      let directory: FileSystemDirectoryHandle;
      try {
        directory = await openDirectory({ mode: "read" });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (cause instanceof DOMException && cause.name === "SecurityError") {
          setUseLegacyPicker(true);
          throw new Error("Pulsa «Elegir carpeta» otra vez para usar el selector alternativo de esta ventana.");
        }
        throw cause;
      }
      return scanFolder(directory, setScanProgress);
    });
  }
  async function removeProject(project: ArchitectureGraph) {
    if (processing || loadingProjects || !window.confirm(`¿Borrar el mapa guardado de «${project.name}»?`)) return;

    setDeletingId(project.id);
    setError("");
    try {
      await deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      if (graph?.id === project.id) {
        setGraph(null);
        setSelected("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo borrar el mapa guardado.");
    } finally {
      setDeletingId(null);
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <Link href="/" className="brand" aria-label="DevMap inicio"><span className="brand-icon">⌘</span>DevMap<span className="version">V0.1</span></Link>
      <div className="top-tagline">Tu arquitectura, a la vista.</div>
      <span className="local-badge"><span /> 100% local</span>
    </header>
    <div className="workspace">
      <aside className="sidebar">
        <p className="eyebrow">EXPLORADOR</p>
        <button type="button" className="choose-folder" disabled={processing} onClick={chooseFolder}>
          <span aria-hidden="true">+</span> Elegir carpeta
        </button>
        <input ref={folderInput} type="file" hidden onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length && !processing) {
            void runScan({ phase: "preparing" }, () => scanFolder(files, setScanProgress));
          }
        }} />
        <div className="sidebar-section"><p className="eyebrow">MAPAS GUARDADOS</p><span>{projects.length.toString().padStart(2, "0")}</span></div>
        {projects.length === 0 ? (
          <p className="muted sidebar-empty">Los repositorios que analices aparecerán aquí.</p>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <div className="project-row" key={project.id}>
                <button type="button" className={project.id === graph?.id ? "active" : ""}
                  disabled={processing} onClick={() => show(project)}>
                  <span aria-hidden="true">▱</span>{project.name}
                </button>
                <button type="button" className="delete-project" aria-label={`Borrar el mapa de ${project.name}`}
                  disabled={processing || loadingProjects} onClick={() => void removeProject(project)}>
                  Borrar
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="privacy-card"><span className="privacy-icon">⌂</span><strong>Tu código se queda contigo.</strong><p>Sin cuentas, sin nube y sin telemetría. Solo tú y tu repositorio.</p></div>
        <div className="engine-status"><i className={connected ? "online" : ""} />{connected ? "Motor local conectado" : "Motor local sin conectar"}</div>
      </aside>
      <main>
        <div className="page-heading"><div><p className="eyebrow">WORKSPACE / ARQUITECTURA</p><h1>Conecta los puntos<span>.</span></h1><p className="muted">Descubre las piezas de tu aplicación antes de arrancarla.</p></div><span className="static-pill">⌕ Análisis estático · V1</span></div>
        <nav className="project-nav" aria-label="Vistas del proyecto">
          <button type="button" aria-pressed={view === "diagram"} onClick={() => setView("diagram")}>Diagrama</button>
          <button type="button" aria-pressed={view === "folders"} onClick={() => setView("folders")}>Folder scheme</button>
        </nav>
        {error && <div className="error" role="alert">{error}</div>}
        {view === "folders" ? <FolderSchemePanel key={graph?.id} graph={graph} /> : graph ? <>
          <section className="map-panel" aria-label="Mapa de arquitectura">
            <div className="map-toolbar"><div><span className="map-dot" /><strong>{graph.name}</strong></div><span>{graph.nodes.length} componentes <b>·</b> {graph.edges.length} relaciones</span></div>
            <div className="map-content">
              <div className="canvas">
                {graph.nodes.length ? <ArchitectureCanvas graph={graph} modules={modules} selectedId={selected} onSelect={setSelected} /> : <div className="canvas-loading">No se encontraron componentes compatibles. Revisa los avisos.</div>}
                <div className="canvas-legend"><span className="legend-solid" />Declarada<span className="legend-dashed" />Inferida</div>
              </div>
              <ProjectInspector key={graph.id + graph.scannedAt} graph={graph} modules={modules} node={node} compose={compose} onSelect={setSelected} />
            </div>
            <div className="map-footer"><span>○ Sin comprobaciones de red</span><span>Arrastra para explorar · Scroll para acercar</span></div>
          </section>
          <section className="findings"><div><p className="eyebrow">LECTURA DEL MAPA</p><strong>{graph.filesInspected} manifiestos inspeccionados</strong></div><ul>{graph.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>
        </> : (
          <section className="map-panel" aria-label="Mapa de arquitectura">
            <div className="map-toolbar"><strong>Mapa de arquitectura</strong></div>
            <div className="canvas">
              <div className="canvas-loading">Analiza una carpeta para ver su mapa de arquitectura.</div>
            </div>
          </section>
        )}
        <footer className="page-footer"><span>DevMap / Open source, local first.</span><span>La arquitectura empieza por entenderla.</span></footer>
      </main>
    </div>
    {loadingStatus && <ScreenLoader {...loadingStatus} />}
  </div>;
}

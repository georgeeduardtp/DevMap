"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ProjectInspector from "@/features/graph/ProjectInspector";
import { projectModules } from "@/features/graph/project-modules";
import { deleteProject, listProjects, scanFolder, scanProject, type ScanProgress } from "@/lib/api";
import type { ArchitectureGraph } from "@/lib/types";

const ArchitectureCanvas = dynamic(() => import("@/features/graph/ArchitectureCanvas"), {
  ssr: false, loading: () => <MapLoader message="Preparando el mapa…" />,
});

function describeScan(progress: ScanProgress): { message: string; detail?: string; percentage?: number } {
  switch (progress.phase) {
    case "selecting":
      return { message: "Selecciona una carpeta…" };
    case "preparing": {
      const files = progress.files;
      return {
        message: "Preparando manifiestos…",
        detail: files ? `${files.completed} de ${files.total} archivos leídos` : undefined,
      };
    }
    case "uploading": {
      const percentage = Math.min(100, Math.floor(100 * progress.loaded / progress.total));
      return { message: "Enviando manifiestos al motor local…", detail: `${percentage} %`, percentage };
    }
    case "analyzing":
      return { message: "Analizando carpeta…" };
  }
}

function MapLoader({ message, detail, percentage }: { message: string; detail?: string; percentage?: number }) {
  return <div className="canvas-loading map-loader">
    <span className="map-spinner" aria-hidden="true" />
    <span role="status">{message}</span>
    {percentage !== undefined && (
      <progress className="scan-progress-bar" aria-label="Envío de manifiestos" value={percentage} max={100} />
    )}
    {detail && <span className="scan-progress-detail">{detail}</span>}
  </div>;
}

export default function Home() {
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null);
  const [projects, setProjects] = useState<ArchitectureGraph[]>([]);
  const [selected, setSelected] = useState("");
  const [path, setPath] = useState("");
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
  const scanStatus = scanProgress && describeScan(scanProgress);
  const busy = scanProgress !== null;
  const processing = busy || deletingId !== null;

  useEffect(() => {
    let active = true;
    listProjects().then((items) => {
      if (active) {
        setProjects((current) => [...current, ...items.filter((item) => !current.some((project) => project.id === item.id))].slice(0, 20));
        setConnected(true);
      }
    }).catch(() => { if (active) setConnected(false); }).finally(() => {
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
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scanPath = path.trim();
    if (scanPath && !processing) void runScan({ phase: "analyzing" }, () => scanProject(scanPath));
  }

  async function removeProject(project: ArchitectureGraph) {
    if (processing || loadingProjects || !window.confirm(`¿Borrar «${project.name}» de esta sesión?`)) return;

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
      setError(cause instanceof Error ? cause.message : "No se pudo borrar el proyecto de la sesión.");
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
        <div className="nav-active"><span>◇</span> Mapa de arquitectura</div>
        <div className="sidebar-section"><p className="eyebrow">PROYECTOS DE ESTA SESIÓN</p><span>{projects.length.toString().padStart(2, "0")}</span></div>
        {projects.length === 0 ? (
          <p className="muted sidebar-empty">{loadingProjects ? "Cargando proyectos…" : "Los repositorios que analices aparecerán aquí."}</p>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <div className="project-row" key={project.id}>
                <button type="button" className={project.id === graph?.id ? "active" : ""}
                  disabled={processing} onClick={() => show(project)}>
                  <span aria-hidden="true">▱</span>{project.name}
                </button>
                <button type="button" className="delete-project" aria-label={`Borrar ${project.name} de la sesión`}
                  disabled={processing || loadingProjects} onClick={() => void removeProject(project)}>
                  {deletingId === project.id ? "Borrando…" : "Borrar"}
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
        <form className="scan-form" onSubmit={submit}>
          <div className="folder-picker">
            <button type="button" disabled={processing} onClick={chooseFolder}>Elegir carpeta</button>
            <input ref={folderInput} type="file" hidden onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (files.length && !processing) {
                void runScan({ phase: "preparing" }, () => scanFolder(files, setScanProgress));
              }
            }} />
            <span>{scanStatus ? [scanStatus.message, scanStatus.detail].filter(Boolean).join(" ")
              : "DevMap analiza los manifiestos en tu ordenador."}</span>
          </div>
          <label htmlFor="repository">O ANALIZA UNA RUTA MONTADA</label>
          <div className="scan-input"><span aria-hidden>▱</span><input id="repository" value={path} onChange={(event) => setPath(event.target.value)} placeholder="Ruta de la carpeta" required disabled={processing} /><button type="submit" disabled={processing || !path.trim()}>{busy ? "En curso…" : "Analizar carpeta"}<span aria-hidden> ↗</span></button></div>
          <div className="scan-help">Escribe una ruta dentro de la carpeta de análisis. Usa «.» para analizar esa carpeta.</div>
        </form>
        {error && <div className="error" role="alert">{error}</div>}
        {graph ? <>
          <section className="map-panel" aria-label="Mapa de arquitectura">
            <div className="map-toolbar"><div><span className="map-dot" /><strong>{graph.name}</strong></div><span>{graph.nodes.length} componentes <b>·</b> {graph.edges.length} relaciones</span></div>
            <div className="map-content">
              <div className="canvas">
                {graph.nodes.length ? <ArchitectureCanvas graph={graph} modules={modules} selectedId={selected} onSelect={setSelected} /> : <div className="canvas-loading">No se encontraron componentes compatibles. Revisa los avisos.</div>}
                <div className="canvas-legend"><span className="legend-solid" />Declarada<span className="legend-dashed" />Inferida</div>
                {scanStatus && <div className="scan-overlay"><MapLoader {...scanStatus} /></div>}
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
              {scanStatus ? <MapLoader {...scanStatus} /> : (
                <div className="canvas-loading">Analiza una carpeta para ver su mapa de arquitectura.</div>
              )}
            </div>
          </section>
        )}
        <footer className="page-footer"><span>DevMap / Open source, local first.</span><span>La arquitectura empieza por entenderla.</span></footer>
      </main>
    </div>
  </div>;
}

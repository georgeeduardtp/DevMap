"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { listProjects, scanProject } from "@/lib/api";
import type { ArchitectureGraph } from "@/lib/types";

const ArchitectureCanvas = dynamic(() => import("@/features/graph/ArchitectureCanvas"), {
  ssr: false, loading: () => <div className="canvas-loading">Preparando el mapa…</div>,
});

export default function Home() {
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null);
  const [projects, setProjects] = useState<ArchitectureGraph[]>([]);
  const [selected, setSelected] = useState("");
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const node = graph?.nodes.find((n) => n.id === selected);

  useEffect(() => {
    let active = true;
    listProjects().then((items) => {
      if (active) { setProjects(items); setConnected(true); }
    }).catch(() => { if (active) setConnected(false); });
    return () => { active = false; };
  }, []);

  function show(next: ArchitectureGraph) {
    setGraph(next); setSelected(next.nodes[0]?.id || ""); setError("");
  }
  async function scan(scanPath: string) {
    setBusy(true); setError("");
    try {
      const result = await scanProject(scanPath);
      show(result); setConnected(true);
      setProjects((previous) => [result, ...previous.filter((p) => p.id !== result.id)].slice(0, 20));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo analizar la carpeta."); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (path.trim()) void scan(path.trim()); }

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
        {projects.length === 0 ? <p className="muted sidebar-empty">Los repositorios que analices aparecerán aquí.</p> :
          <div className="project-list">{projects.map((project) => <button key={project.id} className={project.id === graph?.id ? "active" : ""} onClick={() => show(project)}><span>▱</span>{project.name}</button>)}</div>}
        <div className="privacy-card"><span className="privacy-icon">⌂</span><strong>Tu código se queda contigo.</strong><p>Sin cuentas, sin nube y sin telemetría. Solo tú y tu repositorio.</p></div>
        <div className="engine-status"><i className={connected ? "online" : ""} />{connected ? "Motor local conectado" : "Motor local sin conectar"}</div>
      </aside>
      <main>
        <div className="page-heading"><div><p className="eyebrow">WORKSPACE / ARQUITECTURA</p><h1>Conecta los puntos<span>.</span></h1><p className="muted">Descubre las piezas de tu aplicación antes de arrancarla.</p></div><span className="static-pill">⌕ Análisis estático · V1</span></div>
        <form className="scan-form" onSubmit={submit}>
          <label htmlFor="repository">CARPETA DEL REPOSITORIO</label>
          <div className="scan-input"><span aria-hidden>▱</span><input id="repository" value={path} onChange={(event) => setPath(event.target.value)} placeholder="Ruta de la carpeta" required disabled={busy} /><button type="submit" disabled={busy || !path.trim()}>{busy ? "Analizando…" : "Analizar carpeta"}<span aria-hidden> ↗</span></button></div>
          <div className="scan-help">Escribe una ruta dentro de la carpeta de análisis. Usa «.» para analizar esa carpeta.</div>
        </form>
        {error && <div className="error" role="alert">{error}</div>}
        {graph ? <>
          <section className="map-panel" aria-label="Mapa de arquitectura">
            <div className="map-toolbar"><div><span className="map-dot" /><strong>{graph.name}</strong></div><span>{graph.nodes.length} componentes <b>·</b> {graph.edges.length} relaciones</span></div>
            <div className="map-content">
              <div className="canvas" aria-busy={busy}>
                {graph.nodes.length ? <ArchitectureCanvas graph={graph} onSelect={setSelected} /> : <div className="canvas-loading">No se encontraron componentes compatibles. Revisa los avisos.</div>}
                <div className="canvas-legend"><span className="legend-solid" />Declarada<span className="legend-dashed" />Inferida</div>
              </div>
              <aside className="inspector"><label className="eyebrow" htmlFor="component">DETALLE DEL COMPONENTE</label><select id="component" className="component-select" value={selected} onChange={(event) => setSelected(event.target.value)} disabled={!graph.nodes.length}>{graph.nodes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>{node ? <><span className="component-symbol">{node.kind === "application" ? "{ }" : "▤"}</span><h2>{node.label}</h2><span className="technology-badge">{node.technology}</span><dl><dt>Estado de ejecución</dt><dd>○ Desconocido</dd><dt>Origen</dt><dd>Análisis estático</dd></dl><h3>Evidencia</h3>{node.evidence.map((evidence, index) => <div className="evidence" key={index}><code>{evidence.file}</code><p>{evidence.description}</p></div>)}<p className="inspector-note">Una declaración indica una posibilidad de uso. No confirma que el servicio esté desplegado o activo.</p></> : <p className="muted">Selecciona un componente del mapa.</p>}</aside>
            </div>
            <div className="map-footer"><span>○ Sin comprobaciones de red</span><span>Arrastra para explorar · Scroll para acercar</span></div>
          </section>
          <section className="findings"><div><p className="eyebrow">LECTURA DEL MAPA</p><strong>{graph.filesInspected} manifiestos inspeccionados</strong></div><ul>{graph.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>
        </> : (
          <section className="map-panel" aria-label="Mapa de arquitectura">
            <div className="map-toolbar"><strong>Mapa de arquitectura</strong></div>
            <div className="canvas" aria-busy={busy}>
              <div className="canvas-loading" role="status">
                {busy ? "Analizando carpeta…" : "Analiza una carpeta para ver su mapa de arquitectura."}
              </div>
            </div>
          </section>
        )}
        <footer className="page-footer"><span>DevMap / Open source, local first.</span><span>La arquitectura empieza por entenderla.</span></footer>
      </main>
    </div>
  </div>;
}

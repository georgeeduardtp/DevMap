import { useState } from "react";
import TechnologyIcon from "@/components/TechnologyIcon";
import type { ArchitectureGraph, ComponentNode, DetectedTechnology } from "@/lib/types";
import { moduleTitle, type ProjectModule } from "./project-modules";

const categories = [
  ["language", "Lenguajes"],
  ["framework", "Frameworks"],
  ["library", "Librerías y SDK"],
  ["tool", "Herramientas"],
  ["runtime", "Entornos de ejecución"],
  ["infrastructure", "Infraestructura"],
] as const;

function EvidenceList({ evidence }: { evidence: ComponentNode["evidence"] }) {
  return evidence.map(({ file, description }) => (
    <div className="evidence" key={`${file}:${description}`}>
      <code>{file}</code>
      <p>{description}</p>
    </div>
  ));
}

function TechnologyOverview({ technologies }: { technologies?: DetectedTechnology[] }) {
  if (!technologies) return <p className="muted">Vuelve a analizar el proyecto para ver su inventario.</p>;
  if (!technologies.length) return <p className="muted">No se detectaron tecnologías en los manifiestos compatibles.</p>;

  return <div className="technology-overview">
    <p className="technology-overview-note">{technologies.length} {technologies.length === 1 ? "tecnología detectada" : "tecnologías detectadas"} a partir de los manifiestos.</p>
    {categories.map(([category, title]) => {
      const items = technologies.filter((technology) => technology.category === category);
      if (!items.length) return null;

      return <section className="technology-group" key={category}>
        <h3>{title}</h3>
        <ul className="technology-list">
          {items.map((technology) => (
            <li key={technology.name}>
              <details>
                <summary>
                  <TechnologyIcon technology={technology.name} />
                  <span>{technology.name}</span>
                </summary>
                <EvidenceList evidence={technology.evidence} />
              </details>
            </li>
          ))}
        </ul>
      </section>;
    })}
  </div>;
}

function ComposeDetails({ module }: { module: ProjectModule }) {
  const file = module.composeFile;
  if (!file) return null;

  const filename = file.slice(file.lastIndexOf("/") + 1);
  const command = `docker compose -f ${filename}`;
  return <div className="compose-details">
    <TechnologyIcon technology="Docker Compose" />
    <h2>Docker Compose</h2>
    <code className="compose-file">{file}</code>
    <p className="muted">{module.path ? <>Ejecuta desde <code>{module.path}/</code>.</> : "Ejecuta desde la raíz del proyecto."}</p>
    <h3>Construir las imágenes</h3>
    <pre><code>{command} build</code></pre>
    <h3>Construir y arrancar</h3>
    <pre><code>{command} up --build -d</code></pre>
    <h3>Servicios declarados</h3>
    <ul className="compose-service-list">{module.nodes.map((service) => <li key={service.id}>{service.label}</li>)}</ul>
  </div>;
}

export default function ProjectInspector({ graph, modules, node, compose, onSelect }: {
  graph: ArchitectureGraph;
  modules: ProjectModule[];
  node?: ComponentNode;
  compose?: ProjectModule;
  onSelect: (id: string) => void;
}) {
  const [moduleId, setModuleId] = useState("");
  const selectedModule = modules.find((module) => module.id === moduleId);
  const title = compose ? "Docker Compose" : node ? "Detalle del componente" : "Tecnologías detectadas";

  return <aside className="inspector" aria-label={title}>
    <label className="eyebrow" htmlFor="component">{title.toUpperCase()}</label>
    <select id="component" className="component-select" value={compose?.id ?? node?.id ?? ""}
      onChange={(event) => onSelect(event.target.value)} disabled={!graph.nodes.length}>
      <option value="">Tecnologías del proyecto</option>
      {modules.map((module) => <optgroup key={module.id} label={moduleTitle(module)}>
        {module.composeFile && <option value={module.id}>Comandos de Compose</option>}
        {module.nodes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </optgroup>)}
    </select>
    {compose ? <ComposeDetails module={compose} /> : node ? <>
      <span className="component-symbol">{node.kind === "application" ? "{ }" : "▤"}</span>
      <h2>{node.label}</h2>
      <span className="technology-badge">{node.technology}</span>
      <dl>
        <dt>Estado de ejecución</dt><dd>○ Desconocido</dd>
        <dt>Origen</dt><dd>Análisis estático</dd>
      </dl>
      <h3>Evidencia</h3>
      <EvidenceList evidence={node.evidence} />
      <p className="inspector-note">Una declaración indica una posibilidad de uso. No confirma que el servicio esté desplegado o activo.</p>
    </> : <>
      {modules.length > 1 && <>
        <label className="eyebrow" htmlFor="technology-module">MÓDULO</label>
        <select id="technology-module" className="component-select" value={moduleId} onChange={(event) => setModuleId(event.target.value)}>
          <option value="">Todo el proyecto</option>
          {modules.map((module) => <option key={module.id} value={module.id}>{moduleTitle(module)}</option>)}
        </select>
      </>}
      <TechnologyOverview technologies={selectedModule ? selectedModule.technologies : graph.technologies} />
    </>}
  </aside>;
}

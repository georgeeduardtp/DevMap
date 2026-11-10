import { useState } from "react";
import TechnologyIcon from "@/components/TechnologyIcon";
import type { ArchitectureGraph, ComponentNode, DetectedTechnology, ProjectCommand, ProjectConnection } from "@/lib/types";
import ProjectCommands, { commandDirectory } from "./ProjectCommands";
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

function commandsForCompose(commands: ProjectCommand[] | undefined, module: ProjectModule, modules: ProjectModule[]) {
  const sourceFiles = new Set(module.nodes.flatMap((item) => item.evidence.map(({ file }) => file)));
  const uniqueCompose = modules.filter(({ composeFile, path }) => composeFile && path === module.path).length === 1;
  return commands?.filter((command) => {
    if (sourceFiles.has(command.file)) return true;
    if (command.kind !== "documented" || commandDirectory(command.file) !== module.path) return false;
    return [...command.text.matchAll(/^[ \t]*(?:docker[ \t]+compose|docker-compose)[ \t]+(.+)$/gm)].some(([, args]) => {
      const explicitFiles = [...args.matchAll(/(?:^|\s)(?:-f|--file)(?:[ \t]+|=)(?:"([^"]+)"|'([^']+)'|([^\s]+))/g)];
      if (!explicitFiles.length) return uniqueCompose;
      const basename = module.composeFile?.split("/").at(-1);
      return explicitFiles.some(([, quoted, singleQuoted, plain]) => (quoted ?? singleQuoted ?? plain).replace(/^\.\//, "") === basename);
    });
  });
}

function ComposeDetails({ module, commands }: { module: ProjectModule; commands?: ProjectCommand[] }) {
  return <div className="compose-details">
    <TechnologyIcon technology="Docker Compose" />
    <h2>{module.label}</h2>
    <code className="compose-file">{module.composeFile}</code>
    <ProjectCommands commands={commands} />
    <h3>Servicios declarados</h3>
    <ul className="compose-service-list">{module.nodes.map((service) => <li key={service.id}>{service.label}</li>)}</ul>
  </div>;
}

const connectionTitles: Record<string, string> = { packages: "Empaqueta", "depends on": "Depende de", "may use": "Puede usar" };

function ConnectionDetails({ connection, names }: { connection: ProjectConnection; names: Map<string, string> }) {
  return <>
    <h2>{connectionTitles[connection.label] ?? connection.label}</h2>
    <dl>
      <dt>Origen</dt><dd>{names.get(connection.source)}</dd>
      <dt>Destino</dt><dd>{names.get(connection.target)}</dd>
      <dt>Evidencia estática</dt><dd>{connection.confidence === "inferred" ? "Inferida" : "Declarada"}</dd>
    </dl>
    <h3>Archivos de referencia</h3>
    {connection.evidence?.length ? <EvidenceList evidence={connection.evidence} />
      : <p className="muted">Vuelve a analizar el proyecto para ver los archivos de referencia.</p>}
  </>;
}

export default function ProjectInspector({ graph, modules, node, compose, connection, onSelect }: {
  graph: ArchitectureGraph;
  modules: ProjectModule[];
  node?: ComponentNode;
  compose?: ProjectModule;
  connection?: ProjectConnection;
  onSelect: (id: string) => void;
}) {
  const [moduleId, setModuleId] = useState("");
  const selectedModule = modules.find((module) => module.id === moduleId);
  const title = connection ? "Detalle de la relación" : compose ? "Docker Compose" : node ? "Detalle del componente" : "Tecnologías detectadas";
  const names = new Map(graph.nodes.map((item) => [item.id, item.label]));
  const componentFiles = node?.evidence.map(({ file }) => file) ?? [];
  const componentCommands = graph.commands?.filter((command) =>
    command.componentId ? command.componentId === node?.id : componentFiles.includes(command.file) ||
    (node?.kind === "application" && command.kind === "documented" && componentFiles.some((file) =>
      commandDirectory(command.file) === commandDirectory(file) ||
      command.text.split(/\s+/).some((word) => word.replace(/^["']|["']$/g, "") === file))));
  const overviewCommands = selectedModule?.composeFile ? commandsForCompose(graph.commands, selectedModule, modules)
    : selectedModule ? graph.commands?.filter((command) => command.kind !== "container" &&
      commandDirectory(command.file) === selectedModule.path)
    : graph.commands;

  return <aside className="inspector" aria-label={title}>
    <label className="eyebrow" htmlFor="component">{title.toUpperCase()}</label>
    <select id="component" className="component-select" value={connection?.id ?? compose?.id ?? node?.id ?? ""}
      onChange={(event) => onSelect(event.target.value)} disabled={!graph.nodes.length}>
      <option value="">Tecnologías del proyecto</option>
      {modules.map((module) => <optgroup key={module.id} label={moduleTitle(module)}>
        {module.composeFile && <option value={module.id}>Comandos de Compose</option>}
        {module.nodes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </optgroup>)}
      {graph.edges.length > 0 && <optgroup label="Relaciones">
        {graph.edges.map((edge) => <option key={edge.id} value={edge.id}>
          {names.get(edge.source)} → {names.get(edge.target)} · {connectionTitles[edge.label] ?? edge.label}
        </option>)}
      </optgroup>}
    </select>
    {connection ? <ConnectionDetails connection={connection} names={names} />
      : compose ? <ComposeDetails key={compose.id} module={compose} commands={commandsForCompose(graph.commands, compose, modules)} /> : node ? <>
      <span className="component-symbol">{node.kind === "application" ? "{ }" : "▤"}</span>
      <h2>{node.label}</h2>
      <span className="technology-badge">{node.technology}</span>
      <ProjectCommands key={node.id} commands={componentCommands} />
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
      <ProjectCommands key={moduleId} commands={overviewCommands} />
      <TechnologyOverview technologies={selectedModule ? selectedModule.technologies : graph.technologies} />
    </>}
  </aside>;
}

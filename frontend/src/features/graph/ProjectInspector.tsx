import TechnologyIcon from "@/components/TechnologyIcon";
import type { ArchitectureGraph, ComponentNode, DetectedTechnology } from "@/lib/types";

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

export default function ProjectInspector({ graph, node, onSelect }: {
  graph: ArchitectureGraph;
  node?: ComponentNode;
  onSelect: (id: string) => void;
}) {
  return <aside className="inspector" aria-label={node ? "Detalle del componente" : "Tecnologías detectadas"}>
    <label className="eyebrow" htmlFor="component">{node ? "DETALLE DEL COMPONENTE" : "TECNOLOGÍAS DETECTADAS"}</label>
    <select id="component" className="component-select" value={node?.id ?? ""}
      onChange={(event) => onSelect(event.target.value)} disabled={!graph.nodes.length}>
      <option value="">Tecnologías del proyecto</option>
      {graph.nodes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
    {node ? <>
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
    </> : <TechnologyOverview technologies={graph.technologies} />}
  </aside>;
}

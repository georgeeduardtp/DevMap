import { useId, useMemo, useRef, useState, type CSSProperties, type Ref } from "react";
import type { ArchitectureGraph } from "@/lib/types";

type Directory = { name: string; path: string; children: Map<string, Directory> };
type FolderRow = { directory: Directory; x: number; y: number; branchEnd?: number };

const INDENT = 38;
const ROW_HEIGHT = 34;
const LEFT = 22;
const ANIMATED_ROWS = 20;
const FOLDER_PATH = "M2.5 6a1.5 1.5 0 0 1 1.5-1.5h4L10 6.5h6A1.5 1.5 0 0 1 17.5 8v6A1.5 1.5 0 0 1 16 15.5H4A1.5 1.5 0 0 1 2.5 14Z";

function directoryTree(name: string, paths: string[]) {
  const root: Directory = { name, path: "", children: new Map() };
  const byPath = new Map([["", root]]);
  for (const path of paths) {
    let parent = root;
    for (const name of path.split("/")) {
      let directory = parent.children.get(name);
      if (!directory) {
        const path = parent.path ? `${parent.path}/${name}` : name;
        directory = { name, path, children: new Map() };
        parent.children.set(name, directory);
        byPath.set(path, directory);
      }
      parent = directory;
    }
  }
  return { root, byPath };
}

function folderLayout(root: Directory) {
  const rows: FolderRow[] = [];
  function addRow(directory: Directory, depth: number) {
    const row: FolderRow = { directory, x: LEFT + depth * INDENT, y: 27 + rows.length * ROW_HEIGHT };
    rows.push(row);
    const sortedChildren = [...directory.children.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const child of sortedChildren) {
      row.branchEnd = addRow(child, depth + 1).y;
    }
    return row;
  }
  addRow(root, 0);
  return rows;
}

function estimatedLabelWidth(name: string) {
  return Array.from(name).reduce((width, character) => width + (character.charCodeAt(0) < 256 ? 9 : 17), 0);
}

function trunkPath({ x, y, branchEnd }: FolderRow) {
  return branchEnd === undefined ? undefined : `M${x + 11} ${y + 11}V${branchEnd}`;
}

function connectorPath({ x, y }: FolderRow) {
  return `M${x - INDENT + 11} ${y}H${x}`;
}

function FolderBranchGlow({ rows, selectedPath }: { rows: FolderRow[]; selectedPath: string }) {
  const id = useId();
  const selectedIndex = rows.findIndex(({ directory }) => directory.path === selectedPath);
  const selected = rows[selectedIndex];
  const trunk = selected && trunkPath(selected);
  if (!trunk) return null;

  const paths = [trunk];
  let right = selected.x;
  let bottom = selected.y;
  // Descendants occupy consecutive rows until the layout returns to this depth or higher.
  for (let index = selectedIndex + 1; index < rows.length && rows[index].x > selected.x; index++) {
    const row = rows[index];
    paths.push(connectorPath(row));
    const trunk = trunkPath(row);
    if (trunk) paths.push(trunk);
    right = Math.max(right, row.x);
    bottom = row.y;
  }

  const outline = paths.join(" ");
  const x = selected.x + 6;
  const y = selected.y + 6;
  const width = right - x + 5;
  const height = bottom - y + 5;
  const step = Math.min(600, Math.max(160, height + 90));
  const gradientStart = selected.y + 11 - 38;
  const motionStyle = {
    "--folder-glow-step": `${step}px`,
    "--folder-glow-duration": `${Math.max(1.25, step / 265)}s`,
  } as CSSProperties;

  return <g className="folder-branch-glow" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-light`} gradientUnits="userSpaceOnUse"
        x1="0" x2="0" y1={gradientStart} y2={gradientStart + step}
        gradientTransform={`translate(${selected.x + 11} 0) skewY(-20)`} spreadMethod="repeat">
        <stop offset="0" stopColor="#8ce78e" stopOpacity="0" />
        <stop offset={20 / step} stopColor="#8ce78e" stopOpacity=".35" />
        <stop offset={38 / step} stopColor="#ccffab" />
        <stop offset={58 / step} stopColor="#8ce78e" stopOpacity=".4" />
        <stop offset={78 / step} stopColor="#8ce78e" stopOpacity="0" />
        <stop offset="1" stopColor="#8ce78e" stopOpacity="0" />
      </linearGradient>
      <mask id={`${id}-routes`} maskUnits="userSpaceOnUse" x={x} y={y} width={width} height={height}>
        <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
          <path d={outline} strokeWidth="8" opacity=".18" />
          <path d={outline} strokeWidth="4.5" opacity=".45" />
          <path d={outline} strokeWidth="2" />
        </g>
      </mask>
    </defs>
    <g mask={`url(#${id}-routes)`}>
      <rect className="folder-glow-wave" x={x} y={y - step} width={width} height={height + step}
        fill={`url(#${id}-light)`} style={motionStyle} />
    </g>
  </g>;
}

function FolderDiagram({ root, svgRef, selectedPath, onSelect, animate = false }: {
  root: Directory;
  svgRef?: Ref<SVGSVGElement>;
  selectedPath?: string | null;
  onSelect?: (path: string) => void;
  animate?: boolean;
}) {
  const rows = useMemo(() => folderLayout(root).map((row, index) => ({
    ...row,
    motionStyle: animate && index < ANIMATED_ROWS
      ? { "--folder-row-delay": `${index * 24}ms` } as CSSProperties
      : undefined,
  })), [root, animate]);
  const width = Math.max(260, ...rows.map(({ x, directory }) => x + 32 + estimatedLabelWidth(directory.name) + LEFT));
  const height = 20 + rows.length * ROW_HEIGHT;
  const title = `Estructura de carpetas de ${root.path || root.name}`;

  return <svg ref={svgRef} className="folder-diagram" xmlns="http://www.w3.org/2000/svg"
    width={width} height={height} viewBox={`0 0 ${width} ${height}`}
    role={onSelect ? "group" : "img"} aria-label={title}>
    <title>{title}</title>
    <desc>{rows.slice(1).map(({ directory }) => directory.path).join("\n")}</desc>
    <rect width={width} height={height} rx="8" fill="#0e1916" />
    <g fill="none" stroke="#50715a" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      {rows.map((row) => <g key={row.directory.path}
        className={row.motionStyle ? "folder-branch-links" : undefined} style={row.motionStyle}>
        {row.branchEnd !== undefined && <path d={trunkPath(row)} pathLength={row.motionStyle ? 1 : undefined} />}
        {row.x !== LEFT && <path d={connectorPath(row)} pathLength={row.motionStyle ? 1 : undefined} />}
      </g>)}
    </g>
    {onSelect && typeof selectedPath === "string" &&
      <FolderBranchGlow key={selectedPath} rows={rows} selectedPath={selectedPath} />}
    <g fontFamily="Consolas, 'Liberation Mono', monospace" fontSize="13">
      {rows.map(({ directory, x, y, motionStyle }, index) => <g key={directory.path}
        className={onSelect ? "folder-diagram-node" : motionStyle ? "folder-branch-node" : undefined}
        style={motionStyle}
        role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}
        aria-label={onSelect ? `Ver ${directory.path || directory.name}` : undefined}
        aria-pressed={onSelect ? selectedPath === directory.path : undefined}
        onClick={onSelect && (() => onSelect(directory.path))}
        onKeyDown={onSelect && ((event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(directory.path);
          }
        })}>
        {onSelect && <rect className="folder-node-highlight" x={x - 5} y={y - 14}
          width={43 + estimatedLabelWidth(directory.name)} height="28" rx="5" fill="transparent" />}
        <rect x={x} y={y - 11} width="22" height="22" rx="5"
          fill={index ? "#1b2f24" : "#2a4631"} stroke={index ? "#3e5b47" : "#638464"} />
        <path d={FOLDER_PATH} transform={`translate(${x + 1} ${y - 10})`}
          fill="none" stroke="#b3db9e" strokeWidth="1.4" strokeLinejoin="round" />
        <text x={x + 32} y={y} dominantBaseline="central" fill={index ? "#d4e0d4" : "#e8f4e1"}
          fontWeight={index ? "400" : "700"}>{directory.name}</text>
      </g>)}
    </g>
  </svg>;
}

export default function FolderSchemePanel({ graph }: { graph: ArchitectureGraph | null }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const scheme = graph?.folderScheme;
  const projectName = graph?.name;
  const count = scheme?.directories.length ?? 0;
  const tree = useMemo(() => projectName && scheme ? directoryTree(projectName, scheme.directories) : null, [projectName, scheme]);
  const selected = selectedPath === null ? undefined : tree?.byPath.get(selectedPath);

  function exportSvg() {
    if (!svgRef.current || !graph) return;
    const diagram = svgRef.current.cloneNode(true) as SVGSVGElement;
    diagram.setAttribute("role", "img");
    diagram.querySelector(".folder-branch-glow")?.remove();
    for (const node of diagram.querySelectorAll(".folder-diagram-node")) {
      for (const attribute of ["role", "tabindex", "aria-label", "aria-pressed"]) node.removeAttribute(attribute);
      node.querySelector(".folder-node-highlight")?.remove();
    }
    const svg = new XMLSerializer().serializeToString(diagram);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    const filename = graph.name.replace(/[<>:"/\\|?*]/g, "-").slice(0, 80);
    link.href = url;
    link.download = `${filename}-folder-scheme.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="map-panel folder-panel" aria-label="Estructura de carpetas">
    <div className="map-toolbar">
      <div><span className="map-dot" /><strong>{graph?.name ?? "Folder scheme"}</strong></div>
      {scheme && <div className="folder-panel-actions">
        <span>{count} {count === 1 ? "carpeta" : "carpetas"}</span>
        <button type="button" className="export-scheme" onClick={exportSvg}>Exportar SVG</button>
      </div>}
    </div>
    {tree ? <div className="folder-scheme-layout">
      <div className="folder-panel-content">
        <FolderDiagram root={tree.root} svgRef={svgRef} selectedPath={selectedPath}
          onSelect={(path) => setSelectedPath((current) => current === path ? null : path)} />
      </div>
      <section className="folder-branch" aria-label="Rama seleccionada">
        <header className="folder-branch-heading">
          <span>Rama seleccionada</span>
          <strong aria-live="polite">{selected && (selected.path || selected.name)}</strong>
        </header>
        <div className="folder-panel-content" key={selected?.path}>
          {selected ? <FolderDiagram root={selected} animate />
            : <p className="folder-empty">Pulsa una carpeta del esquema para ver su rama aquí.</p>}
        </div>
      </section>
    </div> : <div className="folder-panel-content">
      <p className="folder-empty">{graph ? "Vuelve a importar esta carpeta para guardar su estructura."
        : "Elige una carpeta para explorar su estructura."}</p>
    </div>}
    {scheme?.partial && <div className="map-footer folder-panel-footer">Vista parcial. Algunas carpetas pueden quedar fuera.</div>}
  </section>;
}

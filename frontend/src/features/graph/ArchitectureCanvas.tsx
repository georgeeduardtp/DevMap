"use client";

import { useMemo } from "react";
import { Background, Controls, MiniMap, Position, ReactFlow, type Node, type Edge, type NodeProps } from "@xyflow/react";
import TechnologyIcon from "@/components/TechnologyIcon";
import type { ArchitectureGraph } from "@/lib/types";
import type { ProjectModule } from "./project-modules";

type ModuleFrameNode = Node<{
  label: string;
  path: string;
  composeId?: string;
  onSelect: (id: string) => void;
}, "moduleFrame">;

function ModuleFrame({ data }: NodeProps<ModuleFrameNode>) {
  if (data.composeId) {
    const composeId = data.composeId;
    return <button className="module-frame-heading compose-frame-button" type="button" onClick={(event) => {
      event.stopPropagation();
      data.onSelect(composeId);
    }}>
      <span className="compose-frame-title"><strong>{data.label}</strong><span>Comandos ↗</span></span>
      <code title={data.path}>{data.path}</code>
    </button>;
  }
  return <div className="module-frame-heading">
    <strong>{data.label}</strong>
    <code title={data.path}>{data.path || "Raíz del proyecto"}</code>
  </div>;
}

const nodeTypes = { moduleFrame: ModuleFrame };

const layout = { padding: 20, nodeWidth: 235, nodeGap: 42, nodeRow: 155, header: 72, groupGap: 48 };

export default function ArchitectureCanvas({ graph, modules, selectedId, onSelect }: {
  graph: ArchitectureGraph;
  modules: ProjectModule[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const nodes = useMemo<Node[]>(() => {
    const positioned: Node[] = [];
    let x = 0;
    let y = 0;
    let rowHeight = 0;

    for (const [index, module] of modules.entries()) {
      const columns = Math.min(2, module.nodes.length);
      const width = layout.padding * 2 + columns * layout.nodeWidth + (columns - 1) * layout.nodeGap;
      const height = layout.header + Math.ceil(module.nodes.length / columns) * layout.nodeRow;
      const frame: ModuleFrameNode = {
        id: `devmap-module-${index}`,
        type: "moduleFrame",
        position: { x, y },
        data: {
          label: module.label,
          path: module.composeFile ?? (module.path ? `${module.path}/` : ""),
          composeId: module.composeFile ? module.id : undefined,
          onSelect,
        },
        className: `module-frame module-frame-${module.role}${module.id === selectedId ? " module-frame-active" : ""}`,
        selectable: false,
        focusable: false,
        style: { width, height, pointerEvents: module.composeFile ? "auto" : "none" },
      };

      rowHeight = Math.max(rowHeight, height);
      if (index % 2 === 0) {
        x += width + layout.groupGap;
      } else {
        y += rowHeight + layout.groupGap;
        x = 0;
        rowHeight = 0;
      }

      const prefix = module.path ? `${module.path} · ` : "";
      const children: Node[] = module.nodes.map((node, i) => ({
        id: node.id,
        parentId: frame.id,
        position: {
          x: layout.padding + (i % columns) * (layout.nodeWidth + layout.nodeGap),
          y: layout.header + Math.floor(i / columns) * layout.nodeRow,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        selected: node.id === selectedId,
        className: `architecture-node ${node.kind}`,
        data: { label: <div>
          <div className="node-technology">
            <TechnologyIcon technology={node.technology} />
            <span className="node-tech">{node.technology}</span>
          </div>
          <strong title={node.label}>{node.label.startsWith(prefix) ? node.label.slice(prefix.length) : node.label}</strong>
          <span className="node-state">○ Estado desconocido</span>
        </div> },
      }));
      positioned.push(frame, ...children);
    }
    return positioned;
  }, [modules, selectedId, onSelect]);
  const edges = useMemo<Edge[]>(() => graph.edges.map((edge) => ({
    ...edge, type: "smoothstep", animated: false,
    label: edge.confidence === "inferred" ? "uso posible" : "dependencia declarada",
    style: { stroke: edge.confidence === "inferred" ? "#617c86" : "#7ecfb0", strokeDasharray: edge.confidence === "inferred" ? "6 5" : undefined },
    labelStyle: { fill: "#b7c8c4", fontSize: 11 }, labelBgStyle: { fill: "#142320" },
  })), [graph]);
  return <ReactFlow key={graph.id + graph.scannedAt} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.22 }}
    minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false}
    onNodeClick={(_, node) => onSelect(node.type === "moduleFrame" ? String(node.data.composeId ?? "") : node.id)}
    onPaneClick={() => onSelect("")}
    proOptions={{ hideAttribution: false }} colorMode="dark">
    <Background color="#31433e" gap={24} size={1} />
    <Controls showInteractive={false} />
    <MiniMap pannable zoomable nodeColor="#568875" maskColor="rgba(8,17,15,.7)" />
  </ReactFlow>;
}
